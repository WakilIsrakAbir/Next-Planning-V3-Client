'use client';

import type { TrackingMetrics } from '@/features/filters/tracking-filter/types';

interface TrackingFilterMetricsProps {
  metrics: TrackingMetrics;
}

/** Conformance metrics bar: total rows and Start / End plan Pass / Fail counts. */
export default function TrackingFilterMetrics({ metrics }: TrackingFilterMetricsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
        <span className="text-xs text-base-content/60 font-semibold uppercase">Total Rows</span>
        <span className="text-2xl font-black text-primary mt-1">{metrics.total}</span>
      </div>

      <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
        <span className="text-xs text-base-content/60 font-semibold uppercase">Start Plan Conformance</span>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-bold text-success">Pass: {metrics.startPass} ({metrics.startPassPct})</span>
          <span className="text-sm font-bold text-error">Fail: {metrics.startFail} ({metrics.startFailPct})</span>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300 p-4 shadow-sm col-span-2">
        <span className="text-xs text-base-content/60 font-semibold uppercase">End Plan Conformance</span>
        <div className="flex items-center gap-4 mt-1">
          <span className="text-sm font-bold text-success">Pass: {metrics.endPass} ({metrics.endPassPct})</span>
          <span className="text-sm font-bold text-error">Fail: {metrics.endFail} ({metrics.endFailPct})</span>
        </div>
      </div>
    </div>
  );
}
