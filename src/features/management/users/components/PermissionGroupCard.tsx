'use client';

import React from 'react';
import type { PermissionFlags, PermissionItem } from '@/features/management/users/types';

interface PermissionGroupCardProps {
  /** The group title shown left of the group's toggle. */
  header: React.ReactNode;
  items: PermissionItem[];
  flags: PermissionFlags;
  /** Sets the given switches of this group to one value. */
  onSetFlags: (keys: string[], value: boolean) => void;
}

/* One permission group of the builder: a toggle for the whole group (indeterminate when only some
   switches are on) and a checkbox per switch. */
export default function PermissionGroupCard({ header, items, flags, onSetFlags }: PermissionGroupCardProps) {
  const allChecked = items.every(([k]) => flags[k]);
  const someChecked = items.some(([k]) => flags[k]);

  return (
    <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
      <div className="flex items-center justify-between pb-2 border-b border-base-200">
        {header}
        <input
          type="checkbox"
          checked={allChecked}
          ref={(el) => {
            if (el) el.indeterminate = someChecked && !allChecked;
          }}
          onChange={(e) =>
            onSetFlags(
              items.map(([k]) => k),
              e.target.checked
            )
          }
          className="toggle toggle-primary toggle-xs"
        />
      </div>

      <div className="pt-2 space-y-1.5">
        {items.map(([k, label]) => (
          <label key={k} className="flex items-center justify-between text-xs cursor-pointer hover:bg-base-200/50 p-1 rounded">
            <span>{label}</span>
            <input
              type="checkbox"
              checked={Boolean(flags[k])}
              onChange={(e) => onSetFlags([k], e.target.checked)}
              className="checkbox checkbox-primary checkbox-xs"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
