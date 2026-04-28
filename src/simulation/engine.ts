import type {
  Circuit,
  SimulationResult,
  NodeResult,
  FaultEvent,
  CircuitComponent,
  Wire,
} from '../types';

export class CircuitEngine {
  simulate(circuit: Circuit): SimulationResult {
    const graph = this.buildGraph(circuit);
    const nodes: Record<string, NodeResult> = {};
    const faults: FaultEvent[] = [];

    const sources = circuit.components.filter(
      (c) => c.type === 'power_source'
    );

    for (const source of sources) {
      const voltage = source.properties.voltage || 230;
      this.propagate(source, graph, circuit, nodes, faults, voltage);
    }

    circuit.components.forEach((c) => {
      if (!nodes[c.id]) {
        nodes[c.id] = {
          nodeId: c.id,
          voltageV: 0,
          currentA: 0,
          powerW: 0,
          powerVA: 0,
          powerFactor: 1,
          energized: false,
        };
      }
    });

    this.updateWireStates(circuit, nodes);

    let totalPowerW = 0;
    let totalCurrentA = 0;
    Object.values(nodes).forEach((n) => {
      if (n.energized) {
        totalPowerW += n.powerW;
        totalCurrentA += n.currentA;
      }
    });

    return {
      success: true,
      nodes,
      faults,
      timestamp: Date.now(),
      totalPowerW,
      totalCurrentA,
    };
  }

  private propagate(
    current: CircuitComponent,
    graph: Map<string, string[]>,
    circuit: Circuit,
    nodes: Record<string, NodeResult>,
    faults: FaultEvent[],
    voltage: number
  ): void {
    if (nodes[current.id]) return;

    if (current.state === 'off' || current.state === 'tripped') {
      nodes[current.id] = {
        nodeId: current.id,
        voltageV: voltage,
        currentA: 0,
        powerW: 0,
        powerVA: 0,
        powerFactor: 1,
        energized: false,
      };
      return;
    }

    const pf = this.getPowerFactor(current);
    const currentA = this.calculateCurrent(current, voltage);
    const powerW = voltage * currentA * pf;
    const powerVA = voltage * currentA;

    const downstreamCurrent = this.calculateDownstreamCurrent(
      current,
      graph,
      circuit,
      voltage
    );
    const totalCurrent =
      currentA > 0 ? currentA : downstreamCurrent;

    const fault = this.checkFaults(current, totalCurrent, voltage);
    if (fault) {
      faults.push(fault);
      current.state = 'tripped';
      nodes[current.id] = {
        nodeId: current.id,
        voltageV: 0,
        currentA: 0,
        powerW: 0,
        powerVA: 0,
        powerFactor: pf,
        energized: false,
      };
      return;
    }

    nodes[current.id] = {
      nodeId: current.id,
      voltageV: voltage,
      currentA: currentA > 0 ? currentA : totalCurrent,
      powerW,
      powerVA,
      powerFactor: pf,
      energized: true,
    };

    const neighbors = graph.get(current.id) || [];
    for (const neighborId of neighbors) {
      const neighbor = circuit.components.find((c) => c.id === neighborId);
      if (neighbor) {
        this.propagate(neighbor, graph, circuit, nodes, faults, voltage);
      }
    }
  }

  private calculateCurrent(
    component: CircuitComponent,
    voltage: number
  ): number {
    const p = component.properties;
    const pf = this.getPowerFactor(component);

    switch (component.type) {
      case 'lamp':
      case 'heater':
      case 'generic_load':
        return (p.powerWatts ?? 60) / (voltage * pf);
      case 'motor':
        return ((p.powerWatts ?? 1000) / (voltage * pf)) * 1.25;
      case 'socket':
        return p.powerWatts ? p.powerWatts / (voltage * pf) : 0;
      case 'mcb':
      case 'rcd':
      case 'switch':
      case 'push_button':
      case 'busbar':
      case 'power_source':
      case 'junction':
      case 'contactor':
      case 'relay':
      case 'timer':
      case 'overload_relay':
        return 0;
      default:
        return 0;
    }
  }

  private getPowerFactor(component: CircuitComponent): number {
    if (component.properties.powerFactor !== undefined) {
      return component.properties.powerFactor;
    }
    switch (component.properties.loadType) {
      case 'resistive':
        return 1.0;
      case 'inductive':
        return 0.8;
      case 'capacitive':
        return 0.95;
      default:
        return 1.0;
    }
  }

  private calculateDownstreamCurrent(
    component: CircuitComponent,
    graph: Map<string, string[]>,
    circuit: Circuit,
    voltage: number
  ): number {
    const visited = new Set<string>();
    return this.sumDownstream(
      component.id,
      graph,
      circuit,
      voltage,
      visited
    );
  }

  private sumDownstream(
    id: string,
    graph: Map<string, string[]>,
    circuit: Circuit,
    voltage: number,
    visited: Set<string>
  ): number {
    if (visited.has(id)) return 0;
    visited.add(id);

    let total = 0;
    const neighbors = graph.get(id) || [];
    for (const nId of neighbors) {
      if (visited.has(nId)) continue;
      const comp = circuit.components.find((c) => c.id === nId);
      if (!comp) continue;
      if (comp.state === 'off' || comp.state === 'tripped') continue;
      const c = this.calculateCurrent(comp, voltage);
      total += c;
      if (c === 0) {
        total += this.sumDownstream(nId, graph, circuit, voltage, visited);
      }
    }
    return total;
  }

  private checkFaults(
    component: CircuitComponent,
    currentA: number,
    _voltage: number
  ): FaultEvent | null {
    const p = component.properties;

    if (
      component.type === 'mcb' &&
      p.ratingAmps &&
      currentA > p.ratingAmps
    ) {
      return {
        id: crypto.randomUUID(),
        type: 'overload',
        affectedComponentId: component.id,
        message: `MCB "${component.label}" overloaded: ${currentA.toFixed(
          1
        )}A exceeds ${p.ratingAmps}A rating`,
        severity: 'critical',
        timestamp: Date.now(),
      };
    }

    if (
      component.type === 'overload_relay' &&
      p.ratingAmps &&
      currentA > p.ratingAmps
    ) {
      return {
        id: crypto.randomUUID(),
        type: 'overload',
        affectedComponentId: component.id,
        message: `Overload relay "${component.label}" tripped: ${currentA.toFixed(
          1
        )}A exceeds ${p.ratingAmps}A`,
        severity: 'critical',
        timestamp: Date.now(),
      };
    }

    if (currentA > 1000) {
      return {
        id: crypto.randomUUID(),
        type: 'short_circuit',
        affectedComponentId: component.id,
        message: `Short circuit detected at "${component.label}"`,
        severity: 'critical',
        timestamp: Date.now(),
      };
    }

    if (
      component.type === 'rcd' &&
      p.rcdSensitivity &&
      currentA > 0
    ) {
      // Simplified earth leakage check
    }

    return null;
  }

  private updateWireStates(
    circuit: Circuit,
    nodes: Record<string, NodeResult>
  ): void {
    circuit.wires.forEach((wire: Wire) => {
      const fromNode = nodes[wire.fromComponentId];
      const toNode = nodes[wire.toComponentId];
      wire.energized =
        (fromNode?.energized || false) && (toNode?.energized || false);
      wire.currentAmps = fromNode?.currentA || toNode?.currentA || 0;
    });
  }

  private buildGraph(circuit: Circuit): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    circuit.components.forEach((c) => graph.set(c.id, []));

    circuit.wires.forEach((wire) => {
      const fromList = graph.get(wire.fromComponentId) || [];
      const toList = graph.get(wire.toComponentId) || [];
      if (!fromList.includes(wire.toComponentId)) {
        fromList.push(wire.toComponentId);
      }
      if (!toList.includes(wire.fromComponentId)) {
        toList.push(wire.fromComponentId);
      }
      graph.set(wire.fromComponentId, fromList);
      graph.set(wire.toComponentId, toList);
    });

    return graph;
  }
}

export const engine = new CircuitEngine();
