'use client';

import { formatDateDisplay } from '@/lib/date-utils';
import { cellText } from '@/features/filters/plan-filter/lib/plan-filter-rows';
import type { PfRow } from '@/features/filters/plan-filter/types';

interface PlanFilterTableProps {
  filteredRows: PfRow[];
  cols: string[];
}

/** The filtered rows, one column per configured Plan Filter column. */
export default function PlanFilterTable({ filteredRows, cols }: PlanFilterTableProps) {
  return (
    <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
      <table className="table table-xs table-pin-rows table-pin-cols w-full border border-base-300">
        <thead className="bg-base-200 text-base-content font-bold">
          <tr>
            <th className="text-center w-12">#</th>
            {cols.map((col) => (
              <th key={col} className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((r, i) => (
            <tr key={i} className="hover:bg-base-200/50 transition-colors border-b border-base-200">
              <td className="text-center font-bold text-base-content/50 border-r border-base-300">{i + 1}</td>
              {cols.map((col) => {
                const val = r[col];
                const isDate = col.includes('Date');
                const isType = col === 'Plan Type';

                return (
                  <td
                    key={col}
                    className={`px-3 py-1.5 text-center whitespace-nowrap border-r border-base-200 ${
                      col === 'OrderNo' ? 'font-bold text-primary' : ''
                    }`}
                  >
                    {isType ? (
                      <span
                        className={`badge badge-xs font-bold ${
                          val === 'Confirm' ? 'badge-success text-white' : 'badge-warning'
                        }`}
                      >
                        {cellText(val)}
                      </span>
                    ) : isDate ? (
                      formatDateDisplay(cellText(val)) || '—'
                    ) : (
                      val ?? '—'
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
