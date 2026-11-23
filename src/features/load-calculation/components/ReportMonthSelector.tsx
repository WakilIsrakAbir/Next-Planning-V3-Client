'use client';

import { Calendar } from 'lucide-react';

export function ReportMonthSelector({
  startMonth,
  setStartMonth,
  monthOptions,
  monthLabels,
}: {
  startMonth: string;
  setStartMonth: (month: string) => void;
  monthOptions: { val: string; lbl: string }[];
  monthLabels: string[];
}) {
  return (
    <div className="bg-blue-50/80 dark:bg-slate-800/80 border border-blue-200 dark:border-slate-700 rounded-xl p-4 flex flex-col justify-between">
      <div>
        <h3 className="font-bold text-blue-900 dark:text-blue-300 text-sm mb-2 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Report Month Selection
        </h3>
        <label className="flex flex-col gap-1 w-full">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Starting Month</span>
          <select
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            className="select select-bordered select-sm font-bold text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus:outline-none focus:border-blue-500 w-full"
          >
            {monthOptions.map((opt) => (
              <option key={opt.val} value={opt.val}>
                {opt.lbl}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="text-[11px] text-blue-800 dark:text-blue-400 font-semibold mt-3">
        5-Month Window: <span className="font-bold">{monthLabels[0]} &rarr; {monthLabels[4]}</span>
      </div>
    </div>
  );
}
