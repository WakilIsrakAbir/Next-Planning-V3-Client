'use client';

import type { MenuGroup, PermissionSet } from '@/features/management/users/types';
import { isRecord } from '@/features/management/users/lib/helpers';
import { permissionMenuItems } from '@/features/management/users/lib/permissions';
import PermissionGroupCard from '@/features/management/users/components/PermissionGroupCard';

interface MenuPermissionsTabProps {
  menuGroups: MenuGroup[];
  permDraft: PermissionSet;
  permDraftBase: PermissionSet | null;
  setMenuFlags: (groupKey: string, keys: string[], value: boolean) => void;
}

export default function MenuPermissionsTab({ menuGroups, permDraft, permDraftBase, setMenuFlags }: MenuPermissionsTabProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-base-content/60">
        Toggle access to sidebar menu groups and specific submenus:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {menuGroups.map((group) => {
          const groupPerms = isRecord(permDraft.menus[group.key]) ? permDraft.menus[group.key] : {};
          const items = permissionMenuItems(group, permDraftBase, permDraft);

          return (
            <PermissionGroupCard
              key={group.key}
              header={
                <span className="font-extrabold text-xs flex items-center gap-1.5">
                  <span className="text-primary">{group.icon}</span>
                  {group.title}
                </span>
              }
              items={items}
              flags={groupPerms}
              onSetFlags={(keys, value) => setMenuFlags(group.key, keys, value)}
            />
          );
        })}
      </div>
    </div>
  );
}
