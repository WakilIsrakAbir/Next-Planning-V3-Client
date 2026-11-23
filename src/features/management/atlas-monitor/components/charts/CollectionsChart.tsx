'use client';

import { useState } from 'react';
import type { MonitorStats, ShowTip } from '@/features/management/atlas-monitor/types';
import { fmtInt, fmtMB } from '@/features/management/atlas-monitor/lib/format';
import { roundedRight, svgStyle } from '@/features/management/atlas-monitor/lib/chart-svg';

export function CollectionsChart({ stats, width, showTip, hideTip }: { stats: MonitorStats; width: number; showTip: ShowTip; hideTip: () => void }) {
  const rows = [...(stats.collections || [])].sort((a, b) => b.size - a.size);
  const rowH = 26;
  const barH = 12;
  const labelW = Math.min(150, Math.max(110, width * 0.28));
  const valueW = 70;
  const height = rows.length * rowH + 8;
  const pw = Math.max(40, width - labelW - valueW);
  const max = Math.max(1, ...rows.map((r) => r.size));
  const [hover, setHover] = useState<string | null>(null);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={svgStyle}
      role="img"
      className="am-chart"
      aria-label={rows[0] ? `Data size by collection, largest ${rows[0].name} ${fmtMB(rows[0].size)}` : 'No collections'}
    >
      <line x1={labelW} x2={labelW} y1={0} y2={height - 4} style={{ stroke: 'var(--am-axis)', strokeWidth: 1 }} />
      {rows.map((r, i) => {
        const cy = 4 + i * rowH + rowH / 2;
        const w = r.size > 0 ? Math.max(2, (r.size / max) * pw) : 0;
        return (
          <g key={r.name}>
            <text x={labelW - 8} y={cy + 4} textAnchor="end" style={{ fill: 'var(--am-ink2)', fontSize: 11 }}>
              {r.name}
            </text>
            {w > 0 && (
              <path d={roundedRight(labelW, cy - barH / 2, w, barH, 4)} style={{ fill: 'var(--am-s1)', opacity: hover === r.name ? 0.8 : 1 }} />
            )}
            <text x={labelW + w + 6} y={cy + 4} style={{ fill: 'var(--am-ink)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
              {fmtMB(r.size)}
            </text>
            <rect
              x={0}
              y={cy - rowH / 2}
              width={width}
              height={rowH}
              style={{ fill: 'transparent' }}
              onPointerMove={(e) => {
                setHover(r.name);
                showTip(e.clientX, e.clientY, r.name, [
                  { value: fmtMB(r.size), label: 'data', color: '--am-s1' },
                  { value: fmtInt(r.count), label: 'documents' },
                  { value: fmtMB(r.storageSize), label: `on disk (${fmtMB(r.freeStorageSize)} free)` },
                  { value: fmtMB(r.indexSize), label: `index (${r.indexes})` },
                ]);
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
