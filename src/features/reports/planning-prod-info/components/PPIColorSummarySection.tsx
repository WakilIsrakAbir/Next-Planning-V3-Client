'use client';

import type { RefObject } from 'react';
import { Layers } from 'lucide-react';
import {
  formatPPIPercent,
  ppiMetricTotal,
  type PPIColorSummary,
} from '@/features/reports/planning-prod-info/lib/ppi-utils';

interface PPIColorSummarySectionProps {
  colorSummary: PPIColorSummary;
  colorCountText: string;
  summaryHeaderRef: RefObject<HTMLDivElement | null>;
  summaryTheadRef: RefObject<HTMLTableSectionElement | null>;
  summaryTbodyRef: RefObject<HTMLTableSectionElement | null>;
}

/** 3. Details Booking Summary: colour-wise metrics with a total row. */
export default function PPIColorSummarySection({
  colorSummary,
  colorCountText,
  summaryHeaderRef,
  summaryTheadRef,
  summaryTbodyRef,
}: PPIColorSummarySectionProps) {
  return (
    <section className="w-full">
      <div
        ref={summaryHeaderRef}
        className="bg-[#b45309] text-white px-4 py-2.5 rounded-t-lg font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-between shadow-xs"
      >
        <span data-ppi-summary-title="" className="flex items-center gap-2">
          <Layers className="w-4 h-4" /> Details Booking Summary (Color-Wise)
        </span>
        <span className="text-[11px] font-semibold bg-white/20 px-2.5 py-0.5 rounded">{colorCountText}</span>
      </div>
      <div className="overflow-x-auto border border-t-0 border-base-300 rounded-b-lg">
        <table className="w-full text-xs min-w-[1100px] border-collapse whitespace-nowrap">
          <thead
            ref={summaryTheadRef}
            className="bg-amber-100/90 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border-b border-base-300"
          >
            <tr>
              <th className="p-2.5 text-left border-r border-base-300 font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 min-w-[100px]">
                Color
              </th>
              {colorSummary.metrics.map((m) => (
                <th
                  key={m.label}
                  className="p-2.5 border-r border-base-300 text-center font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 whitespace-nowrap min-w-[85px]"
                >
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={summaryTbodyRef} className="divide-y divide-base-200">
            {colorSummary.colors.length === 0 ? (
              <tr>
                <td colSpan={colorSummary.metrics.length + 1} className="p-6 text-center text-xs text-base-content/50 font-medium">
                  No color data found for this order.
                </td>
              </tr>
            ) : (
              <>
                {colorSummary.colors.map((col, idx) => {
                  const isShaded = idx % 2 === 1;
                  const agg = colorSummary.colorAggs[col.key];

                  return (
                    <tr
                      key={col.key}
                      className={`${isShaded ? 'bg-base-200/30' : 'bg-base-100'} hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-colors`}
                    >
                      <td className="p-2 font-bold border-r border-base-300 text-left">{col.label}</td>
                      {colorSummary.metrics.map((m) => {
                        const v = m.getValue(agg);
                        return (
                          <td key={m.label} className="p-2 border-r border-base-300 text-center font-mono font-medium">
                            {m.isPercent ? formatPPIPercent(v) : Math.round(v).toLocaleString()}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Total Summary Footer Row */}
                <tr className="bg-amber-100/90 dark:bg-amber-950/80 text-amber-950 dark:text-amber-100 font-black border-t-2 border-base-300">
                  <td className="p-2 font-black border-r border-base-300 text-left uppercase">Total</td>
                  {colorSummary.metrics.map((m) => {
                    const totalValue = ppiMetricTotal(m, colorSummary);
                    return (
                      <td key={m.label} className="p-2 border-r border-base-300 text-center font-mono font-black">
                        {m.isPercent ? formatPPIPercent(totalValue) : Math.round(totalValue).toLocaleString()}
                      </td>
                    );
                  })}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
