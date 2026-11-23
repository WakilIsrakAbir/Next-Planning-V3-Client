'use client';

import { Factory } from 'lucide-react';
import { formatUnitLabel, formatUnitList } from '@/features/filters/lib/unit-filter';

export interface UnitMultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  open: boolean;
  onToggle: () => void;
}

/** Unit multi-select ("All Units" + one checkbox per unit), styled like the Buyer filter. */
export default function UnitMultiSelect({ options, selected, onChange, open, onToggle }: UnitMultiSelectProps) {
  const allChecked = selected.length === 0;

  return (
    <div className="relative">
      <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
        Unit Selection ({allChecked ? 'All Units' : `${selected.length} Selected`})
      </label>
      <button
        type="button"
        onClick={onToggle}
        title={formatUnitList(selected)}
        className="btn btn-outline btn-sm w-full justify-between font-normal text-xs"
      >
        <span className="truncate">{formatUnitLabel(selected)}</span>
        <Factory className="h-4 w-4 ml-2 opacity-50 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-base-100 border border-base-300 rounded-lg shadow-xl p-3 max-h-64 flex flex-col gap-2">
          <label className="flex items-center gap-2 p-1 pb-2 border-b border-base-200 cursor-pointer text-xs font-bold">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => {
                // Unchecking "All Units" with nothing else picked keeps it checked (legacy behaviour).
                if (e.target.checked) onChange([]);
              }}
              className="checkbox checkbox-xs checkbox-primary"
            />
            All Units
          </label>
          <div className="overflow-y-auto max-h-40 space-y-1 custom-scrollbar">
            {options.length === 0 ? (
              <div className="p-1 text-xs text-base-content/50">No units found</div>
            ) : (
              options.map((u) => (
                <label key={u} className="flex items-center gap-2 p-1 rounded hover:bg-base-200 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={selected.includes(u)}
                    onChange={(e) =>
                      onChange(
                        e.target.checked
                          ? options.filter((o) => o === u || selected.includes(o))
                          : selected.filter((x) => x !== u)
                      )
                    }
                    className="checkbox checkbox-xs checkbox-primary"
                  />
                  <span className="truncate">{u}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
