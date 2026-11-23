'use client';

import { HandMetal, TrendingUp } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import type { LoadRow } from '@/features/load-calculation/lib/load-calc-utils';
import { LOAD_DEPTS } from '@/features/load-calculation/lib/load-report-config';
import type { SummaryReportRow } from '@/features/load-calculation/lib/load-report-data';
import { BuyerSummaryTable } from '@/features/load-calculation/components/BuyerSummaryTable';

export function BuyerSummaryPanel({
  selectedDept,
  setSelectedDept,
  ensureLoadDataForDept,
  loading,
  reportMonths,
  summaryRows,
  grandMonthlyTotals,
  grandTotal,
}: {
  selectedDept: string | null;
  setSelectedDept: (deptKey: string) => void;
  ensureLoadDataForDept: (deptKey: string) => Promise<LoadRow[]>;
  loading: boolean;
  reportMonths: Date[];
  summaryRows: SummaryReportRow[];
  grandMonthlyTotals: number[];
  grandTotal: number;
}) {
  return (
    <div className="border-2 border-blue-400 ring-2 ring-blue-100 dark:ring-blue-900/30 rounded-xl overflow-hidden shadow-lg bg-white dark:bg-slate-900">
      {/* Header Bar with Department Tabs matching Exp */}
      <div className="bg-blue-50 dark:bg-slate-800/90 border-b border-blue-300 dark:border-slate-700 px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="font-bold text-lg text-blue-950 dark:text-blue-200 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Buyer-wise Summary Preview
          </h3>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
            The month names change automatically from the selected starting month.
          </p>
        </div>

        {/* Department Buttons matching Exp summaryBtn */}
        <div className="flex flex-wrap gap-2">
          {LOAD_DEPTS.map((d) => {
            const isActive = selectedDept === d.key;
            return (
              <button
                key={d.key}
                onClick={() => {
                  setSelectedDept(d.key);
                  ensureLoadDataForDept(d.key);
                }}
                className={`px-4 py-2 rounded border text-xs font-bold transition-all ${
                  isActive
                    ? d.activeClass
                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-auto custom-scrollbar max-h-[580px]">
        {!selectedDept ? (
          <div className="p-14 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center mb-4 text-blue-500">
                <HandMetal className="w-7 h-7" />
              </div>
              <h3 className="text-gray-800 dark:text-gray-200 font-bold text-lg">Select a Department</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                Click on a department button above (YD, Knitting, Dyeing, Delivery, Delivery (Floor)) to view the buyer-wise load summary.
              </p>
            </div>
          </div>
        ) : loading ? (
          <div className="p-16 flex items-center justify-center">
            <LoadingSpinner
              message="Loading Summary Data..."
              subMessage="Please wait while data is being processed"
              overlay={false}
            />
          </div>
        ) : summaryRows.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            No load data available for {LOAD_DEPTS.find((d) => d.key === selectedDept)?.label} in this 5-month projection window.
          </div>
        ) : (
          <BuyerSummaryTable
            reportMonths={reportMonths}
            summaryRows={summaryRows}
            grandMonthlyTotals={grandMonthlyTotals}
            grandTotal={grandTotal}
          />
        )}
      </div>
    </div>
  );
}
