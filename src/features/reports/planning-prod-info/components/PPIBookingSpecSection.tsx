'use client';

import type { RefObject } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { formatPPIDate, toText, type PPIOrder } from '@/features/reports/planning-prod-info/lib/ppi-utils';
import { hasValue, sv } from '@/features/reports/planning-prod-info/lib/spec-values';

interface PPIBookingSpecSectionProps {
  order: PPIOrder;
  specSectionRef: RefObject<HTMLElement | null>;
}

/** 1. Booking Specification: general & technical specs of the order. */
export default function PPIBookingSpecSection({ order: o, specSectionRef }: PPIBookingSpecSectionProps) {
  return (
    <section ref={specSectionRef} className="w-full">
      <div className="bg-[#1e40af] text-white px-4 py-2.5 rounded-t-lg font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-between shadow-xs">
        <span className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4" /> Booking Specification
        </span>
        <span className="text-[11px] font-semibold bg-white/20 px-2.5 py-0.5 rounded">
          General & Technical Specs
        </span>
      </div>
      <div className="overflow-x-auto border border-t-0 border-base-300 rounded-b-lg">
        <table className="w-full text-xs border-collapse">
          <tbody className="divide-y divide-base-200">
            {/* Row 1: Booking No. | Buyer Name | Buyer Team */}
            <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-100">
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                Booking No.
              </td>
              <td className="p-2 font-black text-blue-600 dark:text-blue-400 border-b md:border-b-0 md:border-r border-base-300 font-mono flex items-center">
                {sv(o.orderNo, '—')}
              </td>
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                Buyer Name
              </td>
              <td className="p-2 font-black border-b md:border-b-0 md:border-r border-base-300 flex items-center">
                {sv(o.buyer, '—')}
              </td>
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                Buyer Team
              </td>
              <td className="p-2 font-medium border-b md:border-b-0 border-base-300 flex items-center">
                {sv(o.buyerTeam, '—')}
              </td>
            </tr>

            {/* Row 2: Booking Date | Event Day | Style */}
            <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-200/30">
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                Booking Date
              </td>
              <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                {formatPPIDate(o.bookingDate)}
              </td>
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                Event Day
              </td>
              <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                {toText(o.eventDay ?? '—')}
              </td>
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                Style
              </td>
              <td className="p-2 font-bold text-blue-600 dark:text-blue-400 border-b md:border-b-0 border-base-300 flex items-center">
                {sv(o.style, o.Style, '—')}
              </td>
            </tr>

            {/* Row 3: PMC | Merchant | Unit */}
            <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-100">
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                PMC
              </td>
              <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                {sv(o.pmc, '—')}
              </td>
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                Merchant
              </td>
              <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                {sv(o.bookingBy, o.bookedBy, '—')}
              </td>
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                Unit
              </td>
              <td className="p-2 border-b md:border-b-0 border-base-300 font-medium flex items-center">
                {sv(o.floor, o.unit, 'EFL')}
              </td>
            </tr>

            {/* Row 4: Gmt Unit | Program Type | Order Qty (KG) */}
            <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-200/30">
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                Gmt Unit
              </td>
              <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                {o.gmtUnit !== undefined && o.gmtUnit !== null ? toText(o.gmtUnit) : '—'}
              </td>
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                Program Type
              </td>
              <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                {sv(o.programType, o['Program type'], 'SOLID')}
              </td>
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                Order Qty (KG)
              </td>
              <td className="p-2 font-black text-emerald-600 dark:text-emerald-400 border-b md:border-b-0 border-base-300 flex items-center font-mono">
                {o.requiredQtyKgs ? `${Number(o.requiredQtyKgs).toLocaleString()} KG` : '—'}
              </td>
            </tr>

            {/* Row 5: Batch Plan | Body Fabric | Body GSM */}
            <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-100">
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                Batch Plan
              </td>
              <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                {sv(o.bpStatus, 'Pending')}
              </td>
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                Body Fabric
              </td>
              <td className="p-2 font-medium border-b md:border-b-0 md:border-r border-base-300 truncate flex items-center">
                {sv(o.bodyFabric, o['Body Fabric'], '—')}
              </td>
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                Body GSM
              </td>
              <td className="p-2 font-medium border-b md:border-b-0 border-base-300 flex items-center font-mono">
                {hasValue(o.bodyGsm) ? toText(o.bodyGsm) : '—'}
              </td>
            </tr>

            {/* Row 6: Brush | Peach | Heatset */}
            <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-200/30">
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                Brush
              </td>
              <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                {sv(o.brush, o['Brush'], 'No')}
              </td>
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                Peach
              </td>
              <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                {sv(o.peach, o['Peach'], 'No')}
              </td>
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                Heatset
              </td>
              <td className="p-2 border-b md:border-b-0 border-base-300 font-medium flex items-center">
                {sv(o.heatset, o['Heatset'], 'No')}
              </td>
            </tr>

            {/* Row 7: ALD | PMC Notes | Fabric Notes */}
            <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-100">
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                ALD
              </td>
              <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                {sv(
                  o.ald,
                  o['ALD'],
                  o.eventDay ? `${toText(o.eventDay)} ok out of ${toText(o.eventDay)}` : '—'
                )}
              </td>
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                PMC Notes
              </td>
              <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium truncate flex items-center">
                {sv(o.pmcNotes, o['PMC Notes'], o.fabricNotes, '—')}
              </td>
              <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                Fabric Notes
              </td>
              <td className="p-2 border-b md:border-b-0 border-base-300 font-medium truncate flex items-center">
                {sv(o.fabricNotes, '—')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
