'use client';

import { Building2 } from 'lucide-react';

interface PlanFilterBuyerSelectProps {
  selectedBuyers: string[];
  setSelectedBuyers: (next: string[]) => void;
  buyerDropdownOpen: boolean;
  onToggle: () => void;
  buyerSearch: string;
  setBuyerSearch: (value: string) => void;
  allBuyers: string[];
  filteredBuyerOptions: string[];
}

/** Buyer multi-select (search box, "Select All" / "Check All" and one checkbox per buyer). */
export default function PlanFilterBuyerSelect({
  selectedBuyers,
  setSelectedBuyers,
  buyerDropdownOpen,
  onToggle,
  buyerSearch,
  setBuyerSearch,
  allBuyers,
  filteredBuyerOptions,
}: PlanFilterBuyerSelectProps) {
  return (
    <div className="relative">
      <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
        Buyer Selection ({selectedBuyers.length === 0 ? 'All Buyers' : `${selectedBuyers.length} Selected`})
      </label>
      <button
        type="button"
        onClick={onToggle}
        className="btn btn-outline btn-sm w-full justify-between font-normal text-xs"
      >
        <span className="truncate">
          {selectedBuyers.length === 0
            ? 'All Buyers (Click to filter)'
            : selectedBuyers.length <= 2
            ? selectedBuyers.join(', ')
            : `${selectedBuyers.length} Buyers Selected`}
        </span>
        <Building2 className="h-4 w-4 ml-2 opacity-50 shrink-0" />
      </button>

      {buyerDropdownOpen && (
        <div className="absolute z-20 mt-1 w-full bg-base-100 border border-base-300 rounded-lg shadow-xl p-3 max-h-64 flex flex-col gap-2">
          <input
            type="text"
            placeholder="Search buyer name..."
            value={buyerSearch}
            onChange={(e) => setBuyerSearch(e.target.value)}
            className="input input-bordered input-xs w-full"
          />
          <div className="flex items-center justify-between text-[11px] pb-1 border-b border-base-200 font-bold">
            <button
              type="button"
              onClick={() => setSelectedBuyers([])}
              className="text-primary hover:underline"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => setSelectedBuyers(allBuyers)}
              className="text-base-content/60 hover:underline"
            >
              Check All
            </button>
          </div>
          <div className="overflow-y-auto max-h-40 space-y-1 custom-scrollbar">
            {filteredBuyerOptions.map((b) => (
              <label key={b} className="flex items-center gap-2 p-1 rounded hover:bg-base-200 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={selectedBuyers.includes(b)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedBuyers([...selectedBuyers, b]);
                    else setSelectedBuyers(selectedBuyers.filter((x) => x !== b));
                  }}
                  className="checkbox checkbox-xs checkbox-primary"
                />
                <span className="truncate">{b}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
