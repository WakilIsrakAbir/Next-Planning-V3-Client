'use client';

import type { CSSProperties, RefObject } from 'react';
import { AlertCircle } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import type { FitRows } from '@/hooks/use-fit-rows';
import TrackingTableRow from '@/features/tracking/tracking/components/TrackingTableRow';
import type { TrackingEdit, TrackingOrder } from '@/features/tracking/tracking/types';

interface TrackingTableProps {
  loading: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  dynCol1: string;
  dynCol2: string;
  columnCount: number;
  visibleOrders: TrackingOrder[];
  activeTab: 'Pending' | 'Complete';
  page: number;
  limit: number | null;
  editedRows: Record<string, TrackingEdit>;
  rowStyle: CSSProperties | undefined;
  hasOttBoard: boolean;
  setOttOrderNo: (orderNo: string | null) => void;
  handleRowChange: (orderNo: string, field: keyof TrackingEdit, value: string) => void;
  totalPages: number;
  total: number;
  fit: FitRows | null;
  limitChoice: number | 'auto';
  setPage: (page: number) => void;
  handleLimitChange: (newLimit: number | 'auto') => void;
}

/** The tracking table card: loading overlay, the scrollable rows and the pagination bar. */
export default function TrackingTable({
  loading,
  scrollRef,
  dynCol1,
  dynCol2,
  columnCount,
  visibleOrders,
  activeTab,
  page,
  limit,
  editedRows,
  rowStyle,
  hasOttBoard,
  setOttOrderNo,
  handleRowChange,
  totalPages,
  total,
  fit,
  limitChoice,
  setPage,
  handleLimitChange,
}: TrackingTableProps) {
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden flex-1 min-h-0 relative flex flex-col">
      {/* Exact Exp 3-Ring Loading Overlay */}
      {loading && <LoadingSpinner message="Processing Tracking Data..." />}

      {/* The table area stays mounted (also while empty), so "Auto" keeps measuring it */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto custom-scrollbar">
        <table className="table table-xs w-full">
          {/* Sticky header: an opaque base under the same tint, so scrolled rows do not show through */}
          <thead className="sticky top-0 z-10 bg-base-100 text-[11px] font-bold">
            <tr className="bg-base-200/80">
              <th className="text-center w-10">SL</th>
              <th>Order / Booking No</th>
              <th>Buyer</th>
              {dynCol1 && <th className="text-center bg-amber-500/10 text-amber-700">{dynCol1}</th>}
              {dynCol2 && <th className="text-center bg-amber-500/10 text-amber-700">{dynCol2}</th>}
              <th className="text-center bg-primary/10 text-primary">Plan Start</th>
              <th className="text-center bg-primary/10 text-primary">Plan End</th>
              <th className="text-center min-w-[125px]">Actual Start</th>
              <th className="text-center min-w-[125px]">Actual End</th>
              <th className="text-center w-16">Start Result</th>
              <th className="text-center w-16">End Result</th>
              <th className="min-w-[150px]">Fail Reason</th>
              <th className="min-w-[130px]">Related Dept.</th>
            </tr>
          </thead>
          <tbody className="text-xs divide-y divide-base-200">
            {!loading && visibleOrders.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="p-16 text-center text-base-content/60">
                  <div className="space-y-2">
                    <AlertCircle className="h-8 w-8 mx-auto text-base-content/30" />
                    <p className="text-sm font-bold">No {activeTab} tracking records found.</p>
                    <p className="text-xs">Adjust your search or filter parameters to find confirmed plans.</p>
                  </div>
                </td>
              </tr>
            ) : (
              visibleOrders.map((ord, idx) => (
                <TrackingTableRow
                  key={ord.orderNo}
                  ord={ord}
                  idx={idx}
                  page={page}
                  limit={limit}
                  editedRows={editedRows}
                  rowStyle={rowStyle}
                  hasOttBoard={hasOttBoard}
                  setOttOrderNo={setOttOrderNo}
                  dynCol1={dynCol1}
                  dynCol2={dynCol2}
                  handleRowChange={handleRowChange}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Exact Exp Pagination Bar */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        limit={limit ?? fit?.rows ?? 10}
        onPageChange={(newPage) => setPage(newPage)}
        onLimitChange={handleLimitChange}
        autoRows={fit?.rows}
        isAuto={limitChoice === 'auto'}
      />
    </div>
  );
}
