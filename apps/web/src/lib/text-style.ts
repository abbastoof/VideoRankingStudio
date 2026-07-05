/**
 * CSS approximation of the export rasterizer's outer glyph stroke:
 * an 8-direction hard text-shadow. Width is design-space px.
 */
export function strokeShadow(width: number, color: string): string {
  const w = Math.max(1, Math.round(width * 0.6));
  const dirs = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
  ];
  return dirs.map(([x, y]) => `${x! * w}px ${y! * w}px 0 ${color}`).join(', ');
}
