'use client';

import { Trash2, Edit, Sliders } from 'lucide-react';
import type {
  DirectoryUser,
  OpenPermissionBuilder,
  PermissionCounts,
  PermissionSet,
} from '@/features/management/users/types';

interface UserCardProps {
  u: DirectoryUser;
  getPermCounts: (p: PermissionSet | null | undefined) => PermissionCounts;
  totalMenuCount: number;
  totalActionCount: number;
  totalDownloadCount: number;
  handleDeleteUser: (id: string, name: string) => Promise<void>;
  handleToggleStatus: (user: DirectoryUser) => Promise<void>;
  openPermissionBuilder: OpenPermissionBuilder;
  openEditModal: (u: DirectoryUser) => void;
}

export default function UserCard({
  u,
  getPermCounts,
  totalMenuCount,
  totalActionCount,
  totalDownloadCount,
  handleDeleteUser,
  handleToggleStatus,
  openPermissionBuilder,
  openEditModal,
}: UserCardProps) {
  const c = getPermCounts(u.permissions);
  const bType = u.permissions.buyers?.accessType || 'all';
  const bText =
    bType === 'all'
      ? 'All buyers'
      : bType === 'none'
      ? 'No buyer'
      : `${Array.isArray(u.permissions.buyers?.buyerIds) ? u.permissions.buyers.buyerIds.length : 0} selected`;

  const roleBadgeClass =
    u.role === 'Admin'
      ? 'badge-error text-white'
      : u.role === 'Approver'
      ? 'badge-secondary text-white'
      : u.role === 'Planner'
      ? 'badge-info text-white'
      : 'badge-ghost';

  return (
    <div className="card bg-base-100 border border-base-300 p-4 shadow-sm hover:shadow transition-shadow relative overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="avatar placeholder">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-content font-black text-sm flex items-center justify-center">
              {(u.username || 'U').slice(0, 2).toUpperCase()}
            </div>
          </div>
          <div>
            <h4 className="font-extrabold text-sm">{u.username || 'Unknown'}</h4>
            <span className={`badge badge-xs font-bold ${roleBadgeClass}`}>{u.role}</span>
          </div>
        </div>

        <button
          onClick={() => handleDeleteUser(u.id, u.username)}
          className="btn btn-ghost btn-circle btn-xs text-error hover:bg-error/10"
          title="Delete User"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Permission Counts Tiles */}
      <div className="grid grid-cols-4 gap-2 bg-base-200/50 p-2.5 rounded-lg border border-base-300 mt-3 text-[10px]">
        <div>
          <span className="text-base-content/50 block">Menus</span>
          <span className="font-bold text-primary">
            {c.menu}/{totalMenuCount}
          </span>
        </div>
        <div>
          <span className="text-base-content/50 block">Actions</span>
          <span className="font-bold text-primary">
            {c.action}/{totalActionCount}
          </span>
        </div>
        <div>
          <span className="text-base-content/50 block">Downloads</span>
          <span className="font-bold">
            {c.download}/{totalDownloadCount}
          </span>
        </div>
        <div>
          <span className="text-base-content/50 block">Buyers</span>
          <span className="font-bold truncate">{bText}</span>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-between border-t border-base-300 pt-3 mt-3">
        {/* Active Status Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={u.status === 'active'}
            onChange={() => handleToggleStatus(u)}
            className="toggle toggle-success toggle-xs"
          />
          <span className="text-[11px] font-bold">
            {u.status === 'active' ? 'Active' : 'Inactive'}
          </span>
        </label>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() =>
              openPermissionBuilder('user', u.permissions, { id: u.id, username: u.username })
            }
            className="btn btn-ghost btn-xs text-primary font-bold gap-1"
          >
            <Sliders className="h-3 w-3" /> Permissions
          </button>

          <button
            onClick={() => openEditModal(u)}
            className="btn btn-outline btn-xs gap-1"
          >
            <Edit className="h-3 w-3" /> Edit
          </button>
        </div>
      </div>
    </div>
  );
}
