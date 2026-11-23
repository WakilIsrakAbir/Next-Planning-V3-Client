'use client';

import { Download, FileSpreadsheet } from 'lucide-react';
import InlineSpinner from '@/components/ui/InlineSpinner';
import { LOAD_DEPTS } from '@/features/load-calculation/lib/load-report-config';
import type { LoadCalcTab } from '@/features/load-calculation/types';

export function LoadDownloadButtons({
  activeTab,
  downloadingDept,
  downloadDetailedExcel,
  downloadSummaryExcel,
}: {
  activeTab: LoadCalcTab;
  downloadingDept: string | null;
  downloadDetailedExcel: (deptKey: string) => Promise<void>;
  downloadSummaryExcel: (deptKey?: string) => Promise<void>;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 lg:col-span-2 shadow-sm flex flex-col justify-center">
      <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3 text-xs uppercase tracking-wider flex items-center gap-2">
        <Download className="h-4 w-4 text-slate-400" />
        {activeTab === 'detailed' ? 'Download Detailed Reports (Excel)' : 'Download Summary Reports (Excel)'}
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {LOAD_DEPTS.map((d) => (
          <button
            key={d.key}
            onClick={() => {
              if (activeTab === 'detailed') {
                downloadDetailedExcel(d.key);
              } else {
                downloadSummaryExcel(d.key);
              }
            }}
            disabled={downloadingDept === d.key}
            className={`${d.colorClass} rounded-md py-2 px-2.5 text-xs font-bold shadow-sm transition inline-flex items-center justify-center gap-1.5`}
          >
            {downloadingDept === d.key ? (
              <InlineSpinner size={13} />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{d.label} {activeTab === 'detailed' ? 'Load' : 'Summary'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
