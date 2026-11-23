'use client';

import type { MonitorStats } from '@/features/management/atlas-monitor/types';
import { fmtDateTime, fmtInt, fmtMB } from '@/features/management/atlas-monitor/lib/format';

export function UploadsTable({ stats }: { stats: MonitorStats }) {
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
