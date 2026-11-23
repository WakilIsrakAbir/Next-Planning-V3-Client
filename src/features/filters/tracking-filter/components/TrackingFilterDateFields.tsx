'use client';

import type { DateField } from '@/features/filters/tracking-filter/types';

interface TrackingFilterDateFieldsProps {
  fromDate: string;
  setFromDate: (value: string) => void;
  toDate: string;
  setToDate: (value: string) => void;
  dateType: DateField;
  setDateType: (value: DateField) => void;
  resultFilter: 'all' | 'pass' | 'fail';
  setResultFilter: (value: 'all' | 'pass' | 'fail') => void;
}

/** First filter row: From / To date, the date field to filter by and the conformance status. */
export default function TrackingFilterDateFields({
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  dateType,
  setDateType,
  resultFilter,
  setResultFilter,
}: TrackingFilterDateFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

      <div>
        <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
          Filter By Date Field
        </label>
        <select
          value={dateType}
          onChange={(e) => setDateType(e.target.value as DateField)}
          className="select select-bordered select-sm w-full"
        >
          <option value="planStart">Plan Start Date</option>
          <option value="planEnd">Plan End Date</option>
          <option value="actualStart">Actual Start Date</option>
          <option value="actualEnd">Actual End Date</option>
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
          Conformance Status
        </label>
        <select
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value as 'all' | 'pass' | 'fail')}
          className="select select-bordered select-sm w-full"
        >
          <option value="all">All Orders</option>
          <option value="pass">Pass Only (Any Stage)</option>
          <option value="fail">Fail Only (Any Stage)</option>
        </select>
      </div>
    </div>
  );
}
