import React from 'react';
import { Line, Circle } from 'react-konva';
import type { Wire } from '../../types';
import { getWireColor, getWireWidth } from '../../utils/geometry';

interface Props {
  wire: Wire;
  onSelect: () => void;
  selected: boolean;
}

const WireSegment: React.FC<Props> = ({ wire, onSelect, selected }) => {
  const color = getWireColor(wire.color);
  const width = getWireWidth(wire.crossSection);
  const opacity = wire.energized ? 1 : 0.4;

  return (
    <>
      <Line
        points={wire.points}
        stroke={color}
        strokeWidth={selected ? width + 2 : width}
        opacity={opacity}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={10}
        onClick={(e) => {
          e.cancelBubble = true;
          onSelect();
        }}
        shadowColor={wire.energized ? color : undefined}
        shadowBlur={wire.energized ? 4 : 0}
      />
      {selected && (
        <>
          {Array.from(
            { length: wire.points.length / 2 },
            (_, i) => (
              <Circle
                key={i}
                x={wire.points[i * 2]}
                y={wire.points[i * 2 + 1]}
                radius={3}
                fill="#3B82F6"
              />
            )
          )}
        </>
      )}
    </>
  );
};

export default WireSegment;
