'use client';

import type { CSSProperties } from 'react';
import { LayoutGrid } from 'lucide-react';
import { formatDateDisplay } from '@/lib/date-utils';
import { calcTrackingBadge } from '@/features/tracking/tracking/lib/tracking-badge';
import { RESIZABLE_INPUT_CLS } from '@/features/tracking/tracking/lib/tracking-table';
import type { TrackingEdit, TrackingOrder } from '@/features/tracking/tracking/types';

interface TrackingTableRowProps {
  ord: TrackingOrder;
  idx: number;
  page: number;
  limit: number | null;
  editedRows: Record<string, TrackingEdit>;
  rowStyle: CSSProperties | undefined;
  hasOttBoard: boolean;
  setOttOrderNo: (orderNo: string | null) => void;
  dynCol1: string;
  dynCol2: string;
  handleRowChange: (orderNo: string, field: keyof TrackingEdit, value: string) => void;
}

/** One order: plan dates, editable actual dates / fail reason / related dept. and the Pass / Fail badges. */
export default function TrackingTableRow({
  ord,
  idx,
  page,
  limit,
  editedRows,
  rowStyle,
  hasOttBoard,
  setOttOrderNo,
  dynCol1,
  dynCol2,
  handleRowChange,
}: TrackingTableRowProps) {
  const sl = (page - 1) * (limit ?? 0) + idx + 1;
  const rowEdit = editedRows[ord.orderNo] || {
    actualStart: ord.actualStart || '',
    actualEnd: ord.actualEnd || '',
    failReason: ord.failReason || '',
    relatedDept: ord.relatedDept || '',
  };

  const startResult = calcTrackingBadge(rowEdit.actualStart, ord.planStart);
  const endResult = calcTrackingBadge(rowEdit.actualEnd, ord.planEnd);

  return (
    <tr style={rowStyle} className="hover:bg-base-200/40 transition-colors">
      <td className="text-center font-bold text-base-content/40">{sl}</td>
      <td className="font-bold text-primary whitespace-nowrap">
        {ord.orderNo}
        {hasOttBoard && (
          <button
            type="button"
            data-action="ott-board"
            onClick={() => setOttOrderNo(ord.orderNo)}
            className="btn btn-ghost btn-xs btn-square ml-1 align-middle"
            title="OTT Board — Same Booking Status"
            aria-label={`OTT board of ${ord.orderNo}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
      <td className="font-medium whitespace-nowrap">{ord.buyer}</td>
      {dynCol1 && (
        <td className="text-center font-bold bg-amber-500/5 text-amber-800">
          {ord.extProd !== undefined && ord.extProd !== null && ord.extProd !== '' && !isNaN(Number(ord.extProd))
            ? Number(ord.extProd).toFixed(2)
            : '—'}
        </td>
      )}
      {dynCol2 && (
        <td className="text-center font-bold bg-amber-500/5 text-amber-800">
          {ord.extBal !== undefined && ord.extBal !== null && ord.extBal !== '' && !isNaN(Number(ord.extBal))
            ? Number(ord.extBal).toFixed(2)
            : '—'}
        </td>
      )}
      <td className="text-center font-bold text-primary bg-primary/5 whitespace-nowrap">
        {formatDateDisplay(ord.planStart) || '—'}
      </td>
      <td className="text-center font-bold text-primary bg-primary/5 whitespace-nowrap">
        {formatDateDisplay(ord.planEnd) || '—'}
      </td>

      {/* Actual Start Input */}
      <td className="text-center">
        <input
          type="date"
          value={rowEdit.actualStart}
          onChange={(e) => handleRowChange(ord.orderNo, 'actualStart', e.target.value)}
          className="input input-bordered input-xs w-full text-center"
        />
      </td>

      {/* Actual End Input */}
      <td className="text-center">
        <input
          type="date"
          value={rowEdit.actualEnd}
          min={rowEdit.actualStart}
          onChange={(e) => handleRowChange(ord.orderNo, 'actualEnd', e.target.value)}
          className="input input-bordered input-xs w-full text-center"
        />
      </td>

      {/* Start Result Badge */}
      <td className="text-center">
        {startResult === 'Pass' ? (
          <span className="badge badge-success text-white badge-xs font-bold">Pass</span>
        ) : startResult === 'Fail' ? (
          <span className="badge badge-error text-white badge-xs font-bold">Fail</span>
        ) : (
          '—'
        )}
      </td>

      {/* End Result Badge */}
      <td className="text-center">
        {endResult === 'Pass' ? (
          <span className="badge badge-success text-white badge-xs font-bold">Pass</span>
        ) : endResult === 'Fail' ? (
          <span className="badge badge-error text-white badge-xs font-bold">Fail</span>
        ) : (
          '—'
        )}
      </td>

      {/* Fail Reason */}
      <td>
        <textarea
          rows={1}
          value={rowEdit.failReason}
          placeholder="Delay reason..."
          onChange={(e) => handleRowChange(ord.orderNo, 'failReason', e.target.value)}
          className={`textarea textarea-xs w-full px-2 py-1 ${RESIZABLE_INPUT_CLS}`}
        />
      </td>

      {/* Related Dept. */}
      <td>
        <textarea
          rows={1}
          value={rowEdit.relatedDept}
          placeholder="Attributed dept..."
          onChange={(e) => handleRowChange(ord.orderNo, 'relatedDept', e.target.value)}
          className={`textarea textarea-xs w-full px-2 py-1 ${RESIZABLE_INPUT_CLS}`}
        />
      </td>
    </tr>
  );
}
