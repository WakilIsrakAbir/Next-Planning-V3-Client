'use client';

import { useState } from 'react';
import type { MonitorStats, ShowTip } from '@/features/management/atlas-monitor/types';
import { MB, fmtDay, fmtMB, niceStep, pct } from '@/features/management/atlas-monitor/lib/format';
import { axisText, svgStyle } from '@/features/management/atlas-monitor/lib/chart-svg';

export function HistoryChart({ stats, width, showTip, hideTip }: { stats: MonitorStats; width: number; showTip: ShowTip; hideTip: () => void }) {
  const pts = (stats.history || []).map((p) => ({ day: p.day, used: (p.dataSize || 0) + (p.indexSize || 0), p }));
  const limit = stats.database.limitBytes;
  const height = 320;
  const m = { l: 52, r: 70, t: 14, b: 28 };
  const pw = width - m.l - m.r;
  const ph = height - m.t - m.b;
  const maxV = Math.max(limit, ...pts.map((p) => p.used)) * 1.04;
  const step = niceStep(maxV / MB, 4) * MB;
  const y = (v: number) => m.t + ph - (v / maxV) * ph;
  const x = (i: number) => m.l + (pts.length <= 1 ? pw / 2 : (i / (pts.length - 1)) * pw);
  const [hover, setHover] = useState<number | null>(null);
  const last = pts[pts.length - 1];
  const li = pts.length - 1;
  const ticks: number[] = [];
  for (let v = 0; v <= maxV; v += step) ticks.push(v);
  const labelIdx = pts.length <= 1 ? [0] : Array.from(new Set([0, Math.floor((pts.length - 1) / 2), pts.length - 1]));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.used)}`).join('');

  const showAt = (i: number, cx: number, cy: number) => {
    const p = pts[i];
    setHover(i);
    showTip(cx, cy, fmtDay(p.day, true), [
      { value: fmtMB(p.used), label: 'used', color: '--am-s1' },
      { value: fmtMB(p.p.dataSize), label: 'data' },
      { value: fmtMB(p.p.indexSize), label: 'index' },
      { value: `${pct(p.used, limit)}%`, label: 'of limit' },
    ]);
  };
  const leave = () => {
    setHover(null);
    hideTip();
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={svgStyle}
      role="img"
      tabIndex={0}
      className="am-chart"
      aria-label={last ? `Storage used: ${fmtMB(last.used)} on ${fmtDay(last.day, true)}, limit ${fmtMB(limit)}` : 'No readings yet'}
      onFocus={(e) => {
        if (!last) return;
        const r = e.currentTarget.getBoundingClientRect();
        showAt(li, r.left + x(li), r.top + y(last.used));
      }}
      onBlur={leave}
      onKeyDown={(e) => {
        if (!pts.length || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
        e.preventDefault();
        const i = Math.max(0, Math.min(li, (hover ?? li) + (e.key === 'ArrowRight' ? 1 : -1)));
        const r = e.currentTarget.getBoundingClientRect();
        showAt(i, r.left + x(i), r.top + y(pts[i].used));
      }}
    >
      {ticks.map((v) => (
        <g key={v}>
          <line x1={m.l} x2={m.l + pw} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--am-grid)', strokeWidth: 1 }} />
          <text x={m.l - 8} y={y(v) + 4} textAnchor="end" style={axisText()}>
            {Math.round(v / MB)}
          </text>
        </g>
      ))}
      <text x={m.l - 8} y={m.t - 2} textAnchor="end" style={axisText({ fontSize: 10 })}>
        MB
      </text>
      {/* limit reference line: solid hairline, labelled */}
      <line x1={m.l} x2={m.l + pw} y1={y(limit)} y2={y(limit)} style={{ stroke: 'var(--am-crit)', strokeWidth: 1 }} />
      <text x={m.l + pw + 6} y={y(limit) + 4} style={{ fill: 'var(--am-ink2)', fontSize: 11 }}>
        Limit
      </text>
      <line x1={m.l} x2={m.l + pw} y1={m.t + ph} y2={m.t + ph} style={{ stroke: 'var(--am-axis)', strokeWidth: 1 }} />
      {pts.length > 0 &&
        labelIdx.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 8}
            textAnchor={pts.length <= 1 ? 'middle' : i === 0 ? 'start' : i === li ? 'end' : 'middle'}
            style={axisText()}
          >
            {fmtDay(pts[i].day)}
          </text>
        ))}
      {pts.length > 1 && (
        <>
          <path d={`${line}L${x(li)},${m.t + ph}L${x(0)},${m.t + ph}Z`} style={{ fill: 'var(--am-wash)', stroke: 'none' }} />
          <path d={line} style={{ fill: 'none', stroke: 'var(--am-s1)', strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
        </>
      )}
      {last && (
        <>
          <circle cx={x(li)} cy={y(last.used)} r={4} style={{ fill: 'var(--am-s1)', stroke: 'var(--am-card)', strokeWidth: 2 }} />
          <text x={x(li) + 8} y={y(last.used) + 4} style={{ fill: 'var(--am-ink)', fontSize: 12, fontWeight: 600 }}>
            {fmtMB(last.used)}
          </text>
        </>
      )}
      {pts.length === 1 && (
        <text x={m.l + pw / 2} y={y(limit) + 28} textAnchor="middle" style={{ fill: 'var(--am-muted)', fontSize: 11 }}>
          History starts today: one reading is saved each day the page is opened
        </text>
      )}
      {hover !== null && pts[hover] && (
        <>
          <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ph} style={{ stroke: 'var(--am-ink2)', strokeWidth: 1 }} />
          <circle cx={x(hover)} cy={y(pts[hover].used)} r={5} style={{ fill: 'var(--am-s1)', stroke: 'var(--am-card)', strokeWidth: 2 }} />
        </>
      )}
      {pts.length > 0 && (
        <rect
          x={m.l - 10}
          y={m.t}
          width={pw + 20}
          height={ph}
          style={{ fill: 'transparent', cursor: 'crosshair' }}
          onPointerMove={(e) => {
            const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
            const rel = e.clientX - r.left;
            const i = pts.length <= 1 ? 0 : Math.max(0, Math.min(li, Math.round(((rel - m.l) / pw) * li)));
            showAt(i, e.clientX, e.clientY);
          }}
          onPointerLeave={leave}
        />
      )}
    </svg>
  );
}
