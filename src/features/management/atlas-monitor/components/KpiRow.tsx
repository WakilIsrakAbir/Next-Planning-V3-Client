'use client';

import type { MonitorStats } from '@/features/management/atlas-monitor/types';
import { fmtInt, fmtMB } from '@/features/management/atlas-monitor/lib/format';

export function KpiRow({ stats }: { stats: MonitorStats }) {
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
