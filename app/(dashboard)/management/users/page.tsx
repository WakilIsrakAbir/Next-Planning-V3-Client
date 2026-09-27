'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  Lock,
  X,
  Search,
} from 'lucide-react';
import { API_BASE } from '@/lib/constants';
import { formatDateDisplay } from '@/lib/date-utils';
import { IUser, UserRole } from '@/types/user';

export default function UserManagementPage() {
  const [users, setUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Available buyers for permission checklists
  const [allBuyers, setAllBuyers] = useState<string[]>([]);

  // Add / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('Viewer');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');

  // Buyer Permission state
  const [buyerAccessType, setBuyerAccessType] = useState<'all' | 'selected' | 'none'>('all');
  const [selectedBuyerIds, setSelectedBuyerIds] = useState<string[]>([]);
  const [buyerSearch, setBuyerSearch] = useState('');

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/auth/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllBuyers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/orders/buyers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAllBuyers(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchUsers();
    fetchAllBuyers();
  }, []);

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedUserId(null);
    setFormUsername('');
    setFormPassword('');
    setFormRole('Viewer');
    setFormStatus('active');
    setBuyerAccessType('all');
    setSelectedBuyerIds([]);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (u: IUser) => {
    setIsEditing(true);
    setSelectedUserId(u.id || (u as any)._id);
    setFormUsername(u.username);
    setFormPassword('');
    setFormRole(u.role);
    setFormStatus(u.status);

    const bPerms = u.permissions?.buyers;
    setBuyerAccessType(bPerms?.accessType || 'all');
    setSelectedBuyerIds(bPerms?.buyerIds || []);
    setFormError(null);
    setShowModal(true);
  };

  const toggleBuyerId = (bId: string) => {
    const norm = bId.toLowerCase().replace(/[^a-z0-9]/g, '');
    setSelectedBuyerIds((prev) =>
      prev.includes(norm) ? prev.filter((id) => id !== norm) : [...prev, norm]
    );
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    const payload: any = {
      username: formUsername.trim(),
      role: formRole,
      status: formStatus,
      permissions: {
        buyers: {
          accessType: buyerAccessType,
          buyerIds: buyerAccessType === 'selected' ? selectedBuyerIds : [],
        },
      },
    };

    if (formPassword && formPassword.trim()) {
      payload.password = formPassword.trim();
    }

    try {
      const token = localStorage.getItem('token');
      const url = isEditing
        ? `${API_BASE}/api/auth/user/${selectedUserId}`
        : `${API_BASE}/api/auth/register`;

      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Operation failed.');
      }

      setToastMessage(data.message || 'User saved successfully!');
      setShowModal(false);
      setTimeout(() => setToastMessage(null), 3000);
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete user account "${name}"?`)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/auth/user/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete user.');
      }

      setToastMessage(data.message || 'User deleted successfully.');
      setTimeout(() => setToastMessage(null), 3000);
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredBuyers = allBuyers.filter((b) =>
    b.toLowerCase().includes(buyerSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="toast toast-top toast-end z-50">
          <div className="alert alert-success text-xs font-bold text-white shadow-lg">
            <CheckCircle className="h-4 w-4" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            User & Buyer Permission Administration
          </h2>
          <p className="text-xs text-base-content/60">
            Control user access roles, active account states, and strict brand account (buyer) visibility checklists.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="btn btn-primary btn-sm font-bold shadow-md shadow-primary/25"
        >
          <UserPlus className="w-4 h-4 mr-1" /> Add New Team User
        </button>
      </div>

      {/* Users Table */}
      <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead className="bg-base-200/60 text-xs">
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Buyer Access</th>
                <th>Account Status</th>
                <th>Last Active</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <span className="loading loading-spinner text-primary" />
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const bPerm = u.permissions?.buyers;
                  const accessType = bPerm?.accessType || 'all';

                  return (
                    <tr key={u.id || (u as any)._id} className="hover">
                      <td className="font-bold flex items-center gap-2">
                        <div className="avatar placeholder">
                          <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        {u.username}
                      </td>
                      <td>
                        <span
                          className={`badge badge-sm font-bold ${
                            u.role === 'Admin'
                              ? 'badge-error text-white'
                              : u.role === 'Approver'
                              ? 'badge-secondary'
                              : u.role === 'Planner'
                              ? 'badge-primary'
                              : 'badge-neutral'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td>
                        {accessType === 'all' ? (
                          <span className="badge badge-sm badge-success text-white font-semibold">
                            All Buyers
                          </span>
                        ) : accessType === 'none' ? (
                          <span className="badge badge-sm badge-error text-white font-semibold">
                            No Buyers Assigned
                          </span>
                        ) : (
                          <span className="badge badge-sm badge-info text-white font-semibold">
                            {bPerm?.buyerIds?.length || 0} Selected Buyers
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge badge-sm ${
                            u.status === 'active' ? 'badge-outline badge-success font-bold' : 'badge-neutral'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td>{u.lastActive ? formatDateDisplay(u.lastActive) : 'Never'}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(u)}
                            className="btn btn-ghost btn-xs text-primary"
                            title="Edit Permissions"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id || (u as any)._id, u.username)}
                            className="btn btn-ghost btn-xs text-error"
                            title="Delete Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Create / Edit Modal */}
      {showModal && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-2xl p-6">
            <div className="flex items-center justify-between border-b border-base-300 pb-3">
              <h3 className="font-bold text-base">
                {isEditing ? `Edit User: ${formUsername}` : 'Create New Team Member'}
              </h3>
              <button onClick={() => setShowModal(false)} className="btn btn-sm btn-circle btn-ghost">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 py-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label font-bold py-1">Username</label>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="e.g. planner_john"
                    className="input input-bordered input-sm"
                    required
                    disabled={isEditing}
                  />
                </div>

                <div className="form-control">
                  <label className="label font-bold py-1">
                    {isEditing ? 'New Password (leave empty to retain)' : 'Password'}
                  </label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input input-bordered input-sm"
                    required={!isEditing}
                  />
                </div>

                <div className="form-control">
                  <label className="label font-bold py-1">Role Hierarchy</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="select select-bordered select-sm font-bold"
                  >
                    <option value="Admin">Admin (Unrestricted access)</option>
                    <option value="Approver">Approver (Confirm & approve)</option>
                    <option value="Planner">Planner (Manage & save plans)</option>
                    <option value="Viewer">Viewer (Read-only)</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label font-bold py-1">Account State</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="select select-bordered select-sm font-bold"
                  >
                    <option value="active">Active (Access allowed)</option>
                    <option value="inactive">Inactive (Deactivated)</option>
                  </select>
                </div>
              </div>

              {/* Granular Buyer Access Control */}
              <div className="border-t border-base-200 pt-3">
                <label className="label font-bold py-1">Buyer Portfolio Access</label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="buyerAccess"
                      checked={buyerAccessType === 'all'}
                      onChange={() => setBuyerAccessType('all')}
                      className="radio radio-xs radio-primary"
                    />
                    <span>All Buyers</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="buyerAccess"
                      checked={buyerAccessType === 'selected'}
                      onChange={() => setBuyerAccessType('selected')}
                      className="radio radio-xs radio-primary"
                    />
                    <span>Specific Buyers</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="buyerAccess"
                      checked={buyerAccessType === 'none'}
                      onChange={() => setBuyerAccessType('none')}
                      className="radio radio-xs radio-primary"
                    />
                    <span>No Access</span>
                  </label>
                </div>

                {buyerAccessType === 'selected' && (
                  <div className="p-3 bg-base-200/50 rounded-xl border border-base-300 space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={buyerSearch}
                        onChange={(e) => setBuyerSearch(e.target.value)}
                        placeholder="Search brand accounts..."
                        className="input input-bordered input-xs w-full pl-7"
                      />
                      <Search className="absolute left-2 top-2 h-3 w-3 text-base-content/50" />
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                      {filteredBuyers.map((b) => {
                        const norm = b.toLowerCase().replace(/[^a-z0-9]/g, '');
                        const isChecked = selectedBuyerIds.includes(norm);
                        return (
                          <label
                            key={b}
                            className="flex items-center gap-2 p-1 rounded hover:bg-base-200 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleBuyerId(b)}
                              className="checkbox checkbox-xs checkbox-primary"
                            />
                            <span className="font-semibold">{b}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {formError && (
                <div className="alert alert-error text-xs font-semibold py-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-base-200 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-sm btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="btn btn-sm btn-primary font-bold shadow-md shadow-primary/25"
                >
                  {formLoading ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : isEditing ? (
                    'Update Account'
                  ) : (
                    'Create Account'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
