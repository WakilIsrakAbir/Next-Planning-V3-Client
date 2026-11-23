'use client';

import React from 'react';
import { X, Sliders } from 'lucide-react';
import type { UserRole } from '@/types/user';
import InlineSpinner from '@/components/ui/InlineSpinner';
import { asUserRole } from '@/features/management/users/lib/helpers';

interface EditUserModalProps {
  editUsername: string;
  setEditUsername: React.Dispatch<React.SetStateAction<string>>;
  editRole: UserRole;
  setEditRole: React.Dispatch<React.SetStateAction<UserRole>>;
  editStatus: 'active' | 'inactive';
  setEditStatus: React.Dispatch<React.SetStateAction<'active' | 'inactive'>>;
  editPassword: string;
  setEditPassword: React.Dispatch<React.SetStateAction<string>>;
  savingEdit: boolean;
  setEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveEditProfile: (e: React.FormEvent) => Promise<void>;
  /** Opens the permission builder on this user's draft permissions. */
  onEditPermissions: () => void;
}

export default function EditUserModal({
  editUsername,
  setEditUsername,
  editRole,
  setEditRole,
  editStatus,
  setEditStatus,
  editPassword,
  setEditPassword,
  savingEdit,
  setEditModalOpen,
  handleSaveEditProfile,
  onEditPermissions,
}: EditUserModalProps) {
  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg">
        <div className="flex items-center justify-between pb-3 border-b border-base-300">
          <h3 className="font-extrabold text-base">Edit User Profile</h3>
          <button onClick={() => setEditModalOpen(false)} className="btn btn-ghost btn-circle btn-xs">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSaveEditProfile} className="space-y-4 pt-4 text-xs">
          <div className="space-y-1">
            <label className="font-bold">Username</label>
            <input
              required
              type="text"
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              className="input input-bordered input-sm w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold">Role</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(asUserRole(e.target.value))}
                className="select select-bordered select-sm w-full"
              >
                <option value="Viewer">Viewer</option>
                <option value="Planner">Planner</option>
                <option value="Approver">Approver</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value === 'inactive' ? 'inactive' : 'active')}
                className="select select-bordered select-sm w-full"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold">
              New Password <span className="font-normal text-base-content/50">(leave blank to keep current)</span>
            </label>
            <input
              type="password"
              placeholder="Optional new password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              className="input input-bordered input-sm w-full"
            />
          </div>

          <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 flex items-center justify-between">
            <div>
              <span className="font-bold block">Granular Permissions</span>
              <span className="text-[10px] text-base-content/60">Configure menu, actions, buyers, downloads.</span>
            </div>
            <button
              type="button"
              onClick={onEditPermissions}
              className="btn btn-primary btn-xs gap-1"
            >
              <Sliders className="h-3 w-3" /> Edit Permissions
            </button>
          </div>

          <div className="modal-action pt-2">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="btn btn-primary btn-sm font-bold"
            >
              {savingEdit ? <><InlineSpinner size={12} /> Saving...</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
