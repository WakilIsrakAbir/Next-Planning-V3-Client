'use client';

import { Minus, Plus } from 'lucide-react';
import { ZOOM_STEP } from '@/features/reports/planning-prod-info/lib/constants';

interface PPIZoomControlsProps {
  reportZoom: number;
  changeReportZoom: (delta: number) => void;
  resetReportZoom: () => void;
}

export default function PPIZoomControls({ reportZoom, changeReportZoom, resetReportZoom }: PPIZoomControlsProps) {
  return (
  <div className="flex items-center bg-base-200 border border-base-300 rounded-lg p-0.5 text-xs">
    <button
      onClick={() => changeReportZoom(-ZOOM_STEP)}
      className="w-7 h-7 flex items-center justify-center rounded hover:bg-base-100 font-bold transition"
      title="Zoom Out"
      aria-label="Zoom Out"
    >
      <Minus className="w-3 h-3" />
    </button>
    <span className="px-2 text-xs font-bold min-w-[46px] text-center select-none">
      {Math.round(reportZoom * 100)}%
    </span>
    <button
      onClick={() => changeReportZoom(ZOOM_STEP)}
      className="w-7 h-7 flex items-center justify-center rounded hover:bg-base-100 font-bold transition"
      title="Zoom In"
      aria-label="Zoom In"
    >
      <Plus className="w-3 h-3" />
    </button>
    <button
      onClick={resetReportZoom}
      className="px-2 py-1 text-[11px] font-semibold text-base-content/60 hover:text-base-content transition border-l border-base-300"
      title="Reset Zoom"
    >
      Reset
    </button>
  </div>
  );
}
