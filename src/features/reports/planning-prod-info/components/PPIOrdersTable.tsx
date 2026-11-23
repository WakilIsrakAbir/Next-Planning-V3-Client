'use client';

import type { CSSProperties } from 'react';
import { Eye } from 'lucide-react';
import { formatPPIDate, type PPIOrder } from '@/features/reports/planning-prod-info/lib/ppi-utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import type { FitRows } from '@/hooks/use-fit-rows';

interface PPIOrdersTableProps {
  loading: boolean;
  setTableArea: (el: HTMLDivElement | null) => void;
  visibleOrders: PPIOrder[];
  rowStyle: CSSProperties | undefined;
  loadOrderDetail: (orderNo?: string) => void;
  page: number;
  totalPages: number;
  total: number;
  limit: number | null;
  fit: FitRows | null;
  setPage: (page: number) => void;
  handleLimitChange: (newLimit: number | 'auto') => void;
  limitChoice: number | 'auto';
}

export default function PPIOrdersTable({
  loading,
  setTableArea,
  visibleOrders,
  rowStyle,
  loadOrderDetail,
  page,
  totalPages,
  total,
  limit,
  fit,
  setPage,
  handleLimitChange,
  limitChoice,
}: PPIOrdersTableProps) {
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden flex-1 min-h-0 relative flex flex-col">
      {loading && (
        <LoadingSpinner
          message="Processing PPI Records..."
          subMessage="Fetching 3-section order specifications"
        />
      )}

      <div ref={setTableArea} className="flex-1 min-h-0 overflow-auto custom-scrollbar">
        <table className="table table-sm w-full">
          {/* Sticky header: an opaque base under the same tint, so scrolled rows do not show through */}
          <thead className="sticky top-0 z-10 bg-base-100 text-xs font-extrabold uppercase">
            <tr className="bg-base-200/60">
              <th className="text-center w-16">View</th>
              <th>Booking No. / Order No.</th>
              <th>Buyer Name</th>
              <th>Booking Date</th>
              <th>Style</th>
            </tr>
          </thead>
          <tbody className="text-xs divide-y divide-base-200">
            {!loading && visibleOrders.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-base-content/60">
                  No orders found.
                </td>
              </tr>
            ) : (
              visibleOrders.map((ord) => (
                <tr key={ord._id || ord.orderNo} style={rowStyle} className="hover">
                  <td className="text-center">
                    <button
                      onClick={() => loadOrderDetail(ord.orderNo)}
                      className="btn btn-xs btn-primary btn-outline"
                      title="Open 3-Section PPI Report"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                  <td className="font-mono font-bold text-primary">{ord.orderNo}</td>
                  <td className="font-semibold uppercase text-[11px]">{ord.buyer || 'N/A'}</td>
                  <td>{formatPPIDate(ord.bookingDate)}</td>
                  <td className="text-[11px]">{ord.style || '—'}</td>
                </tr>
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
