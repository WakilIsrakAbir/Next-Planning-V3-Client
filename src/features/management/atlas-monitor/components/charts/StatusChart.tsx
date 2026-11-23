'use client';

import { useState } from 'react';
import type { MonitorStats, ShowTip, TipRow } from '@/features/management/atlas-monitor/types';
import { DEPT_LABELS, STATUS_SERIES } from '@/features/management/atlas-monitor/lib/monitor-constants';
import { fmtInt, pct } from '@/features/management/atlas-monitor/lib/format';
import { roundedRight, svgStyle } from '@/features/management/atlas-monitor/lib/chart-svg';
import { STATUS_LAYOUT, layoutStatusRows } from '@/features/management/atlas-monitor/lib/status-layout';

// Stacked horizontal bars: plan status per department (4 categorical series, fixed order).
// Every part above zero is drawn and every number is shown: inside its part when it fits,
// otherwise under the bar, beside a swatch of the part's colour.
export function StatusChart({ stats, width, showTip, hideTip }: { stats: MonitorStats; width: number; showTip: ShowTip; hideTip: () => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const fileUploaded = stats.orders.fileUploaded || {};
  const doneAllTime = stats.plans?.completed || {};
  const deps = DEPT_LABELS.map(([key, label]) => {
    const c = stats.orders.departments[key] || {};
    return { key, label, c, total: STATUS_SERIES.reduce((a, [k]) => a + (c[k] || 0), 0) };
  });
  const { barH, labelW } = STATUS_LAYOUT;
  const { rows, height } = layoutStatusRows(deps, width);
  const ariaLabel =
    'Plan status by department: ' +
    deps
      .map((d) => `${d.label} ${d.total} orders` + (d.total ? ' (' + STATUS_SERIES.map(([k]) => `${k} ${d.c[k] || 0}`).join(', ') + ')' : ''))
      .join('; ');

  return (
    <>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
        {STATUS_SERIES.map(([name, color]) => (
          <span key={name} className="inline-flex items-center gap-1.5 text-[11px] text-base-content/70">
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: `var(${color})` }} />
            {name}
          </span>
        ))}
      </div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={svgStyle} role="img" className="am-chart" aria-label={ariaLabel}>
        {rows.map(({ d, rowTop: y0, rowH, top, cy, segs, endX, chips, chipTop }) => (
          <g key={d.key}>
            {/* hover highlight */}
            <rect x={0} y={y0} width={width} height={rowH} rx={6} style={{ fill: hover === d.key ? 'var(--am-wash)' : 'transparent' }} />
            <text x={labelW - 10} y={cy + 4} textAnchor="end" style={{ fill: 'var(--am-ink2)', fontSize: 12 }}>
              {d.label}
            </text>
            {!d.total ? (
              <text x={labelW} y={cy + 4} style={{ fill: 'var(--am-muted)', fontSize: 11 }}>
                {fileUploaded[d.key] === false ? `No ${d.label} file uploaded yet` : 'No orders in the latest file'}
              </text>
            ) : (
              <>
                {segs.map((s) =>
                  s.last ? (
                    <path key={s.k} d={roundedRight(s.x, top, s.w, barH, 4)} style={{ fill: `var(${s.color})` }} />
                  ) : (
                    <rect key={s.k} x={s.x} y={top} width={s.w} height={barH} style={{ fill: `var(${s.color})` }} />
                  )
                )}
                {segs
                  .filter((s) => s.fits)
                  .map((s) => (
                    <text
                      key={'t' + s.k}
                      x={s.x + 6}
                      y={cy + 4}
                      style={{ fill: `var(${s.on})`, fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}
                    >
                      {fmtInt(s.n)}
                    </text>
                  ))}
                <text x={endX + 6} y={cy + 4} style={{ fill: 'var(--am-ink2)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtInt(d.total)}
                </text>
                {chips.map((c) => (
                  <g key={'c' + c.s.k} transform={`translate(${c.x},${chipTop})`}>
                    <rect x={0} y={1} width={8} height={8} rx={2} style={{ fill: `var(${c.s.color})` }} />
                    <text x={12} y={9} style={{ fill: 'var(--am-ink2)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtInt(c.s.n)}
                    </text>
                  </g>
                ))}
                {/* The whole row is the hover target, so even a 3px part is easy to reach. */}
                <rect
                  x={0}
                  y={y0}
                  width={width}
                  height={rowH}
                  style={{ fill: 'transparent' }}
                  onPointerMove={(e) => {
                    setHover(d.key);
                    const tipRows: TipRow[] = STATUS_SERIES.map(([k, color]) => ({ value: fmtInt(d.c[k] || 0), label: `${k} · ${pct(d.c[k] || 0, d.total)}%`, color }));
                    tipRows.push({ value: fmtInt(d.total), label: 'orders in the latest file' });
                    if (doneAllTime[d.key] !== undefined) tipRows.push({ value: fmtInt(doneAllTime[d.key]), label: 'completed, all time' });
                    showTip(e.clientX, e.clientY, d.label, tipRows);
                  }}
                  onPointerLeave={() => {
                    setHover(null);
                    hideTip();
                  }}
                />
              </>
            )}
          </g>
        ))}
      </svg>
      {stats.plans?.completed && (
        <p className="text-[11px] text-base-content/70 mt-2 leading-relaxed">
          <span className="font-semibold text-base-content">Completed plans, all time: </span>
          {DEPT_LABELS.map(([key, label]) => `${label} ${fmtInt(doneAllTime[key])}`).join(' · ')}
          <span className="text-base-content/50">. Most completed orders are no longer in the latest file, so the bars above show only a few.</span>
        </p>
      )}
    </>
  );
}
