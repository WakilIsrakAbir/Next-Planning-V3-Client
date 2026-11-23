'use client';

import { Gauge } from 'lucide-react';
import type { LoadCalcTab } from '@/features/load-calculation/types';

export function LoadCalculationHeader({
  activeTab,
  setActiveTab,
}: {
  activeTab: LoadCalcTab;
  setActiveTab: (tab: LoadCalcTab) => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2 text-slate-800 dark:text-slate-100">
          <Gauge className="h-6 w-6 text-primary" />
          {activeTab === 'detailed' ? 'Detailed Load Download' : 'Buyer-wise Load Summary'}
        </h2>
        <p className="text-xs text-base-content/60">
          {activeTab === 'detailed'
            ? 'Download item-level Knitting, Dyeing and Delivery load reports.'
            : 'Download buyer-wise Knitting, Dyeing and Delivery load summaries.'}
        </p>
      </div>

      {/* Tab Selector */}
      <div className="join bg-base-100 p-1 border border-base-300">
        <button
          onClick={() => setActiveTab('summary')}
          className={`join-item btn btn-sm font-bold ${
            activeTab === 'summary' ? 'btn-primary' : 'btn-ghost'
          }`}
        >
          Buyer-wise Load Summary
        </button>
        <button
          onClick={() => setActiveTab('detailed')}
          className={`join-item btn btn-sm font-bold ${
            activeTab === 'detailed' ? 'btn-primary' : 'btn-ghost'
          }`}
        >
          Detailed Load Download
        </button>
      </div>
    </div>
  );
}
