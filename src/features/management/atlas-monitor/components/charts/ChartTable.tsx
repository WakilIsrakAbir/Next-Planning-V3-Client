'use client';

import type { MonitorStats } from '@/features/management/atlas-monitor/types';
import { DEPT_LABELS, STATUS_SERIES } from '@/features/management/atlas-monitor/lib/monitor-constants';
import { fmtDay, fmtInt, fmtMB, pct } from '@/features/management/atlas-monitor/lib/format';

// Table view of each chart: the same numbers, no colour needed.
export function ChartTable({ id, stats }: { id: string; stats: MonitorStats }) {
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
