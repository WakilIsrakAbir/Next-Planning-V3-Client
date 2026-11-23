'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { UserRole } from '@/types/user';
import type {
  ApiUser,
  DirectoryUser,
  PermissionItem,
  PermissionScope,
  PermissionSet,
  PermissionTab,
} from '@/features/management/users/types';
import { asUserRole, errorMessage, isRecord } from '@/features/management/users/lib/helpers';
import {
  ACTION_GROUPS,
  DOWNLOAD_GROUPS,
  clonePermissions,
  forEachSwitch,
  itemCount,
  makeTemplate,
  normalizePermissions,
  permissionCounts,
  withBatchUnits,
} from '@/features/management/users/lib/permissions';
import { loadBatchUnitItems } from '@/features/management/users/lib/batch-units';
import { usersCache } from '@/features/management/users/lib/users-cache';
import UsersToast from '@/features/management/users/components/UsersToast';
import UsersHeader from '@/features/management/users/components/UsersHeader';
import UserStatCards from '@/features/management/users/components/UserStatCards';
import CreateUserForm from '@/features/management/users/components/CreateUserForm';
import UsersFilterBar from '@/features/management/users/components/UsersFilterBar';
import UserDirectory from '@/features/management/users/components/UserDirectory';
import PermissionBuilderModal from '@/features/management/users/components/PermissionBuilderModal';
import EditUserModal from '@/features/management/users/components/EditUserModal';

export default function UserManagementScreen() {
  const [users, setUsers] = useState<ApiUser[]>(() => usersCache.users || []);
  const [loading, setLoading] = useState(() => !usersCache.users);
  const [buyersList, setBuyersList] = useState<{ id: string; name: string }[]>(() => usersCache.buyersList || []);
  const [batchUnitItems, setBatchUnitItems] = useState<PermissionItem[] | null>(() => usersCache.batchUnitItems);

  // Menu groups with the current Batch Plan / Batch Card unit switches
  const menuGroups = useMemo(() => withBatchUnits(batchUnitItems), [batchUnitItems]);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Create Form State
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createRole, setCreateRole] = useState<UserRole>('Viewer');
  const [createTemplateVal, setCreateTemplateVal] = useState('Viewer');
  // Permissions tuned in the builder ("Custom"); otherwise the selected role template is used.
  const [createCustomPermissions, setCreateCustomPermissions] = useState<PermissionSet | null>(null);
  const [creating, setCreating] = useState(false);

  // Permission Builder Modal State
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [permModalScope, setPermModalScope] = useState<PermissionScope>('create');
  const [permTargetUser, setPermTargetUser] = useState<{ id: string; username: string } | null>(null);
  const [permDraft, setPermDraft] = useState<PermissionSet | null>(null);
  // The draft as the builder opened, so a "not in use" unit switch stays visible after it is unticked.
  const [permDraftBase, setPermDraftBase] = useState<PermissionSet | null>(null);
  const [savingPerms, setSavingPerms] = useState(false);
  const [permActiveTab, setPermActiveTab] = useState<PermissionTab>('menu');
  const [buyerSearch, setBuyerSearch] = useState('');

  // Edit User Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('Viewer');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editPassword, setEditPassword] = useState('');
  const [editPermissionsDraft, setEditPermissionsDraft] = useState<PermissionSet | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Notification Toast
  const [toastMsg, setToastMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const showToast = useCallback((text: string, error = false) => {
    setToastMsg({ text, error });
    setTimeout(() => setToastMsg(null), 3000);
  }, []);

  // 1. Fetch Users
  // State is set only in the promise callbacks, never synchronously (this also runs from an effect).
  const loadUsers = useCallback(
    () =>
      apiClient<ApiUser[]>('/api/auth/users')
        .then((data) => {
          usersCache.users = Array.isArray(data) ? data : [];
          setUsers(usersCache.users);
        })
        .catch((err: unknown) => showToast(errorMessage(err, 'Failed to fetch users'), true))
        .finally(() => setLoading(false)),
    [showToast]
  );

  // 2. Fetch Buyers for dynamic checklist
  const loadBuyers = useCallback(
    () =>
      apiClient<string[]>('/api/orders/buyers')
        .then((data) => {
          const formatted = (Array.isArray(data) ? data : []).map((b) => ({
            id: String(b).toLowerCase().replace(/[^a-z0-9]/g, ''),
            name: String(b),
          }));
          const uniqueMap = new Map<string, { id: string; name: string }>();
          formatted.forEach((item) => {
            if (item.id && !uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
          });
          usersCache.buyersList = Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name));
          setBuyersList(usersCache.buyersList);
        })
        .catch(() => {}),
    []
  );

  // 3. Batch Plan / Batch Card unit switches (the static five floors stay if the units cannot be loaded)
  const loadBatchUnits = useCallback(
    () =>
      loadBatchUnitItems().then((items) => {
        if (items) {
          usersCache.batchUnitItems = items;
          setBatchUnitItems(items);
        }
      }),
    []
  );

  useEffect(() => {
    void loadUsers();
    void loadBuyers();
    void loadBatchUnits();
  }, [loadUsers, loadBuyers, loadBatchUnits]);

  // Users with complete permissions: old or partial permission objects are filled from the role template.
  const directoryUsers = useMemo<DirectoryUser[]>(
    () =>
      users.map((u) => ({
        id: String(u._id || u.id || ''),
        username: u.username || '',
        role: u.role || 'Viewer',
        status: u.status || 'active',
        permissions: normalizePermissions(u.permissions, u.role, menuGroups),
      })),
    [users, menuGroups]
  );

  const createPermissions = useMemo(
    () =>
      createTemplateVal === 'Custom' && createCustomPermissions
        ? createCustomPermissions
        : makeTemplate(createTemplateVal, menuGroups),
    [createTemplateVal, createCustomPermissions, menuGroups]
  );

  // Handle Role change in create form
  const handleCreateRoleChange = (newRole: UserRole) => {
    setCreateRole(newRole);
    setCreateTemplateVal(newRole);
    setCreateCustomPermissions(null);
  };

  // Handle Template change in create form
  const handleCreateTemplateChange = (val: string) => {
    if (val === 'Custom') {
      // Keep the permissions shown now, as the old page does.
      setCreateCustomPermissions(clonePermissions(createPermissions));
      setCreateTemplateVal('Custom');
      return;
    }
    setCreateTemplateVal(val);
    setCreateCustomPermissions(null);
    setCreateRole(asUserRole(val));
    showToast(`${val} permission template applied.`);
  };

  // Counts helpers
  const totalMenuCount = useMemo(() => itemCount(menuGroups), [menuGroups]);
  const totalActionCount = useMemo(() => itemCount(ACTION_GROUPS), []);
  const totalDownloadCount = useMemo(() => itemCount(DOWNLOAD_GROUPS), []);

  const getPermCounts = (p: PermissionSet | null | undefined) => permissionCounts(p, menuGroups);

  // Open Permission Builder
  const openPermissionBuilder = (
    scope: PermissionScope,
    source: PermissionSet,
    target: { id: string; username: string } | null = null
  ) => {
    const draft = clonePermissions(source);
    setPermModalScope(scope);
    setPermTargetUser(target);
    setPermDraft(draft);
    setPermDraftBase(draft);
    setPermModalOpen(true);
  };

  const closePermissionBuilder = () => {
    setPermModalOpen(false);
    setPermDraft(null);
    setPermDraftBase(null);
    setPermTargetUser(null);
  };

  // Every change in the builder works on a copy of the draft.
  const updateDraft = (mutate: (draft: PermissionSet) => void) => {
    setPermDraft((prev) => {
      if (!prev) return prev;
      const next = clonePermissions(prev);
      mutate(next);
      return next;
    });
  };

  const setMenuFlags = (groupKey: string, keys: string[], value: boolean) =>
    updateDraft((draft) => {
      if (!isRecord(draft.menus[groupKey])) draft.menus[groupKey] = {};
      keys.forEach((k) => {
        draft.menus[groupKey][k] = value;
      });
    });

  const setFlags = (section: 'actions' | 'downloads', keys: string[], value: boolean) =>
    updateDraft((draft) => {
      keys.forEach((k) => {
        draft[section][k] = value;
      });
    });

  // Apply Permissions from Builder
  const handleApplyPermissions = async () => {
    if (!permDraft) return;
    // Every switch shown is written (as the old page does), so new keys are stored as true/false.
    const applied = clonePermissions(permDraft);
    forEachSwitch(applied, menuGroups, [permDraftBase, permDraft], (flags, k) => {
      flags[k] = Boolean(flags[k]);
    });

    if (permModalScope === 'create') {
      setCreateCustomPermissions(applied);
      setCreateTemplateVal('Custom');
      closePermissionBuilder();
      showToast('Permissions applied to new user form.');
    } else if (permModalScope === 'edit') {
      setEditPermissionsDraft(applied);
      closePermissionBuilder();
      showToast('Permissions applied to draft!');
    } else if (permTargetUser) {
      try {
        setSavingPerms(true);
        await apiClient(`/api/auth/user/${permTargetUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({ permissions: applied }),
        });
        showToast(`Permissions updated for "${permTargetUser.username}".`);
        closePermissionBuilder();
        void loadUsers();
      } catch (err) {
        showToast(errorMessage(err, 'Failed to update permissions.'), true);
      } finally {
        setSavingPerms(false);
      }
    }
  };

  // Select/Clear All in Permission Builder (every switch shown, plus buyer access)
  const handleBulkTogglePerms = (select: boolean) => {
    updateDraft((draft) => {
      forEachSwitch(draft, menuGroups, [permDraftBase, permDraft], (flags, k) => {
        flags[k] = select;
      });

      // Buyers
      if (select) {
        draft.buyers.accessType = 'all';
      } else {
        draft.buyers.accessType = 'none';
        draft.buyers.buyerIds = [];
      }
    });
  };

  // 4. Create User Submit
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUsername.trim() || !createPassword) {
      showToast('Username and password are required.', true);
      return;
    }

    try {
      setCreating(true);
      await apiClient('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: createUsername.trim(),
          password: createPassword,
          role: createRole,
          status: 'active',
          permissions: createPermissions,
        }),
      });

      showToast(`User "${createUsername.trim()}" created successfully!`);
      setCreateUsername('');
      setCreatePassword('');
      setCreateRole('Viewer');
      setCreateTemplateVal('Viewer');
      setCreateCustomPermissions(null);
      void loadUsers();
    } catch (err) {
      showToast(errorMessage(err, 'Failed to create user.'), true);
    } finally {
      setCreating(false);
    }
  };

  // 5. Toggle User Status directly from card
  const handleToggleStatus = async (user: DirectoryUser) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await apiClient(`/api/auth/user/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      showToast(`Status updated to ${newStatus}`);
      setUsers((prev) => prev.map((u) => (String(u._id || u.id || '') === user.id ? { ...u, status: newStatus } : u)));
    } catch (err) {
      showToast(errorMessage(err, 'Failed to update status'), true);
    }
  };

  // 6. Open Edit Profile Modal
  const openEditModal = (u: DirectoryUser) => {
    setEditingUserId(u.id);
    setEditUsername(u.username);
    setEditRole(asUserRole(u.role));
    setEditStatus(u.status === 'inactive' ? 'inactive' : 'active');
    setEditPassword('');
    setEditPermissionsDraft(clonePermissions(u.permissions));
    setEditModalOpen(true);
  };

  // 7. Save Edit Profile Submit
  const handleSaveEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;

    try {
      setSavingEdit(true);
      const permissions =
        editPermissionsDraft || directoryUsers.find((u) => u.id === editingUserId)?.permissions;
      const payload: {
        username: string;
        role: UserRole;
        status: 'active' | 'inactive';
        permissions?: PermissionSet;
        password?: string;
      } = {
        username: editUsername.trim(),
        role: editRole,
        status: editStatus,
        permissions,
      };
      if (editPassword) {
        payload.password = editPassword;
      }

      await apiClient(`/api/auth/user/${editingUserId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      showToast('User profile updated successfully!');
      setEditModalOpen(false);
      void loadUsers();
    } catch (err) {
      showToast(errorMessage(err, 'Failed to update user profile'), true);
    } finally {
      setSavingEdit(false);
    }
  };

  // 8. Delete User
  const handleDeleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${name}"?`)) return;

    try {
      await apiClient(`/api/auth/user/${id}`, { method: 'DELETE' });
      showToast(`User "${name}" deleted.`);
      setUsers((prev) => prev.filter((u) => String(u._id || u.id || '') !== id));
    } catch (err) {
      showToast(errorMessage(err, 'Failed to delete user.'), true);
    }
  };

  // Filtering users for directory
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return directoryUsers.filter((u) => {
      const matchSearch = !q || u.username.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      const matchStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [directoryUsers, search, roleFilter, statusFilter]);

  // Dashboard Stats
  const { statTotal, statAdmins, statCustom, statBuyerRestricted } = useMemo(() => {
    const templates = new Map<string, string>();
    const templateJson = (role: string) => {
      if (!templates.has(role)) templates.set(role, JSON.stringify(makeTemplate(role, menuGroups)));
      return templates.get(role);
    };
    return {
      statTotal: directoryUsers.length,
      statAdmins: directoryUsers.filter((u) => u.role === 'Admin').length,
      statCustom: directoryUsers.filter((u) => JSON.stringify(u.permissions) !== templateJson(u.role)).length,
      statBuyerRestricted: directoryUsers.filter((u) => u.permissions?.buyers?.accessType === 'selected').length,
    };
  }, [directoryUsers, menuGroups]);

  const permModalTitle =
    permModalScope === 'user' && permTargetUser
      ? `Permissions: ${permTargetUser.username}`
      : permModalScope === 'edit'
      ? 'Edit User Permissions'
      : 'Configure Permissions';

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && <UsersToast toastMsg={toastMsg} />}

      {/* Top Header */}
      <UsersHeader loadUsers={loadUsers} />

      {/* Stats Cards */}
      <UserStatCards
        statTotal={statTotal}
        statAdmins={statAdmins}
        statCustom={statCustom}
        statBuyerRestricted={statBuyerRestricted}
      />

      {/* Two Column Layout: Create User (Left) & User Directory (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6 items-start">
        {/* Left Column: Create User Form */}
        <CreateUserForm
          createUsername={createUsername}
          setCreateUsername={setCreateUsername}
          createPassword={createPassword}
          setCreatePassword={setCreatePassword}
          showCreatePassword={showCreatePassword}
          setShowCreatePassword={setShowCreatePassword}
          createRole={createRole}
          createTemplateVal={createTemplateVal}
          createPermissions={createPermissions}
          creating={creating}
          handleCreateUser={handleCreateUser}
          handleCreateRoleChange={handleCreateRoleChange}
          handleCreateTemplateChange={handleCreateTemplateChange}
          openPermissionBuilder={openPermissionBuilder}
          getPermCounts={getPermCounts}
          totalMenuCount={totalMenuCount}
          totalActionCount={totalActionCount}
          totalDownloadCount={totalDownloadCount}
        />

        {/* Right Column: User Directory */}
        <div className="space-y-4">
          {/* Search & Filter Header */}
          <UsersFilterBar
            search={search}
            setSearch={setSearch}
            roleFilter={roleFilter}
            setRoleFilter={setRoleFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
          />

          {/* User Directory Cards Grid */}
          <UserDirectory
            loading={loading}
            filteredUsers={filteredUsers}
            getPermCounts={getPermCounts}
            totalMenuCount={totalMenuCount}
            totalActionCount={totalActionCount}
            totalDownloadCount={totalDownloadCount}
            handleDeleteUser={handleDeleteUser}
            handleToggleStatus={handleToggleStatus}
            openPermissionBuilder={openPermissionBuilder}
            openEditModal={openEditModal}
          />
        </div>
      </div>

      {/* ========================================================== */}
      {/* 1. PERMISSION BUILDER MODAL (Full 4-Tab Granular Config)   */}
      {/* ========================================================== */}
      {permModalOpen && permDraft && (
        <PermissionBuilderModal
          permModalTitle={permModalTitle}
          permModalScope={permModalScope}
          permActiveTab={permActiveTab}
          setPermActiveTab={setPermActiveTab}
          menuGroups={menuGroups}
          permDraft={permDraft}
          permDraftBase={permDraftBase}
          savingPerms={savingPerms}
          buyersList={buyersList}
          buyerSearch={buyerSearch}
          setBuyerSearch={setBuyerSearch}
          updateDraft={updateDraft}
          setMenuFlags={setMenuFlags}
          setFlags={setFlags}
          handleBulkTogglePerms={handleBulkTogglePerms}
          handleApplyPermissions={handleApplyPermissions}
          closePermissionBuilder={closePermissionBuilder}
        />
      )}

      {/* ========================================================== */}
      {/* 2. EDIT USER PROFILE MODAL                                  */}
      {/* ========================================================== */}
      {editModalOpen && (
        <EditUserModal
          editUsername={editUsername}
          setEditUsername={setEditUsername}
          editRole={editRole}
          setEditRole={setEditRole}
          editStatus={editStatus}
          setEditStatus={setEditStatus}
          editPassword={editPassword}
          setEditPassword={setEditPassword}
          savingEdit={savingEdit}
          setEditModalOpen={setEditModalOpen}
          handleSaveEditProfile={handleSaveEditProfile}
          onEditPermissions={() =>
            openPermissionBuilder(
              'edit',
              editPermissionsDraft ||
                directoryUsers.find((u) => u.id === editingUserId)?.permissions ||
                makeTemplate(editRole, menuGroups)
            )
          }
        />
      )}
    </div>
  );
}
