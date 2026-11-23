'use client';

import React from 'react';
import type { BuyerOption, PermissionSet } from '@/features/management/users/types';

interface BuyerAccessTabProps {
  permDraft: PermissionSet;
  updateDraft: (mutate: (draft: PermissionSet) => void) => void;
  buyersList: BuyerOption[];
  buyerSearch: string;
  setBuyerSearch: React.Dispatch<React.SetStateAction<string>>;
}

export default function BuyerAccessTab({ permDraft, updateDraft, buyersList, buyerSearch, setBuyerSearch }: BuyerAccessTabProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-base-content/60">
        Choose which buyer orders this user is authorized to view across all planning and tracking:
      </p>

      <div className="flex gap-4 p-3 bg-base-200/50 rounded-lg border border-base-300">
        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
          <input
            type="radio"
            name="accessType"
            value="all"
            checked={permDraft.buyers.accessType === 'all'}
            onChange={() => updateDraft((d) => (d.buyers.accessType = 'all'))}
            className="radio radio-primary radio-xs"
          />
          All Buyers (Full Access)
        </label>

        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
          <input
            type="radio"
            name="accessType"
            value="selected"
            checked={permDraft.buyers.accessType === 'selected'}
            onChange={() => updateDraft((d) => (d.buyers.accessType = 'selected'))}
            className="radio radio-primary radio-xs"
          />
          Selected Buyers Only
        </label>

        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
          <input
            type="radio"
            name="accessType"
            value="none"
            checked={permDraft.buyers.accessType === 'none'}
            onChange={() => updateDraft((d) => (d.buyers.accessType = 'none'))}
            className="radio radio-primary radio-xs"
          />
          No Buyer Access
        </label>
      </div>

      {permDraft.buyers.accessType === 'selected' && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              placeholder="Filter buyers..."
              value={buyerSearch}
              onChange={(e) => setBuyerSearch(e.target.value)}
              className="input input-bordered input-xs w-64"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => updateDraft((d) => (d.buyers.buyerIds = buyersList.map((b) => b.id)))}
                className="btn btn-outline btn-xs"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => updateDraft((d) => (d.buyers.buyerIds = []))}
                className="btn btn-outline btn-xs"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-72 overflow-y-auto p-3 bg-base-100 border border-base-300 rounded-lg custom-scrollbar">
            {buyersList
              .filter((b) => !buyerSearch || b.name.toLowerCase().includes(buyerSearch.toLowerCase()))
              .map((b) => {
                const checked = Array.isArray(permDraft.buyers.buyerIds) && permDraft.buyers.buyerIds.includes(b.id);
                return (
                  <label key={b.id} className="flex items-center gap-2 text-xs cursor-pointer p-1 rounded hover:bg-base-200">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const tick = e.target.checked;
                        updateDraft((d) => {
                          const currentIds = Array.isArray(d.buyers.buyerIds) ? d.buyers.buyerIds : [];
                          d.buyers.buyerIds = tick
                            ? [...new Set([...currentIds, b.id])]
                            : currentIds.filter((x) => x !== b.id);
                        });
                      }}
                      className="checkbox checkbox-primary checkbox-xs"
                    />
                    <span className="truncate">{b.name}</span>
                  </label>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
