'use client';

import { formatSummaryMonthHeader } from '@/features/load-calculation/lib/load-dates';
import type { SummaryReportRow } from '@/features/load-calculation/lib/load-report-data';

export function BuyerSummaryTable({
  reportMonths,
  summaryRows,
  grandMonthlyTotals,
  grandTotal,
}: {
  reportMonths: Date[];
  summaryRows: SummaryReportRow[];
  grandMonthlyTotals: number[];
  grandTotal: number;
}) {
  return (
    <table className="w-full text-xs min-w-max border-collapse border border-gray-300 dark:border-gray-700">
      <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200">
        <tr>
          <th className="p-2 border border-slate-300 dark:border-slate-700 text-left">Buyer</th>
          {reportMonths.map((mDate) => (
            <th
              key={mDate.toISOString()}
              className="p-2 border border-slate-300 dark:border-slate-700 text-right font-bold"
            >
              {formatSummaryMonthHeader(mDate)}
            </th>
          ))}
          <th className="p-2 border border-slate-300 dark:border-slate-700 text-right font-black bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300">
            Total [Kg]
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
        {summaryRows.map((row) => (
          <tr key={row.buyer} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <td className="p-2 border border-slate-200 dark:border-slate-700 text-left font-semibold text-slate-700 dark:text-slate-300">
              {row.buyer}
            </td>
            {row.monthlyValues.map((val: number, idx: number) => (
              <td
                key={idx}
                className="p-2 border border-slate-200 dark:border-slate-700 text-right font-mono text-slate-600 dark:text-slate-300"
              >
                {val > 0 ? Number(val).toLocaleString() : '0'}
              </td>
            ))}
            <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-mono font-bold text-slate-900 dark:text-slate-100 bg-blue-50/40 dark:bg-blue-950/20">
              {Number(row.total).toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-600">
        <tr>
          <td className="p-2 border border-slate-300 dark:border-slate-700 text-left font-black text-slate-900 dark:text-slate-100">
            Grand Total
          </td>
          {grandMonthlyTotals.map((tot, idx) => (
            <td
              key={idx}
              className="p-2 border border-slate-300 dark:border-slate-700 text-right font-mono font-black text-slate-900 dark:text-slate-100"
            >
              {Number(tot).toLocaleString()}
            </td>
          ))}
          <td className="p-2 border border-slate-300 dark:border-slate-700 text-right font-mono font-black text-primary text-sm bg-blue-100/60 dark:bg-blue-950/60">
            {Number(grandTotal).toLocaleString()}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
