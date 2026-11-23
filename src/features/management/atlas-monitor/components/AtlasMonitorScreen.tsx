'use client';

/*
 * Data Management > Atlas Monitor: database health (GET /api/monitor/stats) drawn as SVG charts, and the full
 * database backup download (GET /api/monitor/backup, Admin only).
 * V3 shares its database with the old app (Shimul Mama Project V2), which has the same page: both show the same
 * numbers, the same daily history and the same "last backup".
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Download,
  HeartPulse,
  RefreshCw,
  ShieldAlert,
  Table as TableIcon,
} from 'lucide-react';
import { API_BASE } from '@/lib/constants';
import { apiClient } from '@/lib/api-client';
import { batchHasMenu } from '@/features/batch/lib/batch-navigation';

// ---------- response of GET /api/monitor/stats ----------
interface CollectionStat {
  name: string;
  count: number;
  size: number;
  storageSize: number;
  freeStorageSize: number;
  indexSize: number;
  indexes: number;
}
interface Snapshot {
  day: string;
  dataSize: number;
  indexSize: number;
  storageSize: number;
}
interface UploadCategory {
  category: string;
  uploads: number;
  copiesDeleted: number;
  copiesKept: number;
  copyBytes: number;
  lastAt: string;
  lastBy: string;
}
interface UploadDay {
  day: string;
  total: number;
  byCategory: Record<string, number>;
}
interface MonitorStats {
  generatedAt: string;
  canDownloadBackup: boolean;
  database: {
    name: string;
    serverVersion: string;
    dataSize: number;
    indexSize: number;
    storageSize: number;
    freeStorageSize: number;
    objects: number;
    collections: number;
    limitBytes: number;
  };
  collections: CollectionStat[];
  orders: {
    total: number;
    active: number;
    departments: Record<string, Record<string, number>>;
    // false when that department's file was never uploaded (Finishing, for one)
    fileUploaded?: Record<string, boolean>;
  };
  plans: { saved: number; completed: Record<string, number> };
  users: { total: number; online: number };
  uploads: { categories: UploadCategory[]; perDay: UploadDay[] };
  history: Snapshot[];
  backups: { last: { at: string; by: string; bytes: number } | null; count: number };
}

// Plan status series in their fixed colour order (validated palette, see globals.css .am-root).
const STATUS_SERIES: [string, string, string][] = [
  ['Confirm', '--am-s1', '--am-on-s1'],
  ['Tentative', '--am-s2', '--am-on-s2'],
  ['Pending', '--am-s3', '--am-on-s3'],
  ['Completed', '--am-s4', '--am-on-s4'],
];
const DEPT_LABELS: [string, string][] = [
  ['yd', 'YD'],
  ['knitting', 'Knitting'],
  ['dyeing', 'Dyeing'],
  ['finishing', 'Finishing'],
  ['delivery', 'Delivery'],
];

// ---------- formatting ----------
const MB = 1024 * 1024; // the Atlas cluster card shows its 512 MB limit in these units
function fmtMB(bytes: number | undefined | null): string {
  if (!bytes) return '0 MB';
  const v = bytes / MB;
  if (v < 0.1) {
    // small sizes keep their real value, in KB
    const kb = bytes / 1024;
    return (kb < 10 ? String(Math.round(kb * 10) / 10) : Math.round(kb).toLocaleString('en-US')) + ' KB';
  }
  return (v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1)) + ' MB';
}
const fmtInt = (n: number | undefined | null): string => Number(n || 0).toLocaleString('en-US');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(day: string, withYear = false): string {
  const [y, m, d] = String(day).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ' ' + y : ''}`;
}
function fmtDateTime(iso: string | undefined | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}
const pct = (part: number, whole: number): number => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
const errorText = (e: unknown, fallback: string): string => (e instanceof Error && e.message ? e.message : fallback);
const niceStep = (max: number, ticks: number): number => {
  const raw = max / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => st >= raw) || raw;
};
// Square at the baseline (left), 4px round data-end (right).
function roundedRight(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.min(r, w, h / 2);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}
// Square at the baseline (bottom), round top.
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

// ---------- tooltip ----------
interface TipRow {
  value: string;
  label?: string;
  color?: string;
}
interface TipState {
  x: number;
  y: number;
  title: string;
  rows: TipRow[];
}
type ShowTip = (x: number, y: number, title: string, rows: TipRow[]) => void;

function Tooltip({ tip }: { tip: TipState | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!tip || !ref.current) return;
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;
    let left = tip.x + 14;
    let top = tip.y - h - 10;
    if (left + w > window.innerWidth - 8) left = tip.x - w - 14;
    if (top < 8) top = tip.y + 16;
    setPos({ left: Math.max(8, left), top });
  }, [tip]);
  if (!tip) return null;
  return (
    <div ref={ref} role="status" className="am-tip" style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}>
      {tip.title && <div className="am-tip-l">{tip.title}</div>}
      {tip.rows.map((r, i) => (
        <div key={i} className="am-tip-row">
          {r.color && <span className="am-key" style={{ background: `var(${r.color})` }} />}
          <span className="am-tip-v">{r.value}</span>
          {r.label && <span className="am-tip-l">{r.label}</span>}
        </div>
      ))}
    </div>
  );
}

// Width of an element, kept up to date (charts are drawn for the space they have).
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const update = () => setWidth(Math.floor(el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

const svgStyle = { display: 'block' } as const;
const axisText = (extra: React.CSSProperties = {}): React.CSSProperties => ({ fill: 'var(--am-muted)', fontSize: 11, fontVariantNumeric: 'tabular-nums', ...extra });

// ---------- charts ----------
function HistoryChart({ stats, width, showTip, hideTip }: { stats: MonitorStats; width: number; showTip: ShowTip; hideTip: () => void }) {
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

function CollectionsChart({ stats, width, showTip, hideTip }: { stats: MonitorStats; width: number; showTip: ShowTip; hideTip: () => void }) {
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

// Part widths proportional to the values within `full` (less the gaps), each at least `min`,
// so a small number is drawn small but never disappears.
function segmentWidths(values: number[], full: number, gap: number, min: number): number[] {
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
const numberWidth = (text: string): number => text.length * 6.8;

// Sizes of the plan status chart.
const STATUS_LAYOUT = { barH: 22, padY: 8, labelW: 76, valueW: 54, gap: 2, minSeg: 3, chipGap: 10 };
type StatusDept = { key: string; label: string; c: Record<string, number>; total: number };

// Layout of the plan status rows (plain numbers; the chart only draws them).
function layoutStatusRows(deps: StatusDept[], width: number) {
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

// Stacked horizontal bars: plan status per department (4 categorical series, fixed order).
// Every part above zero is drawn and every number is shown: inside its part when it fits,
// otherwise under the bar, beside a swatch of the part's colour.
function StatusChart({ stats, width, showTip, hideTip }: { stats: MonitorStats; width: number; showTip: ShowTip; hideTip: () => void }) {
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

function UploadsChart({ stats, width, showTip, hideTip }: { stats: MonitorStats; width: number; showTip: ShowTip; hideTip: () => void }) {
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

// Table view of each chart: the same numbers, no colour needed.
function ChartTable({ id, stats }: { id: string; stats: MonitorStats }) {
  let head: string[] = [];
  let rows: (string | number)[][] = [];
  if (id === 'history') {
    head = ['Day', 'Used (data + index)', 'Data', 'Index', 'Disk', 'Of limit'];
    rows = [...(stats.history || [])].reverse().map((p) => [
      fmtDay(p.day, true),
      fmtMB(p.dataSize + p.indexSize),
      fmtMB(p.dataSize),
      fmtMB(p.indexSize),
      fmtMB(p.storageSize),
      pct(p.dataSize + p.indexSize, stats.database.limitBytes) + '%',
    ]);
  } else if (id === 'collections') {
    head = ['Collection', 'Documents', 'Data', 'On disk', 'Free inside', 'Index'];
    rows = [...stats.collections].sort((a, b) => b.size - a.size).map((c) => [c.name, fmtInt(c.count), fmtMB(c.size), fmtMB(c.storageSize), fmtMB(c.freeStorageSize), fmtMB(c.indexSize)]);
  } else if (id === 'status') {
    const done = stats.plans?.completed || {};
    head = ['Department', ...STATUS_SERIES.map(([k]) => k), 'Total', 'Completed (all time)'];
    rows = DEPT_LABELS.map(([key, label]) => {
      const c = stats.orders.departments[key] || {};
      const vals = STATUS_SERIES.map(([k]) => c[k] || 0);
      return [label, ...vals.map(fmtInt), fmtInt(vals.reduce((a, n) => a + n, 0)), done[key] === undefined ? '-' : fmtInt(done[key])];
    });
  } else {
    head = ['Day', 'Files', 'By category'];
    rows = [...(stats.uploads.perDay || [])].reverse().map((d) => [
      fmtDay(d.day, true),
      fmtInt(d.total),
      Object.entries(d.byCategory || {})
        .map(([c, n]) => `${c} ${n}`)
        .join(', ') || '-',
    ]);
  }
  const right = (i: number) => i > 0 && !(id === 'uploads' && i === 2);
  return (
    <div className="overflow-x-auto max-h-80 overflow-y-auto">
      <table className="am-table">
        <thead>
          <tr>
            {head.map((t, i) => (
              <th key={t} className={right(i) ? 'r' : ''}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((v, i) => (
                <td key={i} className={right(i) ? 'r' : ''}>
                  {String(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ChartId = 'history' | 'collections' | 'status' | 'uploads';
function ChartCard({
  id,
  title,
  subtitle,
  stats,
  showTip,
  hideTip,
}: {
  id: ChartId;
  title: string;
  subtitle: string;
  stats: MonitorStats;
  showTip: ShowTip;
  hideTip: () => void;
}) {
  const [table, setTable] = useState(false);
  const [ref, width] = useWidth<HTMLDivElement>();
  const w = Math.max(280, width || 600);
  const props = { stats, width: w, showTip, hideTip };
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm p-5 min-w-0">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-bold text-sm">{title}</div>
          <div className="text-[11px] text-base-content/60 mt-0.5">{subtitle}</div>
        </div>
        <button type="button" className="am-toggle" aria-pressed={table} onClick={() => setTable((t) => !t)}>
          <TableIcon className="w-3 h-3" /> Table
        </button>
      </div>
      <div ref={ref} className="w-full min-w-0">
        {table ? (
          <ChartTable id={id} stats={stats} />
        ) : width > 0 ? (
          id === 'history' ? (
            <HistoryChart {...props} />
          ) : id === 'collections' ? (
            <CollectionsChart {...props} />
          ) : id === 'status' ? (
            <StatusChart {...props} />
          ) : (
            <UploadsChart {...props} />
          )
        ) : null}
      </div>
    </div>
  );
}

// ---------- page ----------
export default function AtlasMonitorScreen() {
  // The dashboard renders pages only on the client (after the session check), so localStorage is readable here.
  const [allowed] = useState(() => batchHasMenu('dataManagement', 'atlasMonitor'));
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [loading, setLoading] = useState(allowed); // the first load starts at once
  const [error, setError] = useState<string | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const showTip = useCallback<ShowTip>((x, y, title, rows) => setTip({ x, y, title, rows }), []);
  const hideTip = useCallback(() => setTip(null), []);

  // Refresh button (and after a backup, to show it as the last backup).
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await apiClient<MonitorStats>('/api/monitor/stats'));
    } catch (e: unknown) {
      setError(errorText(e, 'Could not load database stats.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Without the permission the API is never called (a 403 would sign the user out).
    if (!allowed) return;
    let live = true;
    apiClient<MonitorStats>('/api/monitor/stats')
      .then((s) => {
        if (live) setStats(s);
      })
      .catch((e: unknown) => {
        if (live) setError(errorText(e, 'Could not load database stats.'));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [allowed]);

  if (!allowed) {
    return (
      <div className="card bg-base-100 border border-base-300 p-8 text-center max-w-xl mx-auto mt-10">
        <ShieldAlert className="w-8 h-8 mx-auto text-warning" />
        <h2 className="font-bold mt-3">Access denied</h2>
        <p className="text-xs text-base-content/60 mt-1">Atlas Monitor needs the Atlas Monitor permission (Data Management). Ask an Admin.</p>
      </div>
    );
  }

  return (
    <div className="am-root space-y-5 w-full max-w-375 mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-base-content/50 mb-1">Data Management › Atlas Monitor</div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <HeartPulse className="h-6 w-6" style={{ color: 'var(--am-s1)' }} />
            Atlas Monitor
          </h2>
          <p className="text-xs text-base-content/60 mt-1">
            {error
              ? `${error} Try Refresh.`
              : stats
                ? `Live from database "${stats.database.name}" (MongoDB ${stats.database.serverVersion || '-'}). Updated ${fmtDateTime(stats.generatedAt)}.`
                : 'Loading database health…'}
          </p>
        </div>
        <button type="button" className="btn btn-sm btn-outline gap-1" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {stats && (
        // While it reloads, the previous numbers stay on screen, dimmed.
        <div className="flex flex-col gap-5" style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .2s' }}>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <StorageCard stats={stats} />
            <BackupCard stats={stats} onDone={load} />
          </div>
          <KpiRow stats={stats} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <ChartCard id="history" title="Storage used over time" subtitle="Data + index, one reading per day. The line at 512 MB is the free-tier limit." stats={stats} showTip={showTip} hideTip={hideTip} />
            <ChartCard id="collections" title="Space by collection" subtitle="Data size of each collection, largest first." stats={stats} showTip={showTip} hideTip={hideTip} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <ChartCard id="status" title="Plan status by department" subtitle="Orders in each department's latest file, as the plan list tabs count them." stats={stats} showTip={showTip} hideTip={hideTip} />
            <ChartCard id="uploads" title="Files uploaded per day" subtitle="All categories, last 30 days." stats={stats} showTip={showTip} hideTip={hideTip} />
          </div>
          <UploadsTable stats={stats} />
        </div>
      )}
      <Tooltip tip={tip} />
    </div>
  );
}

function StorageCard({ stats }: { stats: MonitorStats }) {
  const d = stats.database;
  const used = d.dataSize + d.indexSize;
  const share = pct(used, d.limitBytes);
  const level =
    share >= 85
      ? { color: '--am-crit', icon: <AlertCircle className="w-3.5 h-3.5" style={{ color: 'var(--am-crit)' }} />, label: 'Almost full' }
      : share >= 70
        ? { color: '--am-warn', icon: <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--am-warn)' }} />, label: 'Getting full' }
        : { color: '--am-good', icon: <CheckCircle className="w-3.5 h-3.5" style={{ color: 'var(--am-good)' }} />, label: 'Healthy' };
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm p-5 xl:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-base-content/70">Atlas storage used (data + index)</div>
          <div className="flex items-baseline gap-2 mt-1 flex-wrap">
            <span className="font-semibold" style={{ fontSize: 48, lineHeight: 1 }}>
              {fmtMB(used)}
            </span>
            <span className="text-sm text-base-content/70">
              of {fmtMB(d.limitBytes)} · {share}%
            </span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border border-base-300">
          {level.icon}
          {level.label}
        </span>
      </div>
      <div className="mt-4 relative">
        <div
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={share}
          aria-label={`Storage used ${share}%`}
          style={{ height: 10, borderRadius: 999, background: 'var(--am-track)', overflow: 'hidden' }}
        >
          <div style={{ height: '100%', width: `${Math.min(100, share)}%`, background: `var(${share >= 70 ? level.color : '--am-s1'})`, borderRadius: 999 }} />
        </div>
        {/* 70% warning mark */}
        <div style={{ position: 'absolute', left: '70%', top: -3, width: 1, height: 16, background: 'var(--am-ink2)' }} />
      </div>
      <div className="relative text-[11px] text-base-content/60 mt-1" style={{ height: 16, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ position: 'absolute', left: 0 }}>0</span>
        <span style={{ position: 'absolute', left: '70%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>70% warning</span>
        <span style={{ position: 'absolute', right: 0 }}>{fmtMB(d.limitBytes)}</span>
      </div>
      <p className="text-xs text-base-content/70 mt-3 leading-relaxed">
        Atlas counts only data ({fmtMB(d.dataSize)}) and indexes ({fmtMB(d.indexSize)}) against the limit. The files on disk take {fmtMB(d.storageSize)}, of
        which {fmtMB(d.freeStorageSize)} is free space that new data reuses; disk size is not counted.
      </p>
    </div>
  );
}

function BackupCard({ stats, onDone }: { stats: MonitorStats; onDone: () => void }) {
  const [includeFiles, setIncludeFiles] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const last = stats.backups?.last;
  const copies = (stats.collections || []).filter((c) => c.name.startsWith('uploads.')).reduce((a, c) => a + c.size, 0);
  const total = (stats.collections || []).reduce((a, c) => a + c.size, 0);

  const download = async () => {
    setBusy(true);
    setStatus('Preparing backup…');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/monitor/backup?files=${includeFiles ? '1' : '0'}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok || !res.body) {
        let msg = 'Backup failed.';
        try {
          msg = (await res.json()).message || msg;
        } catch {}
        throw new Error(msg);
      }
      const name = (/filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '') || [])[1] || 'abir_group_backup.jsonl.gz';
      const reader = res.body.getReader();
      const parts: Uint8Array[] = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        got += value.length;
        setStatus(`Downloading… ${fmtMB(got)}`);
      }
      const blob = new Blob(parts as BlobPart[], { type: 'application/gzip' });
      // A complete backup ends with its "end" line; check before saving (browsers that cannot unzip skip this).
      if (typeof DecompressionStream === 'function') {
        setStatus('Checking the file…');
        const text = await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();
        const lastLine = text.trimEnd().split('\n').pop() || '';
        if (!lastLine.startsWith('{"type":"end"')) throw new Error('The download is incomplete. Please try again.');
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setStatus(`Saved ${name} (${fmtMB(blob.size)}). Keep this file private.`);
      setTimeout(onDone, 800); // show it as the last backup
    } catch (e: unknown) {
      setStatus(errorText(e, 'Backup failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 font-bold">
        <Download className="w-4 h-4" style={{ color: 'var(--am-s1)' }} /> Database backup
      </div>
      <p className="text-xs text-base-content/70 leading-relaxed">
        Downloads the whole database as one file to this PC. Keep it private: it holds all business data and the users&apos; password hashes.
      </p>
      <div className="text-xs text-base-content/70">
        {last ? `Last backup: ${fmtDateTime(last.at)} by ${last.by || '-'} (${fmtMB(last.bytes)})` : 'Last backup: none from this page yet'}
      </div>
      {stats.canDownloadBackup ? (
        <>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" className="checkbox checkbox-xs" checked={includeFiles} onChange={(e) => setIncludeFiles(e.target.checked)} />
            Include stored Excel copies ({fmtMB(copies)} of {fmtMB(total)} data)
          </label>
          <button type="button" className="am-btn-primary self-start" onClick={download} disabled={busy}>
            <Download className="w-3.5 h-3.5" /> Download backup
          </button>
          <div className="text-xs text-base-content/70 min-h-4" role="status">
            {status}
          </div>
        </>
      ) : (
        <p className="text-xs text-base-content/50">Only an Admin can download backups.</p>
      )}
    </div>
  );
}

function KpiRow({ stats }: { stats: MonitorStats }) {
  const d = stats.database;
  const o = stats.orders;
  const u = stats.users;
  const copies = (stats.uploads.categories || []).reduce((a, c) => ({ n: a.n + c.copiesKept, b: a.b + c.copyBytes }), { n: 0, b: 0 });
  const tiles: [string, string, string][] = [
    ['Data size', fmtMB(d.dataSize), `${fmtInt(d.objects)} documents`],
    ['Index size', fmtMB(d.indexSize), `${fmtInt(d.collections)} collections`],
    ['Disk files', fmtMB(d.storageSize), `${fmtMB(d.freeStorageSize)} free inside`],
    ['Orders', fmtInt(o.active), `active · ${fmtInt(o.total)} in total`],
    ['Saved plans', fmtInt(stats.plans.saved), 'orders with a saved plan'],
    ['Excel copies kept', fmtInt(copies.n), fmtMB(copies.b)],
    ['Users', fmtInt(u.total), `${fmtInt(u.online)} online now`],
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
      {tiles.map(([label, value, sub]) => (
        <div key={label} className="card bg-base-100 border border-base-300 shadow-sm px-4 py-3">
          <div className="text-xs text-base-content/70">{label}</div>
          <div className="text-xl font-semibold mt-0.5">{value}</div>
          <div className="text-[11px] text-base-content/50">{sub}</div>
        </div>
      ))}
    </div>
  );
}

function UploadsTable({ stats }: { stats: MonitorStats }) {
  const rows = stats.uploads.categories || [];
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm p-5">
      <div className="font-bold text-sm">Uploaded Excel copies</div>
      <div className="text-[11px] text-base-content/60 mt-0.5 mb-3">The app reads each file once when it is uploaded; the stored copies are only kept as a fallback.</div>
      <div className="overflow-x-auto">
        <table className="am-table">
          <thead>
            <tr>
              <th>Category</th>
              <th className="r">Copies kept</th>
              <th className="r">Size of copies</th>
              <th className="r">Uploads (all time)</th>
              <th className="r">Copies removed</th>
              <th>Last upload</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.category}>
                <td>{r.category}</td>
                <td className="r">{fmtInt(r.copiesKept)}</td>
                <td className="r">{fmtMB(r.copyBytes)}</td>
                <td className="r">{fmtInt(r.uploads)}</td>
                <td className="r">{fmtInt(r.copiesDeleted)}</td>
                <td>{fmtDateTime(r.lastAt)}</td>
                <td>{r.lastBy || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
