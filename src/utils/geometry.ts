export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function getWireColor(color: string): string {
  const colors: Record<string, string> = {
    brown: '#8B4513',
    blue: '#2563EB',
    green_yellow: '#22C55E',
    black: '#1F2937',
    grey: '#6B7280',
    red: '#DC2626',
  };
  return colors[color] || '#1F2937';
}

export function getWireWidth(crossSection: number): number {
  const widths: Record<number, number> = {
    1.5: 2,
    2.5: 3,
    4: 4,
    6: 5,
    10: 6,
  };
  return widths[crossSection] || 3;
}
