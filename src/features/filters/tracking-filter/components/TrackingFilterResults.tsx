'use client';

import { Download, TrendingUp } from 'lucide-react';
import { formatUnitList } from '@/features/filters/lib/unit-filter';
import { DATE_FIELD_LABELS } from '@/features/filters/tracking-filter/lib/tracking-filter-config';
import TrackingFilterTable from '@/features/filters/tracking-filter/components/TrackingFilterTable';
import type { DateField, TrackingResultRow } from '@/features/filters/tracking-filter/types';

interface TrackingFilterResultsProps {
  filteredRows: TrackingResultRow[];
  dateType: DateField;
  fromDate: string;
  toDate: string;
  selectedBuyers: string[];
  showUnitProcess: boolean;
  previewUnits: string[];
  handleExportExcel: () => void;
}

/** Table card: the applied filters, the "Export Excel" button and the filtered tracking rows. */
export default function TrackingFilterResults({
  filteredRows,
  dateType,
  fromDate,
  toDate,
  selectedBuyers,
  showUnitProcess,
  previewUnits,
  handleExportExcel,
}: TrackingFilterResultsProps) {
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-base-200">
        <div>
          <h3 className="font-extrabold text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Filtered Tracking Results ({filteredRows.length} Orders)
          </h3>
          <p className="text-xs text-base-content/60">
            {DATE_FIELD_LABELS[dateType]}: {fromDate} to {toDate} | Buyer:{' '}
            {selectedBuyers.length === 0 ? 'All Buyers' : selectedBuyers.join(', ')}
            {showUnitProcess && ` | Unit: ${formatUnitList(previewUnits)}`}
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
          No matching tracking data found for the selected criteria.
        </div>
      ) : (
        <TrackingFilterTable filteredRows={filteredRows} showUnitProcess={showUnitProcess} />
      )}
    </div>
  );
}
