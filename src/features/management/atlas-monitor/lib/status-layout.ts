import { STATUS_SERIES } from '@/features/management/atlas-monitor/lib/monitor-constants';
import { fmtInt } from '@/features/management/atlas-monitor/lib/format';

// Part widths proportional to the values within `full` (less the gaps), each at least `min`,
// so a small number is drawn small but never disappears.
export function segmentWidths(values: number[], full: number, gap: number, min: number): number[] {
  const room = Math.max(0, full - gap * (values.length - 1));
  const fixed = new Set<number>();
  for (;;) {
    const freeSum = values.reduce((a, v, i) => (fixed.has(i) ? a : a + v), 0);
    const free = room - fixed.size * min;
    const w = values.map((v, i) => (fixed.has(i) ? min : (free * v) / freeSum));
    const small = values.map((_, i) => i).filter((i) => !fixed.has(i) && w[i] < min);
    if (!small.length) return w;
    small.forEach((i) => fixed.add(i));
  }
}
// Width of an 11px tabular number, for the "does it fit inside its part" check.
export const numberWidth = (text: string): number => text.length * 6.8;

// Sizes of the plan status chart.
export const STATUS_LAYOUT = { barH: 22, padY: 8, labelW: 76, valueW: 54, gap: 2, minSeg: 3, chipGap: 10 };
export type StatusDept = { key: string; label: string; c: Record<string, number>; total: number };

// Layout of the plan status rows (plain numbers; the chart only draws them).
export function layoutStatusRows(deps: StatusDept[], width: number) {
  const { barH, padY, labelW, valueW, gap, minSeg, chipGap } = STATUS_LAYOUT;
  const pw = Math.max(60, width - labelW - valueW);
  const max = Math.max(1, ...deps.map((d) => d.total));
  let rowTop = 2;
  const rows = [];
  for (const d of deps) {
    let rowH = barH + padY * 2;
    const top = rowTop + padY;
    const cy = top + barH / 2;
    const parts = STATUS_SERIES.map(([k, color, on]) => ({ k, color, on, n: d.c[k] || 0 })).filter((p) => p.n > 0);
    const widths = d.total ? segmentWidths(parts.map((p) => p.n), (d.total / max) * pw, gap, minSeg) : [];
    const segs = [];
    let x0 = labelW;
    for (let j = 0; j < parts.length; j++) {
      const p = parts[j];
      segs.push({ ...p, x: x0, w: widths[j], last: j === parts.length - 1, fits: numberWidth(fmtInt(p.n)) + 12 <= widths[j] });
      x0 += widths[j] + gap;
    }
    const endX = x0 - gap;
    // One line under the bar for the numbers that do not fit: each starts under its own part,
    // pushed right so they never overlap, and pulled back in at the right edge.
    const chips = segs.filter((sg) => !sg.fits).map((sg) => ({ s: sg, x: sg.x, w: 12 + numberWidth(fmtInt(sg.n)) }));
    let prevEnd = -Infinity;
    for (const c of chips) {
      c.x = Math.max(c.x, prevEnd + chipGap);
      prevEnd = c.x + c.w;
    }
    let limit = width - 2;
    for (let i = chips.length - 1; i >= 0; i--) {
      chips[i].x = Math.max(labelW, Math.min(chips[i].x, limit - chips[i].w));
      limit = chips[i].x - chipGap;
    }
    if (chips.length) rowH += 17;
    rows.push({ d, rowTop, rowH, top, cy, segs, endX, chips, chipTop: top + barH + 5 });
    rowTop += rowH;
  }
  return { rows, height: rowTop + 2 };
}
