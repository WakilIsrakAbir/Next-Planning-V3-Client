'use client';

interface PlanFilterDateFieldsProps {
  fromDate: string;
  setFromDate: (value: string) => void;
  toDate: string;
  setToDate: (value: string) => void;
  dateType: 'start' | 'end';
  setDateType: (value: 'start' | 'end') => void;
  statusFilter: 'All' | 'Confirm' | 'Tentative';
  setStatusFilter: (value: 'All' | 'Confirm' | 'Tentative') => void;
}

/** First filter row: From / To date, the date field to filter by and the plan status. */
export default function PlanFilterDateFields({
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  dateType,
  setDateType,
  statusFilter,
  setStatusFilter,
}: PlanFilterDateFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* From Date */}
      <div>
        <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
          From Date
        </label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => {
            setFromDate(e.target.value);
            if (toDate && toDate < e.target.value) setToDate(e.target.value);
          }}
          className="input input-bordered input-sm w-full"
        />
      </div>

      {/* To Date */}
      <div>
        <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
          To Date
        </label>
        <input
          type="date"
          value={toDate}
          min={fromDate}
          onChange={(e) => setToDate(e.target.value)}
          className="input input-bordered input-sm w-full"
        />
      </div>

      {/* Date Type Selector */}
      <div>
        <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
          Filter By Date Field
        </label>
        <select
          value={dateType}
          onChange={(e) => setDateType(e.target.value as 'start' | 'end')}
          className="select select-bordered select-sm w-full"
        >
          <option value="start">Plan Start Date</option>
          <option value="end">Plan End Date</option>
        </select>
      </div>

      {/* Plan Status */}
      <div>
        <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
          Plan Status
        </label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Confirm' | 'Tentative')}
          className="select select-bordered select-sm w-full"
        >
          <option value="All">All Plans (Confirm & Tentative)</option>
          <option value="Confirm">Confirm Only</option>
          <option value="Tentative">Tentative Only</option>
        </select>
      </div>
    </div>
  );
}
