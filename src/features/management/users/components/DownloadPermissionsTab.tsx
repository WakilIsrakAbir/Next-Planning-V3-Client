'use client';

import type { PermissionSet } from '@/features/management/users/types';
import { DOWNLOAD_GROUPS } from '@/features/management/users/lib/permissions';
import PermissionGroupCard from '@/features/management/users/components/PermissionGroupCard';

interface DownloadPermissionsTabProps {
  permDraft: PermissionSet;
  setFlags: (section: 'actions' | 'downloads', keys: string[], value: boolean) => void;
}

export default function DownloadPermissionsTab({ permDraft, setFlags }: DownloadPermissionsTabProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-base-content/60">
        Grant authorization to export and download Excel spreadsheets and PDF reports:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DOWNLOAD_GROUPS.map((category) => (
          <PermissionGroupCard
            key={category.title}
            header={<span className="font-extrabold text-xs">{category.title}</span>}
            items={category.items}
            flags={permDraft.downloads}
            onSetFlags={(keys, value) => setFlags('downloads', keys, value)}
          />
        ))}
      </div>
    </div>
  );
}
