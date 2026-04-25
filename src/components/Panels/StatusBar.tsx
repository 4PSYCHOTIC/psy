import React from 'react';
import { useCircuitStore } from '../../store/circuitStore';

const StatusBar: React.FC = () => {
  const { circuit, simulationResult, tool } = useCircuitStore();

  const totalPower = simulationResult?.totalPowerW || 0;
  const totalCurrent = simulationResult?.totalCurrentA || 0;
  const faultCount = simulationResult?.faults.length || 0;
  const compCount = circuit.components.length;
  const wireCount = circuit.wires.length;

  return (
    <div className="h-7 bg-[#1E1E2E] text-gray-400 flex items-center px-3 text-xs gap-6 border-t border-gray-700 select-none">
      <span>
        Tool: <span className="text-gray-200 capitalize">{tool}</span>
      </span>
      <span>
        Components: <span className="text-gray-200">{compCount}</span>
      </span>
      <span>
        Wires: <span className="text-gray-200">{wireCount}</span>
      </span>
      <span>
        Zoom: <span className="text-gray-200">{(circuit.zoom * 100).toFixed(0)}%</span>
      </span>
      <div className="flex-1" />
      <span>
        Total Power:{' '}
        <span className="text-yellow-400">{totalPower.toFixed(1)}W</span>
      </span>
      <span>
        Total Current:{' '}
        <span className="text-blue-400">{totalCurrent.toFixed(2)}A</span>
      </span>
      {faultCount > 0 && (
        <span className="text-red-400 font-medium animate-pulse">
          ⚠ {faultCount} Fault{faultCount > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
};

export default StatusBar;
