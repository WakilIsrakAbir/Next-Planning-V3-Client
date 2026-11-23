'use client';

import { LogOut } from 'lucide-react';
import { IUser } from '@/types/user';
import { confirmPageLeave } from '@/lib/unsaved-changes';

/** The signed-in user's bar under the brand: initial, name, role and Sign Out. */
export default function SidebarProfile({ currentUser }: { currentUser: IUser | null }) {
  return (
    <div className="py-2 px-3 border-b border-base-300 flex items-center justify-between bg-base-200/50 shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm shadow-emerald-600/20">
          {(currentUser?.username || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <span className="text-xs font-bold block truncate text-base-content">
            {currentUser?.username || 'Loading...'}
          </span>
          <span className="text-[10px] text-base-content/60 block truncate font-medium">
            {currentUser?.role || 'Planner'}
          </span>
        </div>
      </div>
      <button
        onClick={() => {
          // Signing out leaves the page: with unsaved work, ask first.
          if (!confirmPageLeave()) return;
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('username');
          localStorage.removeItem('role');
          localStorage.removeItem('permissions');
          localStorage.removeItem('status');
          localStorage.removeItem('sessionExpiresAt');
          window.location.href = '/login';
        }}
        className="btn btn-ghost btn-circle btn-xs text-error hover:bg-error/10 shrink-0"
        title="Sign Out"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
