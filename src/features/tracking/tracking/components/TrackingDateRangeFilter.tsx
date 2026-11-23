'use client';

interface TrackingDateRangeFilterProps {
  startMin: string;
  setStartMin: (value: string) => void;
  startMax: string;
  setStartMax: (value: string) => void;
  endMin: string;
  setEndMin: (value: string) => void;
  endMax: string;
  setEndMax: (value: string) => void;
  handleApplyFilter: () => void;
  handleClearFilter: () => void;
}

/** One-row Start / End date range filter with "Apply Filter" and "Clear". */
export default function TrackingDateRangeFilter({
  startMin,
  setStartMin,
  startMax,
  setStartMax,
  endMin,
  setEndMin,
  endMax,
  setEndMax,
  handleApplyFilter,
  handleClearFilter,
}: TrackingDateRangeFilterProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap custom-scrollbar shrink-0 py-1">
      <span className="text-[11px] font-bold text-gray-600 bg-gray-100 dark:bg-base-200 dark:text-base-content/70 px-2 py-1 rounded">Start</span>
      <input
        type="date"
        value={startMin}
        onChange={(e) => setStartMin(e.target.value)}
        className="p-1 border border-gray-300 dark:border-base-300 rounded text-[11px] bg-base-100 focus:border-blue-500 outline-none w-[125px] shrink-0"
        title="Min Start Date"
      />
      <span className="text-gray-400 font-bold shrink-0">—</span>
      <input
        type="date"
        value={startMax}
        onChange={(e) => setStartMax(e.target.value)}
        className="p-1 border border-gray-300 dark:border-base-300 rounded text-[11px] bg-base-100 focus:border-blue-500 outline-none w-[125px] shrink-0"
        title="Max Start Date"
      />

      <span className="text-[11px] font-bold text-gray-600 bg-gray-100 dark:bg-base-200 dark:text-base-content/70 px-2 py-1 rounded ml-2 shrink-0">End</span>
      <input
        type="date"
        value={endMin}
        onChange={(e) => setEndMin(e.target.value)}
        className="p-1 border border-gray-300 dark:border-base-300 rounded text-[11px] bg-base-100 focus:border-blue-500 outline-none w-[125px] shrink-0"
        title="Min End Date"
      />
      <span className="text-gray-400 font-bold shrink-0">—</span>
      <input
        type="date"
        value={endMax}
        onChange={(e) => setEndMax(e.target.value)}
        className="p-1 border border-gray-300 dark:border-base-300 rounded text-[11px] bg-base-100 focus:border-blue-500 outline-none w-[125px] shrink-0"
        title="Max End Date"
      />

      <button
        onClick={handleApplyFilter}
        className="px-3 py-1 bg-green-600 text-white font-bold rounded text-[11px] hover:bg-green-700 transition-colors ml-2 shrink-0 shadow-xs"
      >
        Apply Filter
      </button>
      <button
        onClick={handleClearFilter}
        className="px-3 py-1 bg-gray-200 dark:bg-base-200 text-gray-600 dark:text-base-content/70 font-bold rounded text-[11px] hover:bg-gray-300 dark:hover:bg-base-300 transition-colors shrink-0"
      >
        Clear
      </button>
    </div>
  );
}
