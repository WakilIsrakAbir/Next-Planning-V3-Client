'use client';

import { ArrowLeft, Expand, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import PPIZoomControls from '@/features/reports/planning-prod-info/components/PPIZoomControls';

interface PPIReportToolbarProps {
  orderNo: string | undefined;
  onBack: () => void;
  handleExportExcel: () => void;
  fitReportToScreen: () => void;
  reportAutoFit: boolean;
  reportZoom: number;
  changeReportZoom: (delta: number) => void;
  resetReportZoom: () => void;
  printReport: () => void;
}

/** Action Toolbar with Zoom and Fit Controls */
export default function PPIReportToolbar({
  orderNo,
  onBack,
  handleExportExcel,
  fitReportToScreen,
  reportAutoFit,
  reportZoom,
  changeReportZoom,
  resetReportZoom,
  printReport,
}: PPIReportToolbarProps) {
  return (
    <div className="no-print sticky top-0 z-20 bg-base-100 border border-base-300 rounded-lg flex items-center justify-between px-4 py-2.5 shrink-0 shadow-xs flex-wrap gap-2">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Detailed Planning & Production Info
          <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
            Booking #{orderNo}
          </span>
        </h3>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleExportExcel}
          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
        >
          <FileSpreadsheet className="w-4 h-4" /> Excel Download
        </button>
        <button
          onClick={fitReportToScreen}
          className={`px-3.5 py-1.5 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs ${
            reportAutoFit
              ? 'bg-indigo-600 hover:bg-indigo-700 ring-2 ring-indigo-300'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
          title="Fit to Screen Width"
        >
          <Expand className="w-4 h-4" /> Fit to Screen
        </button>
        <PPIZoomControls reportZoom={reportZoom} changeReportZoom={changeReportZoom} resetReportZoom={resetReportZoom} />
        <button
          onClick={printReport}
          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          title="Print ERP Report"
        >
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>
    </div>
  );
}
