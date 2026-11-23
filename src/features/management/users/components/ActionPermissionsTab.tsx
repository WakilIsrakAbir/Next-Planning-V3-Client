'use client';

import type { PermissionSet } from '@/features/management/users/types';
import { ACTION_GROUPS } from '@/features/management/users/lib/permissions';
import PermissionGroupCard from '@/features/management/users/components/PermissionGroupCard';

interface ActionPermissionsTabProps {
  permDraft: PermissionSet;
  setFlags: (section: 'actions' | 'downloads', keys: string[], value: boolean) => void;
}

export default function ActionPermissionsTab({ permDraft, setFlags }: ActionPermissionsTabProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-base-content/60">
        Grant operational permissions for saving data, uploads, and workflow status changes:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ACTION_GROUPS.map((category) => (
          <PermissionGroupCard
            key={category.title}
            header={
              <span className="font-extrabold text-xs flex items-center gap-1.5">
                <span className="text-success">{category.icon}</span>
                {category.title}
              </span>
            }
            items={category.items}
            flags={permDraft.actions}
            onSetFlags={(keys, value) => setFlags('actions', keys, value)}
          />
        ))}
      </div>
    </div>
  );
}
