import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer } from 'react-konva';
import Konva from 'konva';
import { useCircuitStore } from '../../store/circuitStore';
import { useThemeStore, themeColors } from '../../store/themeStore';
import GridLayer from './GridLayer';
import WireLayer from './WireLayer';
import SwitchSymbol from '../Components/SwitchSymbol';
import MCBSymbol from '../Components/MCBSymbol';
import BreakerSymbol from '../Components/BreakerSymbol';
import SocketSymbol from '../Components/SocketSymbol';
import LoadSymbol from '../Components/LoadSymbol';
import BusbarSymbol from '../Components/BusbarSymbol';
import PowerSourceSymbol from '../Components/PowerSourceSymbol';
import JunctionSymbol from '../Components/JunctionSymbol';
import ControlSymbol from '../Components/ControlSymbol';
import type { CircuitComponent, ComponentType } from '../../types';
import { snapToGrid, distance, rotatePoint } from '../../utils/geometry';

const CircuitCanvas: React.FC = () => {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const theme = useThemeStore((s) => s.theme);
  const tc = themeColors[theme];

  const {
    circuit,
    simulationResult,
    selectedId,
    tool,
    wireInProgress,
    wirePoints,
    setSelected,
    moveComponent,
    toggleComponent,
    resetTripped,
    removeComponent,
    removeWire,
    startWire,
    addWirePoint,
    finishWire,
    cancelWire,
    setZoom,
    setPan,
    addComponent,
  } = useCircuitStore();

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const getStagePointerPosition = useCallback(() => {
    if (!stageRef.current) return null;
    const pos = stageRef.current.getPointerPosition();
    if (!pos) return null;
    return {
      x: (pos.x - circuit.panX) / circuit.zoom,
      y: (pos.y - circuit.panY) / circuit.zoom,
    };
  }, [circuit.panX, circuit.panY, circuit.zoom]);

  const findNearestConnectionPoint = useCallback(
    (x: number, y: number): {
      componentId: string;
      pointId: string;
      dist: number;
    } | null => {
      let nearest: {
        componentId: string;
        pointId: string;
        dist: number;
      } | null = null;

      for (const comp of circuit.components) {
        for (const cp of comp.connectionPoints) {
          const rotated = rotatePoint(cp.x, cp.y, comp.rotation);
          const absX = comp.x + rotated.x;
          const absY = comp.y + rotated.y;
          const dist = distance(x, y, absX, absY);
          if (dist < 15 && (!nearest || dist < nearest.dist)) {
            nearest = {
              componentId: comp.id,
              pointId: cp.id,
              dist,
            };
          }
        }
      }

      return nearest;
    },
    [circuit.components]
  );

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === stageRef.current) {
        if (tool === 'wire' && wireInProgress) {
          const pos = getStagePointerPosition();
          if (!pos) return;

          const nearest = findNearestConnectionPoint(pos.x, pos.y);
          if (nearest) {
            finishWire(nearest.componentId, nearest.pointId);
          } else {
            const gridSize = circuit.gridSize;
            addWirePoint(
              snapToGrid(pos.x, gridSize),
              snapToGrid(pos.y, gridSize)
            );
          }
        } else if (tool === 'select') {
          setSelected(null);
        }
      }
    },
    [
      tool,
      wireInProgress,
      getStagePointerPosition,
      findNearestConnectionPoint,
      finishWire,
      addWirePoint,
      setSelected,
      circuit.gridSize,
    ]
  );

  const handleMouseMove = useCallback(
    () => {
      if (tool === 'wire' && wireInProgress) {
        const pos = getStagePointerPosition();
        if (pos) setCursorPos(pos);
      }
    },
    [tool, wireInProgress, getStagePointerPosition]
  );

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const scaleBy = 1.08;
      const newZoom =
        e.evt.deltaY < 0
          ? circuit.zoom * scaleBy
          : circuit.zoom / scaleBy;
      setZoom(newZoom);
    },
    [circuit.zoom, setZoom]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData(
        'componentType'
      ) as ComponentType;
      if (!type) return;

      const stage = stageRef.current;
      if (!stage) return;

      const rect = (
        e.target as HTMLElement
      ).closest('.circuit-canvas-container')?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left - circuit.panX) / circuit.zoom;
      const y = (e.clientY - rect.top - circuit.panY) / circuit.zoom;

      addComponent(
        type,
        snapToGrid(x, circuit.gridSize),
        snapToGrid(y, circuit.gridSize)
      );
    },
    [addComponent, circuit.panX, circuit.panY, circuit.zoom, circuit.gridSize]
  );

  const handleConnectionPointClick = useCallback(
    (componentId: string, pointId: string) => {
      if (tool !== 'wire') return;
      if (!wireInProgress) {
        startWire(componentId, pointId);
      } else {
        finishWire(componentId, pointId);
      }
    },
    [tool, wireInProgress, startWire, finishWire]
  );

  const handleComponentSelect = useCallback(
    (id: string) => {
      if (tool === 'delete') {
        removeComponent(id);
      } else {
        setSelected(id);
      }
    },
    [tool, removeComponent, setSelected]
  );

  const renderComponent = (comp: CircuitComponent) => {
    const nodeResult = simulationResult?.nodes[comp.id];
    const isSelected = selectedId === comp.id;
    const showCP = tool === 'wire' || isSelected;

    const commonProps = {
      component: comp,
      nodeResult,
      selected: isSelected,
      showConnectionPoints: showCP,
      onSelect: () => handleComponentSelect(comp.id),
      onDragEnd: (x: number, y: number) => moveComponent(comp.id, x, y),
    };

    switch (comp.type) {
      case 'switch':
      case 'push_button':
        return (
          <SwitchSymbol
            key={comp.id}
            {...commonProps}
            onToggle={() => toggleComponent(comp.id)}
          />
        );
      case 'mcb':
        return (
          <MCBSymbol
            key={comp.id}
            {...commonProps}
            onToggle={() => toggleComponent(comp.id)}
          />
        );
      case 'rcd':
        return (
          <BreakerSymbol
            key={comp.id}
            {...commonProps}
            onToggle={() => toggleComponent(comp.id)}
            onReset={() => resetTripped(comp.id)}
          />
        );
      case 'socket':
        return <SocketSymbol key={comp.id} {...commonProps} />;
      case 'lamp':
      case 'motor':
      case 'heater':
      case 'generic_load':
        return <LoadSymbol key={comp.id} {...commonProps} />;
      case 'busbar':
        return <BusbarSymbol key={comp.id} {...commonProps} />;
      case 'power_source':
        return <PowerSourceSymbol key={comp.id} {...commonProps} />;
      case 'junction':
        return <JunctionSymbol key={comp.id} {...commonProps} />;
      case 'contactor':
      case 'relay':
      case 'timer':
      case 'overload_relay':
        return (
          <ControlSymbol
            key={comp.id}
            {...commonProps}
            onToggle={() => toggleComponent(comp.id)}
          />
        );
      default:
        return null;
    }
  };

  // Handle keyboard for escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelWire();
        setSelected(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelWire, setSelected]);

  // Connection point click handlers on components
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const handleClick = () => {
      if (tool !== 'wire') return;
      const pos = getStagePointerPosition();
      if (!pos) return;
      const nearest = findNearestConnectionPoint(pos.x, pos.y);
      if (nearest) {
        handleConnectionPointClick(nearest.componentId, nearest.pointId);
      }
    };

    stage.on('click', handleClick);
    return () => {
      stage.off('click', handleClick);
    };
  }, [
    tool,
    getStagePointerPosition,
    findNearestConnectionPoint,
    handleConnectionPointClick,
  ]);

  return (
    <div
      ref={containerRef}
      className={`circuit-canvas-container flex-1 overflow-hidden`}
      style={{ backgroundColor: tc.canvasHex }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        scaleX={circuit.zoom}
        scaleY={circuit.zoom}
        x={circuit.panX}
        y={circuit.panY}
        onClick={handleStageClick}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        draggable={tool === 'pan'}
        onDragEnd={() => {
          if (stageRef.current) {
            setPan(stageRef.current.x(), stageRef.current.y());
          }
        }}
      >
        <GridLayer
          gridSize={circuit.gridSize}
          width={dimensions.width}
          height={dimensions.height}
          panX={circuit.panX}
          panY={circuit.panY}
          zoom={circuit.zoom}
          dotColor={tc.gridDot}
        />

        <WireLayer
          wires={circuit.wires}
          selectedId={selectedId}
          onSelectWire={(id) => {
            if (tool === 'delete') {
              removeWire(id);
            } else {
              setSelected(id);
            }
          }}
          wireInProgress={!!wireInProgress}
          wirePoints={wirePoints}
          cursorPos={cursorPos}
        />

        <Layer>
          {circuit.components.map(renderComponent)}
        </Layer>
      </Stage>
    </div>
  );
};

export default CircuitCanvas;
