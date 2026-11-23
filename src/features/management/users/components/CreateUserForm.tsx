'use client';

import React from 'react';
import { Plus, Eye, EyeOff, Sliders } from 'lucide-react';
import type { UserRole } from '@/types/user';
import InlineSpinner from '@/components/ui/InlineSpinner';
import type {
  OpenPermissionBuilder,
  PermissionCounts,
  PermissionSet,
} from '@/features/management/users/types';
import { asUserRole } from '@/features/management/users/lib/helpers';

interface CreateUserFormProps {
  createUsername: string;
  setCreateUsername: React.Dispatch<React.SetStateAction<string>>;
  createPassword: string;
  setCreatePassword: React.Dispatch<React.SetStateAction<string>>;
  showCreatePassword: boolean;
  setShowCreatePassword: React.Dispatch<React.SetStateAction<boolean>>;
  createRole: UserRole;
  createTemplateVal: string;
  createPermissions: PermissionSet;
  creating: boolean;
  handleCreateUser: (e: React.FormEvent) => Promise<void>;
  handleCreateRoleChange: (newRole: UserRole) => void;
  handleCreateTemplateChange: (val: string) => void;
  openPermissionBuilder: OpenPermissionBuilder;
  getPermCounts: (p: PermissionSet | null | undefined) => PermissionCounts;
  totalMenuCount: number;
  totalActionCount: number;
  totalDownloadCount: number;
}

export default function CreateUserForm({
  createUsername,
  setCreateUsername,
  createPassword,
  setCreatePassword,
  showCreatePassword,
  setShowCreatePassword,
  createRole,
  createTemplateVal,
  createPermissions,
  creating,
  handleCreateUser,
  handleCreateRoleChange,
  handleCreateTemplateChange,
  openPermissionBuilder,
  getPermCounts,
  totalMenuCount,
  totalActionCount,
  totalDownloadCount,
}: CreateUserFormProps) {
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-base-300 bg-base-200/50 flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-sm">Create New User</h3>
          <p className="text-[11px] text-base-content/60">Configure role and granular permissions.</p>
        </div>
        <span className="badge badge-primary badge-sm font-extrabold">GRANULAR</span>
      </div>

      <form onSubmit={handleCreateUser} className="p-4 space-y-4 text-xs">
        <div className="space-y-1">
          <label className="font-bold">Username</label>
          <input
            required
            type="text"
            placeholder="e.g. knitting_planner"
            value={createUsername}
            onChange={(e) => setCreateUsername(e.target.value)}
            className="input input-bordered input-sm w-full"
          />
        </div>

        <div className="space-y-1">
          <label className="font-bold">Password</label>
          <div className="relative">
            <input
              required
              type={showCreatePassword ? 'text' : 'password'}
              placeholder="Minimum 6 characters"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              className="input input-bordered input-sm w-full pr-10"
            />
            <button
              type="button"
              onClick={() => setShowCreatePassword(!showCreatePassword)}
              className="absolute right-3 top-2 text-base-content/50"
            >
              {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-bold">Role</label>
            <select
              value={createRole}
              onChange={(e) => handleCreateRoleChange(asUserRole(e.target.value))}
              className="select select-bordered select-sm w-full"
            >
              <option value="Viewer">Viewer</option>
              <option value="Planner">Planner</option>
              <option value="Approver">Approver</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-bold">Permission Template</label>
            <select
              value={createTemplateVal}
              onChange={(e) => handleCreateTemplateChange(e.target.value)}
              className="select select-bordered select-sm w-full"
            >
              <option value="Viewer">Viewer Default</option>
              <option value="Planner">Planner Default</option>
              <option value="Approver">Approver Default</option>
              <option value="Admin">Admin Default</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
        </div>

        {/* Permission Configuration Button & Live Summary */}
        <div className="pt-2 border-t border-base-300">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="font-bold block">Permissions Configuration</span>
              <span className="text-[10px] text-base-content/50">Tune menus, actions, buyers, downloads.</span>
            </div>
            <button
              type="button"
              onClick={() => openPermissionBuilder('create', createPermissions)}
              className="btn btn-neutral btn-xs gap-1.5"
            >
              <Sliders className="h-3 w-3" /> Configure
            </button>
          </div>

          {/* Summary Card */}
          {(() => {
            const c = getPermCounts(createPermissions);
            const bType = createPermissions.buyers?.accessType || 'all';
            const bText =
              bType === 'all'
                ? 'All buyers'
                : bType === 'none'
                ? 'No buyer'
                : `${Array.isArray(createPermissions.buyers?.buyerIds) ? createPermissions.buyers.buyerIds.length : 0} selected`;

            return (
              <div className="grid grid-cols-2 gap-2 bg-base-200/50 p-2.5 rounded-lg border border-base-300 text-[11px]">
                <div>
                  <span className="text-base-content/60 block text-[10px]">Menu access:</span>
                  <span className="font-black text-primary">
                    {c.menu} / {totalMenuCount}
                  </span>
                </div>
                <div>
                  <span className="text-base-content/60 block text-[10px]">Save / Actions:</span>
                  <span className="font-black text-primary">
                    {c.action} / {totalActionCount}
                  </span>
                </div>
                <div>
                  <span className="text-base-content/60 block text-[10px]">Buyer scope:</span>
                  <span className="font-black">{bText}</span>
                </div>
                <div>
                  <span className="text-base-content/60 block text-[10px]">Downloads:</span>
                  <span className="font-black">
                    {c.download} / {totalDownloadCount}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        <button
          type="submit"
          disabled={creating}
          className="btn btn-primary btn-sm w-full font-bold shadow-md mt-2"
        >
          {creating ? <InlineSpinner size={14} /> : <Plus className="h-4 w-4" />}
          Create User
        </button>
      </form>
    </div>
  );
}
