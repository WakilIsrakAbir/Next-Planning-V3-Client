'use client';

import { Download, FileSpreadsheet } from 'lucide-react';
import { formatUnitList } from '@/features/filters/lib/unit-filter';
import PlanFilterTable from '@/features/filters/plan-filter/components/PlanFilterTable';
import type { PfRow } from '@/features/filters/plan-filter/types';

interface PlanFilterPreviewProps {
  filteredRows: PfRow[];
  cols: string[];
  dateType: 'start' | 'end';
  fromDate: string;
  toDate: string;
  selectedBuyers: string[];
  showUnitFilter: boolean;
  previewUnits: string[];
  statusFilter: 'All' | 'Confirm' | 'Tentative';
  handleExportExcel: () => void;
}

/** Preview card: the applied filters, the "Export Excel" button and the filtered rows. */
export default function PlanFilterPreview({
  filteredRows,
  cols,
  dateType,
  fromDate,
  toDate,
  selectedBuyers,
  showUnitFilter,
  previewUnits,
  statusFilter,
  handleExportExcel,
}: PlanFilterPreviewProps) {
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden space-y-4 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-base-200">
        <div>
          <h3 className="font-extrabold text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-success" />
            Filtered Plan Preview ({filteredRows.length} records)
          </h3>
          <p className="text-xs text-base-content/60">
            {dateType === 'start' ? 'Plan Start Date' : 'Plan End Date'}: {fromDate} to {toDate} |{' '}
            {selectedBuyers.length === 0 ? 'All Buyers' : selectedBuyers.join(', ')}
            {showUnitFilter && ` | Unit: ${formatUnitList(previewUnits)}`} | Status: {statusFilter}
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          disabled={filteredRows.length === 0}
          className="btn btn-success text-white btn-sm gap-2 font-bold shadow-md"
        >
          <Download className="h-4 w-4" />
          Export Excel ({filteredRows.length})
        </button>
      </div>

      {filteredRows.length === 0 ? (
        <div className="p-10 text-center text-base-content/50">
          No matching records found for the selected date range and parameters.
        </div>
      ) : (
        <PlanFilterTable filteredRows={filteredRows} cols={cols} />
      )}
    </div>
  );
}
