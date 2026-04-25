import React from 'react';
import { Layer, Circle } from 'react-konva';

interface Props {
  gridSize: number;
  width: number;
  height: number;
  panX: number;
  panY: number;
  zoom: number;
}

const GridLayer: React.FC<Props> = ({
  gridSize,
  width,
  height,
  panX,
  panY,
  zoom,
}) => {
  const dots: { x: number; y: number }[] = [];

  const startX = -Math.ceil(panX / zoom / gridSize) * gridSize;
  const startY = -Math.ceil(panY / zoom / gridSize) * gridSize;
  const endX = startX + Math.ceil(width / zoom / gridSize + 2) * gridSize;
  const endY = startY + Math.ceil(height / zoom / gridSize + 2) * gridSize;

  for (let x = startX; x <= endX; x += gridSize) {
    for (let y = startY; y <= endY; y += gridSize) {
      dots.push({ x, y });
    }
  }

  return (
    <Layer listening={false}>
      {dots.map((dot, i) => (
        <Circle
          key={i}
          x={dot.x}
          y={dot.y}
          radius={1}
          fill="#D1D5DB"
        />
      ))}
    </Layer>
  );
};

export default React.memo(GridLayer);
