'use client';

import type { CSSProperties, ReactNode, RefObject } from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import type { FitRows } from '@/hooks/use-fit-rows';
import ProductInfoOrderRow from '@/features/reports/product-info/components/ProductInfoOrderRow';
import type { ProductInfoOrder } from '@/features/reports/product-info/types';

interface ProductInfoOrdersTableProps {
  loading: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  visibleOrders: ProductInfoOrder[];
  rowStyle: CSSProperties | undefined;
  expandedOrder: string | null;
  toggleExpand: (orderNo: string) => void;
  /** The expanded order's specifications */
  expandedDetails: ReactNode;
  page: number;
  totalPages: number;
  totalCount: number;
  limit: number | null;
  fit: FitRows | null;
  setPage: (page: number) => void;
  handleLimitChange: (newLimit: number | 'auto') => void;
  limitChoice: number | 'auto';
}

export default function ProductInfoOrdersTable({
  loading,
  scrollRef,
  visibleOrders,
  rowStyle,
  expandedOrder,
  toggleExpand,
  expandedDetails,
  page,
  totalPages,
  totalCount,
  limit,
  fit,
  setPage,
  handleLimitChange,
  limitChoice,
}: ProductInfoOrdersTableProps) {
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden flex-1 min-h-0 relative flex flex-col">
      {loading && (
        <LoadingSpinner
          message="Compiling Product Info..."
          subMessage="Fetching orders and color specifications"
        />
      )}

      {/* The table area stays mounted (also while empty), so "Auto" keeps measuring it */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto custom-scrollbar">
        <table className="table table-sm">
          {/* Sticky header: an opaque base under the same tint, so scrolled rows do not show through */}
          <thead className="sticky top-0 z-10 bg-base-100 text-[11px] uppercase tracking-wider font-extrabold">
            <tr className="bg-base-200/50">
              <th className="w-10"></th>
              <th>Order No</th>
              <th>Buyer</th>
              <th>Booking Date</th>
              <th>Knitting Status</th>
              <th>Dyeing Status</th>
              <th>Delivery Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-200 text-xs">
            {!loading && visibleOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-base-content/60">
                  No orders found matching your search.
                </td>
              </tr>
            ) : (
              visibleOrders.map((ord) => {
                const isExpanded = expandedOrder === ord.orderNo;

                return (
                  <ProductInfoOrderRow
                    key={ord.orderNo}
                    ord={ord}
                    rowStyle={rowStyle}
                    isExpanded={isExpanded}
                    toggleExpand={toggleExpand}
                    expandedDetails={expandedDetails}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Exact Exp Pagination Bar */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalCount}
        limit={limit ?? fit?.rows ?? 10}
        onPageChange={(newPage) => setPage(newPage)}
        onLimitChange={handleLimitChange}
        autoRows={fit?.rows}
        isAuto={limitChoice === 'auto'}
      />
    </div>
  );
}
