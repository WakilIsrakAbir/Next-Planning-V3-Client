'use client';

import { Users, RefreshCw } from 'lucide-react';

interface UsersHeaderProps {
  loadUsers: () => Promise<void>;
}

export default function UsersHeader({ loadUsers }: UsersHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          User & Granular Permission Management
        </h2>
        <p className="text-xs text-base-content/60">
          Define granular access across menus, saving actions, buyer scoping, and excel downloads.
        </p>
      </div>

      <button onClick={() => void loadUsers()} className="btn btn-outline btn-sm gap-2">
        <RefreshCw className="h-4 w-4" /> Refresh
      </button>
    </div>
  );
}
