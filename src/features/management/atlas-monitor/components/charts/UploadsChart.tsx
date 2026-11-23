'use client';

import { useState } from 'react';
import type { MonitorStats, ShowTip, TipRow } from '@/features/management/atlas-monitor/types';
import { fmtDay, fmtInt, niceStep } from '@/features/management/atlas-monitor/lib/format';
import { axisText, roundedTop, svgStyle } from '@/features/management/atlas-monitor/lib/chart-svg';

export function UploadsChart({ stats, width, showTip, hideTip }: { stats: MonitorStats; width: number; showTip: ShowTip; hideTip: () => void }) {
  const days = stats.uploads.perDay || [];
  const height = 220;
  const m = { l: 36, r: 10, t: 12, b: 28 };
  const pw = width - m.l - m.r;
  const ph = height - m.t - m.b;
  const maxN = Math.max(1, ...days.map((d) => d.total));
  const step = Math.max(1, Math.ceil(niceStep(maxN, 4)));
  const top = Math.ceil(maxN / step) * step;
  const y = (v: number) => m.t + ph - (v / top) * ph;
  const band = pw / Math.max(1, days.length);
  const colW = Math.min(24, Math.max(3, band * 0.62));
  const total = days.reduce((a, d) => a + d.total, 0);
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={svgStyle} role="img" className="am-chart" aria-label={`${total} files uploaded in the last 30 days`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={m.l} x2={m.l + pw} y1={y(v)} y2={y(v)} style={{ stroke: `var(${v === 0 ? '--am-axis' : '--am-grid'})`, strokeWidth: 1 }} />
          <text x={m.l - 6} y={y(v) + 4} textAnchor="end" style={axisText()}>
            {v}
          </text>
        </g>
      ))}
      {days.map((d, i) => {
        const cx = m.l + band * i + band / 2;
        return (
          <g key={d.day}>
            {d.total > 0 && (
              <path d={roundedTop(cx - colW / 2, y(d.total), colW, m.t + ph - y(d.total), 4)} style={{ fill: 'var(--am-s1)', opacity: hover === i ? 0.8 : 1 }} />
            )}
            {/* weekly labels counted back from today, so the last label never collides with another */}
            {(days.length - 1 - i) % 7 === 0 && (
              <text x={cx} y={height - 8} textAnchor={i === days.length - 1 ? 'end' : 'middle'} style={axisText()}>
                {fmtDay(d.day)}
              </text>
            )}
            <rect
              x={cx - band / 2}
              y={m.t}
              width={band}
              height={ph}
              style={{ fill: 'transparent' }}
              onPointerMove={(e) => {
                setHover(i);
                const rows: TipRow[] = [{ value: fmtInt(d.total), label: d.total === 1 ? 'file' : 'files', color: '--am-s1' }];
                Object.entries(d.byCategory || {})
                  .sort((a, b) => b[1] - a[1])
                  .forEach(([c, n]) => rows.push({ value: fmtInt(n), label: c }));
                showTip(e.clientX, e.clientY, fmtDay(d.day, true), rows);
              }}
              onPointerLeave={() => {
                setHover(null);
                hideTip();
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}
