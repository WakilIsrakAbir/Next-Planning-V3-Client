import type React from 'react';

// Square at the baseline (left), 4px round data-end (right).
export function roundedRight(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.min(r, w, h / 2);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}
// Square at the baseline (bottom), round top.
export function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export const svgStyle = { display: 'block' } as const;
export const axisText = (extra: React.CSSProperties = {}): React.CSSProperties => ({ fill: 'var(--am-muted)', fontSize: 11, fontVariantNumeric: 'tabular-nums', ...extra });
