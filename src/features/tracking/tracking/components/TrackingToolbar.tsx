'use client';

import { Search } from 'lucide-react';

interface TrackingToolbarProps {
  activeTab: 'Pending' | 'Complete';
  setActiveTab: (tab: 'Pending' | 'Complete') => void;
  setPage: (page: number) => void;
  search: string;
  setSearch: (value: string) => void;
  runSearch: () => void;
}

/** Pending / Completed tabs and the global Booking No search. */
export default function TrackingToolbar({
  activeTab,
  setActiveTab,
  setPage,
  search,
  setSearch,
  runSearch,
}: TrackingToolbarProps) {
  return (
    <div className="flex-none flex items-center justify-between border-b border-base-300 pb-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setActiveTab('Pending');
            setPage(1);
          }}
          className={`btn btn-sm font-bold ${
            activeTab === 'Pending' ? 'btn-primary' : 'btn-ghost text-base-content/70'
          }`}
        >
          Pending Execution
        </button>
        <button
          onClick={() => {
            setActiveTab('Complete');
            setPage(1);
          }}
          className={`btn btn-sm font-bold ${
            activeTab === 'Complete' ? 'btn-success text-white' : 'btn-ghost text-base-content/70'
          }`}
        >
          Completed Execution
        </button>
      </div>

      {/* Global Search */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-base-content/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Booking No..."
            className="input input-bordered input-sm w-48 sm:w-64 pl-8 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                runSearch();
              }
            }}
          />
        </div>
        <button
          onClick={runSearch}
          className="btn btn-primary btn-sm font-bold text-xs"
        >
          Search
        </button>
      </div>
    </div>
  );
}
