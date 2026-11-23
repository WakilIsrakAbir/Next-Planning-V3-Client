'use client';

import { Activity, Download, Save } from 'lucide-react';
import InlineSpinner from '@/components/ui/InlineSpinner';

interface TrackingHeaderProps {
  dept: string;
  downloadTrackingExcel: () => void;
  handleSaveAll: () => void;
  saveLoading: boolean;
  ordersCount: number;
}

/** Page title with the "Export Excel" and "Save Actual Tracking" buttons. */
export default function TrackingHeader({
  dept,
  downloadTrackingExcel,
  handleSaveAll,
  saveLoading,
  ordersCount,
}: TrackingHeaderProps) {
  return (
    <div className="flex-none flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          Plan vs Actual Tracking: <span className="uppercase">{dept}</span>
        </h2>
        <p className="text-xs text-base-content/60">
          Inline real-time floor execution tracking with instant Pass / Fail result calculation and delay attribution.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={downloadTrackingExcel}
          className="btn btn-sm btn-outline gap-2 font-bold"
        >
          <Download className="w-4 h-4" /> Export Excel
        </button>
        <button
          onClick={handleSaveAll}
          disabled={saveLoading || ordersCount === 0}
          className="btn btn-sm btn-primary gap-2 font-bold shadow-md shadow-primary/25"
        >
          {saveLoading ? <InlineSpinner size={14} /> : <Save className="w-4 h-4" />}
          Save Actual Tracking
        </button>
      </div>
    </div>
  );
}
