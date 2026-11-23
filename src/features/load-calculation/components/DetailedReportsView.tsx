'use client';

import { Download } from 'lucide-react';
import InlineSpinner from '@/components/ui/InlineSpinner';
import { LOAD_DEPTS } from '@/features/load-calculation/lib/load-report-config';

export function DetailedReportsView({
  downloadingDept,
  downloadDetailedExcel,
}: {
  downloadingDept: string | null;
  downloadDetailedExcel: (deptKey: string) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-lg p-4 text-xs text-slate-700 dark:text-slate-300">
        <strong>Note:</strong> Download item-level detailed load reports for Knitting, Dyeing, and Delivery. Data is generated based on your confirmed and tentative plans.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {LOAD_DEPTS.map((d) => (
          <div
            key={d.key}
            className="card bg-base-100 border border-base-300 p-5 shadow-sm hover:shadow-md transition-shadow space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-base-content">{d.label} Detailed Load</h3>
              <span className="badge badge-primary badge-outline text-xs font-bold uppercase">{d.key}</span>
            </div>

            <p className="text-xs text-base-content/60">
              Item-level detailed machine allocation mapping pending quantities across 5 projection months.
            </p>

            <div className="text-[11px] bg-base-200/50 p-2.5 rounded text-base-content/70">
              <span className="font-semibold">Pending Metric:</span> {d.pendingQtyField}
            </div>

            <button
              onClick={() => downloadDetailedExcel(d.key)}
              disabled={downloadingDept === d.key}
              className={`btn btn-sm w-full gap-2 font-bold shadow-md ${d.colorClass}`}
            >
              {downloadingDept === d.key ? (
                <InlineSpinner size={14} />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download {d.label} Load Excel
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
