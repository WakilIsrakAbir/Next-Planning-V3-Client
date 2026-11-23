'use client';

import { FileSpreadsheet, Printer } from 'lucide-react';
import { formatNumDisplay } from '@/features/reports/product-info/lib/number-format';
import type { ProductInfoOrder } from '@/features/reports/product-info/types';

interface ProductInfoSummaryCardProps {
  orderDetails: ProductInfoOrder;
  handleDownloadExcel: () => void;
}

/** Top Info Card with Action Buttons */
export default function ProductInfoSummaryCard({ orderDetails, handleDownloadExcel }: ProductInfoSummaryCardProps) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-base-100 p-3.5 rounded-lg border border-base-300 shadow-xs text-xs">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
        <div>
          <span className="text-base-content/50 block text-[10px] uppercase font-bold tracking-wider">
            Order No
          </span>
          <span className="font-mono font-extrabold text-sm text-primary">
            {orderDetails.orderNo}
          </span>
        </div>
        <div>
          <span className="text-base-content/50 block text-[10px] uppercase font-bold tracking-wider">
            Buyer
          </span>
          <span className="font-bold">{orderDetails.buyer || '—'}</span>
        </div>
        <div>
          <span className="text-base-content/50 block text-[10px] uppercase font-bold tracking-wider">
            Style
          </span>
          <span className="font-bold">{orderDetails.style || '—'}</span>
        </div>
        <div>
          <span className="text-base-content/50 block text-[10px] uppercase font-bold tracking-wider">
            Required Qty
          </span>
          <span className="font-bold text-accent">
            {formatNumDisplay(orderDetails.requiredQtyKgs)} kg
          </span>
        </div>
      </div>

      {/* Actions: Download Excel & Print */}
      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.print();
          }}
          className="btn btn-xs btn-outline gap-1.5"
          title="Print Specification"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDownloadExcel();
          }}
          className="btn btn-xs btn-primary gap-1.5 text-white"
          title="Export to Excel (.xlsx)"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" /> Excel Download
        </button>
      </div>
    </div>
  );
}
