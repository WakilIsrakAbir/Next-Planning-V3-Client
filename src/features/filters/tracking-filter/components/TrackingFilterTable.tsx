'use client';

import { formatDateDisplay } from '@/lib/date-utils';
import type { TrackingResultRow } from '@/features/filters/tracking-filter/types';

interface TrackingFilterTableProps {
  filteredRows: TrackingResultRow[];
  showUnitProcess: boolean;
}

/** Filtered tracking rows with their Start / End Pass / Fail results. */
export default function TrackingFilterTable({ filteredRows, showUnitProcess }: TrackingFilterTableProps) {
  return (
    <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
      <table className="table table-xs table-pin-rows table-pin-cols w-full border border-base-300">
        <thead className="bg-base-200 text-base-content font-bold">
          <tr>
            <th className="text-center w-10">SL</th>
            <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Order/Booking No.</th>
            <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Buyer</th>
            {showUnitProcess && (
              <>
                <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Unit</th>
                <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Process Name</th>
              </>
            )}
            <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Plan Start</th>
            <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Plan End</th>
            <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Actual Start</th>
            <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Actual End</th>
            <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Start Result</th>
            <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">End Result</th>
            <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Fail Reason</th>
            <th className="text-center whitespace-nowrap px-3 py-2">Related Dept.</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((r, i) => (
            <tr key={i} className="hover:bg-base-200/50 transition-colors border-b border-base-200">
              <td className="text-center font-bold text-base-content/50 border-r border-base-300">{i + 1}</td>
              <td className="px-3 py-1.5 text-center font-bold text-primary border-r border-base-200">{r.orderNo}</td>
              <td className="px-3 py-1.5 text-center font-medium border-r border-base-200">{r.buyer}</td>
              {showUnitProcess && (
                <>
                  <td className="px-3 py-1.5 text-center border-r border-base-200">{r.unit || '—'}</td>
                  <td className="px-3 py-1.5 text-center border-r border-base-200">{r.processName || '—'}</td>
                </>
              )}
              <td className="px-3 py-1.5 text-center border-r border-base-200">{formatDateDisplay(r.planStart) || '—'}</td>
              <td className="px-3 py-1.5 text-center border-r border-base-200">{formatDateDisplay(r.planEnd) || '—'}</td>
              <td className="px-3 py-1.5 text-center border-r border-base-200">{formatDateDisplay(r.actualStart) || '—'}</td>
              <td className="px-3 py-1.5 text-center border-r border-base-200">{formatDateDisplay(r.actualEnd) || '—'}</td>
              <td className="px-3 py-1.5 text-center border-r border-base-200">
                {r.startResult === 'Pass' ? (
                  <span className="badge badge-success text-white badge-xs font-bold">Pass</span>
                ) : r.startResult === 'Fail' ? (
                  <span className="badge badge-error text-white badge-xs font-bold">Fail</span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-1.5 text-center border-r border-base-200">
                {r.endResult === 'Pass' ? (
                  <span className="badge badge-success text-white badge-xs font-bold">Pass</span>
                ) : r.endResult === 'Fail' ? (
                  <span className="badge badge-error text-white badge-xs font-bold">Fail</span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-1.5 border-r border-base-200 text-xs">{r.failReason || '—'}</td>
              <td className="px-3 py-1.5 text-xs">{r.relatedDept || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
