'use client';

import type { CSSProperties, ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import PlanStatusBadge from '@/features/reports/product-info/components/PlanStatusBadge';
import type { ProductInfoOrder } from '@/features/reports/product-info/types';

interface ProductInfoOrderRowProps {
  ord: ProductInfoOrder;
  rowStyle: CSSProperties | undefined;
  isExpanded: boolean;
  toggleExpand: (orderNo: string) => void;
  /** The expanded order's specifications (shown under the row while it is expanded) */
  expandedDetails: ReactNode;
}

/** An order row of the list; clicking it expands / collapses its specifications below it. */
export default function ProductInfoOrderRow({ ord, rowStyle, isExpanded, toggleExpand, expandedDetails }: ProductInfoOrderRowProps) {
  return (
    <>
      <tr
        style={rowStyle}
        onClick={() => toggleExpand(ord.orderNo)}
        className={`cursor-pointer hover:bg-base-200/40 transition-colors ${
          isExpanded ? 'bg-primary/5' : ''
        }`}
      >
        <td className="text-center">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-primary" />
          ) : (
            <ChevronRight className="h-4 w-4 opacity-50" />
          )}
        </td>
        <td className="font-mono font-bold text-primary">{ord.orderNo}</td>
        <td className="font-semibold">{ord.buyer}</td>
        <td>{ord.bookingDate || '—'}</td>
        <td>
          <PlanStatusBadge status={ord.knittingPlanStatus} />
        </td>
        <td>
          <PlanStatusBadge status={ord.dyeingPlanStatus} />
        </td>
        <td>
          <PlanStatusBadge status={ord.deliveryPlanStatus} />
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={7} className="bg-base-200/30 p-4">
            {expandedDetails}
          </td>
        </tr>
      )}
    </>
  );
}
