'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Shield,
  Search,
  Plus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Sliders,
  Check,
  X,
  FileSpreadsheet,
  Download,
  Database,
  Lock,
  RefreshCw,
  Tag,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import ExpLoadingSpinner from '@/components/common/ExpLoadingSpinner';

// ==========================================================
// RBAC STRUCTURE DEFINITIONS (Matching Exp System)
// ==========================================================

export const MENU_GROUPS = [
  {
    key: 'dataManagement',
    title: 'Data Management',
    items: [
      ['view', 'Source File Upload'],
      ['setup', 'Setup (Dropdown Master)'],
    ],
  },
  {
    key: 'orderManagement',
    title: 'Order Management',
    items: [
      ['yd', 'YD Plan'],
      ['knitting', 'Knitting Plan'],
      ['dyeing', 'Dyeing Plan'],
      ['finishing', 'Finishing Plan'],
      ['delivery', 'Delivery Plan'],
    ],
  },
  {
    key: 'reports',
    title: 'Report',
    items: [
      ['yd', 'Updated YD Report'],
      ['knitting', 'Updated Knitting Report'],
      ['dyeing', 'Updated Dyeing Report'],
      ['finishing', 'Updated Finishing Report'],
      ['delivery', 'Updated Delivery Report'],
      ['orderStatus', 'Order Status'],
      ['productInfo', 'Product Info'],
      ['planningProdInfo', 'Planning & Production Info'],
    ],
  },
  {
    key: 'planFilter',
    title: 'Plan Filter',
    items: [
      ['yd', 'YD Plan Filter'],
      ['knitting', 'Knitting Plan Filter'],
      ['dyeing', 'Dyeing Plan Filter'],
      ['delivery', 'Delivery Plan Filter'],
      ['deliveryfloor', 'Delivery Plan (Floor) Filter'],
    ],
  },
  {
    key: 'actualTracking',
    title: 'Plan Vs Actual Tracking',
    items: [
      ['yd', 'YD'],
      ['knitting', 'Knitting'],
      ['dyeing', 'Dyeing'],
      ['finishing', 'Finishing'],
      ['delivery', 'Delivery'],
      ['deliveryfloor', 'Delivery (Floor)'],
    ],
  },
  {
    key: 'trackingReports',
    title: 'Tracking Report',
    items: [
      ['yd', 'YD'],
      ['knitting', 'Knitting'],
      ['dyeing', 'Dyeing'],
      ['finishing', 'Finishing'],
      ['delivery', 'Delivery'],
      ['deliveryfloor', 'Delivery (Floor)'],
    ],
  },
  {
    key: 'planTrackingFilter',
    title: 'Plan Vs Actual Tracking Filter',
    items: [
      ['yd', 'YD Plan Tracking Filter'],
      ['knitting', 'Knitting Plan Tracking Filter'],
      ['dyeing', 'Dyeing Plan Tracking Filter'],
      ['delivery', 'Delivery Plan Tracking Filter'],
      ['deliveryfloor', 'Delivery Plan (Floor) Tracking Filter'],
    ],
  },
  {
    key: 'loadCalculation',
    title: 'Load Calculation',
    items: [
      ['detailed', 'Detailed Load Download'],
      ['summary', 'Buyer-wise Load Summary'],
    ],
  },
  {
    key: 'manageUsers',
    title: 'Manage Users',
    items: [['view', 'Manage Users']],
  },
];

export const ACTION_GROUPS = [
  {
    title: 'Data Upload & Management',
    items: [
      ['uploadGeneral', 'Upload General Data'],
      ['uploadYD', 'Upload YD Data'],
      ['uploadKnitting', 'Upload Knitting Data'],
      ['uploadDyeing', 'Upload Dyeing Data'],
      ['uploadFinishing', 'Upload Finishing Data'],
      ['uploadDelivery', 'Upload Delivery Data'],
      ['deleteFiles', 'Delete Uploaded Files'],
      ['wipeSystem', 'Wipe System Data'],
    ],
  },
  {
    title: 'Planning Save Permissions',
    items: [
      ['saveYD', 'Save YD Planning'],
      ['saveKnitting', 'Save Knitting Planning'],
      ['saveDyeing', 'Save Dyeing Planning'],
      ['saveFinishing', 'Save Finishing Planning'],
      ['saveDelivery', 'Save Delivery Planning'],
    ],
  },
  {
    title: 'Actual Tracking Save Permissions',
    items: [
      ['saveActualYD', 'Save Actual Data (YD)'],
      ['saveActualKnitting', 'Save Actual Data (Knitting)'],
      ['saveActualDyeing', 'Save Actual Data (Dyeing)'],
      ['saveActualFinishing', 'Save Actual Data (Finishing)'],
      ['saveActualDelivery', 'Save Actual Data (Delivery)'],
      ['saveActualDeliveryFloor', 'Save Actual Data (Delivery Floor)'],
    ],
  },
  {
    title: 'Buyer-wise Load Summary Permissions',
    items: [
      ['loadSummaryYd', 'Load Summary (YD)'],
      ['loadSummaryKnitting', 'Load Summary (Knitting)'],
      ['loadSummaryDyeing', 'Load Summary (Dyeing)'],
      ['loadSummaryDelivery', 'Load Summary (Delivery)'],
      ['loadSummaryDeliveryfloor', 'Load Summary (Delivery Floor)'],
    ],
  },
  {
    title: 'Order Workflow Actions',
    items: [
      ['confirmPlan', 'Move to Confirm'],
      ['tentativePlan', 'Move to Tentative'],
      ['completeOrder', 'Mark Order Completed'],
      ['reopenOrder', 'Reopen Completed Order'],
      ['changeOrderStatus', 'Change Order Status'],
      ['deletePlan', 'Delete Planning Data'],
    ],
  },
];

export const DOWNLOAD_GROUPS = [
  {
    title: 'Report Menu',
    items: [
      ['osDetailedExcel', 'Order Status (Excel)'],
      ['osDetailedPdf', 'Order Status (PDF)'],
      ['reportUpdatedExcelYD', 'Updated YD Report (Combined)'],
      ['reportUpdatedExcelKnitting', 'Updated Knitting Report (Combined)'],
      ['reportUpdatedExcelDyeing', 'Updated Dyeing Report (Combined)'],
      ['reportUpdatedExcelFinishing', 'Updated Finishing Report (Combined)'],
      ['reportUpdatedExcelDelivery', 'Updated Delivery Report (Combined)'],
    ],
  },
  {
    title: 'Tracking Report Menu',
    items: [
      ['trackingYD', 'YD Tracking Reports (Excel/PDF)'],
      ['trackingKnitting', 'Knitting Tracking Reports (Excel/PDF)'],
      ['trackingDyeing', 'Dyeing Tracking Reports (Excel/PDF)'],
      ['trackingFinishing', 'Finishing Tracking Reports (Excel/PDF)'],
      ['trackingDelivery', 'Delivery Tracking Reports (Excel/PDF)'],
      ['trackingDeliveryFloor', 'Delivery (Floor) Tracking Reports (Excel/PDF)'],
    ],
  },
  {
    title: 'Load Calculation Menu',
    items: [
      ['loadDetailedYd', 'Detailed Load (YD)'],
      ['loadDetailedKnitting', 'Detailed Load (Knitting)'],
      ['loadDetailedDyeing', 'Detailed Load (Dyeing)'],
      ['loadDetailedDelivery', 'Detailed Load (Delivery)'],
      ['loadDetailedDeliveryfloor', 'Detailed Load (Delivery Floor)'],
      ['loadSummaryYd', 'Load Summary (YD)'],
      ['loadSummaryKnitting', 'Load Summary (Knitting)'],
      ['loadSummaryDyeing', 'Load Summary (Dyeing)'],
      ['loadSummaryDelivery', 'Load Summary (Delivery)'],
      ['loadSummaryDeliveryfloor', 'Load Summary (Delivery Floor)'],
    ],
  },
];

export function emptyPermissions() {
  const menus: Record<string, Record<string, boolean>> = {};
  MENU_GROUPS.forEach((g) => {
    menus[g.key] = {};
    g.items.forEach(([k]) => {
      menus[g.key][k] = false;
    });
  });

  const actions: Record<string, boolean> = {};
  ACTION_GROUPS.forEach((g) => {
    g.items.forEach(([k]) => {
      actions[k] = false;
    });
  });

  const downloads: Record<string, boolean> = {};
  DOWNLOAD_GROUPS.forEach((g) => {
    g.items.forEach(([k]) => {
      downloads[k] = false;
    });
  });

  return {
    menus,
    actions,
    downloads,
    buyers: { accessType: 'all' as 'all' | 'selected' | 'none', buyerIds: [] as string[] },
  };
}

export function makeTemplate(role: string) {
  const p = emptyPermissions();
  const setMenu = (group: string, val = true) => {
    if (p.menus[group]) {
      Object.keys(p.menus[group]).forEach((k) => (p.menus[group][k] = val));
    }
  };
  const setAllObj = (obj: Record<string, boolean>, val = true) => {
    Object.keys(obj).forEach((k) => (obj[k] = val));
  };

  if (role === 'Admin') {
    Object.keys(p.menus).forEach((k) => setMenu(k));
    setAllObj(p.actions);
    setAllObj(p.downloads);
    p.buyers.accessType = 'all';
  } else if (role === 'Approver') {
    [
      'orderManagement',
      'reports',
      'planFilter',
      'actualTracking',
      'trackingReports',
      'planTrackingFilter',
      'loadCalculation',
    ].forEach((k) => setMenu(k));
    [
      'confirmPlan',
      'tentativePlan',
      'completeOrder',
      'reopenOrder',
      'changeOrderStatus',
    ].forEach((k) => (p.actions[k] = true));
    setAllObj(p.downloads);
    p.buyers.accessType = 'all';
  } else if (role === 'Planner') {
    [
      'orderManagement',
      'reports',
      'planFilter',
      'actualTracking',
      'planTrackingFilter',
      'loadCalculation',
    ].forEach((k) => setMenu(k));
    if (p.menus.dataManagement) p.menus.dataManagement.view = true;
    [
      'saveYD',
      'saveKnitting',
      'saveDyeing',
      'saveFinishing',
      'saveDelivery',
      'saveActualYD',
      'saveActualKnitting',
      'saveActualDyeing',
      'saveActualFinishing',
      'saveActualDelivery',
      'saveActualDeliveryFloor',
      'tentativePlan',
      'loadSummaryYd',
      'loadSummaryKnitting',
      'loadSummaryDyeing',
      'loadSummaryDelivery',
      'loadSummaryDeliveryfloor',
    ].forEach((k) => (p.actions[k] = true));

    [
      'reportUpdatedExcelYD',
      'reportUpdatedExcelKnitting',
      'reportUpdatedExcelDyeing',
      'reportUpdatedExcelFinishing',
      'reportUpdatedExcelDelivery',
      'osDetailedExcel',
      'osDetailedPdf',
      'loadDetailedYd',
      'loadDetailedKnitting',
      'loadDetailedDyeing',
      'loadDetailedDelivery',
      'loadDetailedDeliveryfloor',
      'loadSummaryYd',
      'loadSummaryKnitting',
      'loadSummaryDyeing',
      'loadSummaryDelivery',
      'loadSummaryDeliveryfloor',
      'trackingYD',
      'trackingKnitting',
      'trackingDyeing',
      'trackingFinishing',
      'trackingDelivery',
      'trackingDeliveryFloor',
    ].forEach((k) => (p.downloads[k] = true));
    p.buyers.accessType = 'selected';
    p.buyers.buyerIds = ['hm', 'next', 'marks'];
  } else {
    // Viewer
    ['reports', 'planFilter', 'trackingReports', 'planTrackingFilter'].forEach((k) => setMenu(k));
    [
      'reportUpdatedExcelYD',
      'reportUpdatedExcelKnitting',
      'reportUpdatedExcelDyeing',
      'reportUpdatedExcelFinishing',
      'reportUpdatedExcelDelivery',
      'osDetailedExcel',
      'osDetailedPdf',
      'trackingYD',
      'trackingKnitting',
      'trackingDyeing',
      'trackingFinishing',
      'trackingDelivery',
      'trackingDeliveryFloor',
    ].forEach((k) => (p.downloads[k] = true));
    p.buyers.accessType = 'selected';
    p.buyers.buyerIds = ['hm', 'next'];
  }

  return p;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyersList, setBuyersList] = useState<{ id: string; name: string }[]>([]);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Create Form State
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createRole, setCreateRole] = useState<'Admin' | 'Approver' | 'Planner' | 'Viewer'>('Viewer');
  const [createTemplateVal, setCreateTemplateVal] = useState('Viewer');
  const [createPermissions, setCreatePermissions] = useState<any>(makeTemplate('Viewer'));
  const [creating, setCreating] = useState(false);

  // Permission Builder Modal State
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [permModalScope, setPermModalScope] = useState<'create' | 'edit'>('create');
  const [permDraft, setPermDraft] = useState<any>(null);
  const [permActiveTab, setPermActiveTab] = useState<'menu' | 'actions' | 'buyers' | 'downloads'>('menu');
  const [buyerSearch, setBuyerSearch] = useState('');

  // Edit User Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState<'Admin' | 'Approver' | 'Planner' | 'Viewer'>('Viewer');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editPassword, setEditPassword] = useState('');
  const [editPermissionsDraft, setEditPermissionsDraft] = useState<any>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Notification Toast
  const [toastMsg, setToastMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const showToast = (text: string, error = false) => {
    setToastMsg({ text, error });
    setTimeout(() => setToastMsg(null), 3000);
  };

  // 1. Fetch Users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await apiClient<any[]>('/api/auth/users');
      setUsers(data || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch users', true);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Buyers for dynamic checklist
  const fetchBuyers = async () => {
    try {
      const data = await apiClient<string[]>('/api/orders/buyers');
      const formatted = (data || []).map((b) => ({
        id: b.toLowerCase().replace(/[^a-z0-9]/g, ''),
        name: b,
      }));
      const uniqueMap = new Map<string, { id: string; name: string }>();
      formatted.forEach((item) => {
        if (item.id && !uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
      });
      setBuyersList(Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch {}
  };

  useEffect(() => {
    fetchUsers();
    fetchBuyers();
  }, []);

  // Handle Role change in create form
  const handleCreateRoleChange = (newRole: 'Admin' | 'Approver' | 'Planner' | 'Viewer') => {
    setCreateRole(newRole);
    setCreateTemplateVal(newRole);
    setCreatePermissions(makeTemplate(newRole));
  };

  // Handle Template change in create form
  const handleCreateTemplateChange = (val: string) => {
    setCreateTemplateVal(val);
    if (val !== 'Custom') {
      const templ = makeTemplate(val);
      setCreatePermissions(templ);
      setCreateRole(val as any);
      showToast(`${val} permission template applied.`);
    }
  };

  // Counts helpers
  const countTrue = (obj: any) => Object.values(obj || {}).filter(Boolean).length;
  const totalMenuCount = useMemo(() => MENU_GROUPS.reduce((n, g) => n + g.items.length, 0), []);
  const totalActionCount = useMemo(() => ACTION_GROUPS.reduce((n, g) => n + g.items.length, 0), []);
  const totalDownloadCount = useMemo(() => DOWNLOAD_GROUPS.reduce((n, g) => n + g.items.length, 0), []);

  const getPermCounts = (p: any) => {
    if (!p) return { menu: 0, action: 0, download: 0 };
    const menuCount = Object.values(p.menus || {}).reduce((n: number, g: any) => n + countTrue(g), 0);
    const actionCount = countTrue(p.actions || {});
    const downloadCount = countTrue(p.downloads || {});
    return { menu: menuCount, action: actionCount, download: downloadCount };
  };

  // Open Permission Builder
  const openPermissionBuilder = (scope: 'create' | 'edit', initialPerms?: any) => {
    setPermModalScope(scope);
    if (scope === 'create') {
      setPermDraft(JSON.parse(JSON.stringify(createPermissions)));
    } else {
      setPermDraft(JSON.parse(JSON.stringify(initialPerms || editPermissionsDraft || emptyPermissions())));
    }
    setPermModalOpen(true);
  };

  // Apply Permissions from Builder
  const handleApplyPermissions = () => {
    if (permModalScope === 'create') {
      setCreatePermissions(permDraft);
      setCreateTemplateVal('Custom');
    } else {
      setEditPermissionsDraft(permDraft);
    }
    setPermModalOpen(false);
    showToast('Permissions applied to draft!');
  };

  // Select/Clear All in Permission Builder
  const handleBulkTogglePerms = (select: boolean) => {
    if (!permDraft) return;
    const cloned = JSON.parse(JSON.stringify(permDraft));

    // Menus
    Object.keys(cloned.menus || {}).forEach((gk) => {
      Object.keys(cloned.menus[gk] || {}).forEach((ik) => {
        cloned.menus[gk][ik] = select;
      });
    });

    // Actions
    Object.keys(cloned.actions || {}).forEach((ak) => {
      cloned.actions[ak] = select;
    });

    // Downloads
    Object.keys(cloned.downloads || {}).forEach((dk) => {
      cloned.downloads[dk] = select;
    });

    // Buyers
    if (select) {
      cloned.buyers.accessType = 'all';
    } else {
      cloned.buyers.accessType = 'none';
      cloned.buyers.buyerIds = [];
    }

    setPermDraft(cloned);
  };

  // 3. Create User Submit
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
      setCreatePermissions(makeTemplate('Viewer'));
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to create user.', true);
    } finally {
      setCreating(false);
    }
  };

  // 4. Toggle User Status directly from card
  const handleToggleStatus = async (user: any) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await apiClient(`/api/auth/user/${user._id || user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      showToast(`Status updated to ${newStatus}`);
      setUsers((prev) =>
        prev.map((u) => ((u._id || u.id) === (user._id || user.id) ? { ...u, status: newStatus } : u))
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', true);
    }
  };

  // 5. Open Edit Profile Modal
  const openEditModal = (u: any) => {
    setEditingUserId(u._id || u.id);
    setEditUsername(u.username);
    setEditRole(u.role);
    setEditStatus(u.status || 'active');
    setEditPassword('');
    setEditPermissionsDraft(u.permissions || makeTemplate(u.role));
    setEditModalOpen(true);
  };

  // 6. Save Edit Profile Submit
  const handleSaveEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;

    try {
      setSavingEdit(true);
      const payload: any = {
        username: editUsername.trim(),
        role: editRole,
        status: editStatus,
        permissions: editPermissionsDraft,
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
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to update user profile', true);
    } finally {
      setSavingEdit(false);
    }
  };

  // 7. Delete User
  const handleDeleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${name}"?`)) return;

    try {
      await apiClient(`/api/auth/user/${id}`, { method: 'DELETE' });
      showToast(`User "${name}" deleted.`);
      setUsers((prev) => prev.filter((u) => (u._id || u.id) !== id));
    } catch (err: any) {
      showToast(err.message || 'Failed to delete user.', true);
    }
  };

  // Filtering users for directory
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q || u.username?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q);
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      const matchStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  // Dashboard Stats
  const statTotal = users.length;
  const statAdmins = users.filter((u) => u.role === 'Admin').length;
  const statCustom = users.filter(
    (u) => JSON.stringify(u.permissions) !== JSON.stringify(makeTemplate(u.role))
  ).length;
  const statBuyerRestricted = users.filter(
    (u) => u.permissions?.buyers?.accessType === 'selected'
  ).length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="toast toast-top toast-end z-50">
          <div className={`alert ${toastMsg.error ? 'alert-error' : 'alert-success'} text-white shadow-lg text-xs`}>
            <span>{toastMsg.text}</span>
          </div>
        </div>
      )}

      {/* Top Header */}
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

        <button onClick={fetchUsers} className="btn btn-outline btn-sm gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
          <span className="text-xs text-base-content/60 font-semibold">Total Users</span>
          <span className="text-2xl font-black mt-1">{statTotal}</span>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
          <span className="text-xs text-base-content/60 font-semibold">Admins</span>
          <span className="text-2xl font-black text-error mt-1">{statAdmins}</span>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
          <span className="text-xs text-base-content/60 font-semibold">Custom Access</span>
          <span className="text-2xl font-black text-primary mt-1">{statCustom}</span>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
          <span className="text-xs text-base-content/60 font-semibold">Restricted Buyers</span>
          <span className="text-2xl font-black text-warning mt-1">{statBuyerRestricted}</span>
        </div>
      </div>

      {/* Two Column Layout: Create User (Left) & User Directory (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6 items-start">
        {/* Left Column: Create User Form */}
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
                  onChange={(e) => handleCreateRoleChange(e.target.value as any)}
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
                  onClick={() => openPermissionBuilder('create')}
                  className="btn btn-neutral btn-xs gap-1.5"
                >
                  <Sliders className="h-3 w-3" /> Configure
                </button>
              </div>

              {/* Summary Card */}
              {(() => {
                const c = getPermCounts(createPermissions);
                const bType = createPermissions?.buyers?.accessType;
                const bText =
                  bType === 'all'
                    ? 'All buyers'
                    : bType === 'none'
                    ? 'No buyer'
                    : `${createPermissions?.buyers?.buyerIds?.length || 0} selected`;

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
              {creating ? <span className="loading loading-spinner loading-xs" /> : <Plus className="h-4 w-4" />}
              Create User
            </button>
          </form>
        </div>

        {/* Right Column: User Directory */}
        <div className="space-y-4">
          {/* Search & Filter Header */}
          <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-base-content/40" />
                <input
                  type="text"
                  placeholder="Search user or role..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input input-bordered input-sm w-full pl-9"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="select select-bordered select-sm text-xs"
                >
                  <option value="all">All Roles</option>
                  <option value="Admin">Admin</option>
                  <option value="Approver">Approver</option>
                  <option value="Planner">Planner</option>
                  <option value="Viewer">Viewer</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="select select-bordered select-sm text-xs"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* User Directory Cards Grid */}
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <ExpLoadingSpinner message="Loading Directory..." size="sm" overlay={false} />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="card bg-base-100 border border-base-300 p-8 text-center text-sm text-base-content/60">
              No users found matching your filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredUsers.map((u) => {
                const c = getPermCounts(u.permissions);
                const bType = u.permissions?.buyers?.accessType || 'all';
                const bText =
                  bType === 'all'
                    ? 'All buyers'
                    : bType === 'none'
                    ? 'No buyer'
                    : `${u.permissions?.buyers?.buyerIds?.length || 0} selected`;

                const roleBadgeClass =
                  u.role === 'Admin'
                    ? 'badge-error text-white'
                    : u.role === 'Approver'
                    ? 'badge-secondary text-white'
                    : u.role === 'Planner'
                    ? 'badge-info text-white'
                    : 'badge-ghost';

                return (
                  <div
                    key={u._id || u.id}
                    className="card bg-base-100 border border-base-300 p-4 shadow-sm hover:shadow transition-shadow relative overflow-hidden"
                  >
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
                        onClick={() => handleDeleteUser(u._id || u.id, u.username)}
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
                          onClick={() => {
                            setEditingUserId(u._id || u.id);
                            openPermissionBuilder('edit', u.permissions);
                          }}
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
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================== */}
      {/* 1. PERMISSION BUILDER MODAL (Full 4-Tab Granular Config)   */}
      {/* ========================================================== */}
      {permModalOpen && permDraft && (
        <div className="modal modal-open">
          <div className="modal-box max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-base-300 flex items-center justify-between bg-base-200/50">
              <div>
                <h3 className="font-black text-base">Configure Permissions</h3>
                <p className="text-xs text-base-content/60">
                  Granular control over menus, workflow actions, permitted buyers, and downloads.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBulkTogglePerms(true)}
                  className="btn btn-outline btn-xs btn-success font-bold"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkTogglePerms(false)}
                  className="btn btn-outline btn-xs font-bold"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={() => setPermModalOpen(false)}
                  className="btn btn-ghost btn-circle btn-xs"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Left Tab Nav & Right Content */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Left Tab Nav */}
              <div className="w-52 border-r border-base-300 p-3 bg-base-200/40 space-y-1 shrink-0 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setPermActiveTab('menu')}
                  className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-bold text-left transition-colors ${
                    permActiveTab === 'menu' ? 'bg-primary text-primary-content shadow-sm' : 'hover:bg-base-200'
                  }`}
                >
                  <Database className="h-4 w-4" /> Menu & Submenu
                </button>
                <button
                  type="button"
                  onClick={() => setPermActiveTab('actions')}
                  className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-bold text-left transition-colors ${
                    permActiveTab === 'actions' ? 'bg-primary text-primary-content shadow-sm' : 'hover:bg-base-200'
                  }`}
                >
                  <Lock className="h-4 w-4" /> Save & Actions
                </button>
                <button
                  type="button"
                  onClick={() => setPermActiveTab('buyers')}
                  className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-bold text-left transition-colors ${
                    permActiveTab === 'buyers' ? 'bg-primary text-primary-content shadow-sm' : 'hover:bg-base-200'
                  }`}
                >
                  <Tag className="h-4 w-4" /> Buyer Access
                </button>
                <button
                  type="button"
                  onClick={() => setPermActiveTab('downloads')}
                  className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-bold text-left transition-colors ${
                    permActiveTab === 'downloads' ? 'bg-primary text-primary-content shadow-sm' : 'hover:bg-base-200'
                  }`}
                >
                  <Download className="h-4 w-4" /> Downloads
                </button>
              </div>

              {/* Right Content Area */}
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-4">
                {/* TAB 1: MENU & SUBMENU */}
                {permActiveTab === 'menu' && (
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-base-content/60">
                      Toggle access to sidebar menu groups and specific submenus:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {MENU_GROUPS.map((group) => {
                        const groupPerms = permDraft.menus[group.key] || {};
                        const allChecked = group.items.every(([k]) => groupPerms[k]);
                        const someChecked = group.items.some(([k]) => groupPerms[k]);

                        return (
                          <div key={group.key} className="card bg-base-100 border border-base-300 p-4 shadow-sm">
                            <div className="flex items-center justify-between pb-2 border-b border-base-200">
                              <span className="font-extrabold text-xs">{group.title}</span>
                              <input
                                type="checkbox"
                                checked={allChecked}
                                ref={(el) => {
                                  if (el) el.indeterminate = someChecked && !allChecked;
                                }}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  const updated = { ...permDraft };
                                  group.items.forEach(([k]) => {
                                    if (!updated.menus[group.key]) updated.menus[group.key] = {};
                                    updated.menus[group.key][k] = val;
                                  });
                                  setPermDraft(updated);
                                }}
                                className="toggle toggle-primary toggle-xs"
                              />
                            </div>

                            <div className="pt-2 space-y-1.5">
                              {group.items.map(([k, label]) => (
                                <label key={k} className="flex items-center justify-between text-xs cursor-pointer hover:bg-base-200/50 p-1 rounded">
                                  <span>{label}</span>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(groupPerms[k])}
                                    onChange={(e) => {
                                      const updated = { ...permDraft };
                                      if (!updated.menus[group.key]) updated.menus[group.key] = {};
                                      updated.menus[group.key][k] = e.target.checked;
                                      setPermDraft(updated);
                                    }}
                                    className="checkbox checkbox-primary checkbox-xs"
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 2: SAVE & ACTIONS */}
                {permActiveTab === 'actions' && (
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-base-content/60">
                      Grant operational permissions for saving data, uploads, and workflow status changes:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {ACTION_GROUPS.map((category) => {
                        const allChecked = category.items.every(([k]) => permDraft.actions[k]);
                        const someChecked = category.items.some(([k]) => permDraft.actions[k]);

                        return (
                          <div key={category.title} className="card bg-base-100 border border-base-300 p-4 shadow-sm">
                            <div className="flex items-center justify-between pb-2 border-b border-base-200">
                              <span className="font-extrabold text-xs">{category.title}</span>
                              <input
                                type="checkbox"
                                checked={allChecked}
                                ref={(el) => {
                                  if (el) el.indeterminate = someChecked && !allChecked;
                                }}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  const updated = { ...permDraft };
                                  category.items.forEach(([k]) => {
                                    updated.actions[k] = val;
                                  });
                                  setPermDraft(updated);
                                }}
                                className="toggle toggle-primary toggle-xs"
                              />
                            </div>

                            <div className="pt-2 space-y-1.5">
                              {category.items.map(([k, label]) => (
                                <label key={k} className="flex items-center justify-between text-xs cursor-pointer hover:bg-base-200/50 p-1 rounded">
                                  <span>{label}</span>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(permDraft.actions[k])}
                                    onChange={(e) => {
                                      const updated = { ...permDraft };
                                      updated.actions[k] = e.target.checked;
                                      setPermDraft(updated);
                                    }}
                                    className="checkbox checkbox-primary checkbox-xs"
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 3: BUYER ACCESS */}
                {permActiveTab === 'buyers' && (
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-base-content/60">
                      Choose which buyer orders this user is authorized to view across all planning and tracking:
                    </p>

                    <div className="flex gap-4 p-3 bg-base-200/50 rounded-lg border border-base-300">
                      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                        <input
                          type="radio"
                          name="accessType"
                          value="all"
                          checked={permDraft.buyers.accessType === 'all'}
                          onChange={() => {
                            const updated = { ...permDraft };
                            updated.buyers.accessType = 'all';
                            setPermDraft(updated);
                          }}
                          className="radio radio-primary radio-xs"
                        />
                        All Buyers (Full Access)
                      </label>

                      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                        <input
                          type="radio"
                          name="accessType"
                          value="selected"
                          checked={permDraft.buyers.accessType === 'selected'}
                          onChange={() => {
                            const updated = { ...permDraft };
                            updated.buyers.accessType = 'selected';
                            setPermDraft(updated);
                          }}
                          className="radio radio-primary radio-xs"
                        />
                        Selected Buyers Only
                      </label>

                      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                        <input
                          type="radio"
                          name="accessType"
                          value="none"
                          checked={permDraft.buyers.accessType === 'none'}
                          onChange={() => {
                            const updated = { ...permDraft };
                            updated.buyers.accessType = 'none';
                            setPermDraft(updated);
                          }}
                          className="radio radio-primary radio-xs"
                        />
                        No Buyer Access
                      </label>
                    </div>

                    {permDraft.buyers.accessType === 'selected' && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between gap-3">
                          <input
                            type="text"
                            placeholder="Filter buyers..."
                            value={buyerSearch}
                            onChange={(e) => setBuyerSearch(e.target.value)}
                            className="input input-bordered input-xs w-64"
                          />

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = { ...permDraft };
                                updated.buyers.buyerIds = buyersList.map((b) => b.id);
                                setPermDraft(updated);
                              }}
                              className="btn btn-outline btn-xs"
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = { ...permDraft };
                                updated.buyers.buyerIds = [];
                                setPermDraft(updated);
                              }}
                              className="btn btn-outline btn-xs"
                            >
                              Clear All
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-72 overflow-y-auto p-3 bg-base-100 border border-base-300 rounded-lg custom-scrollbar">
                          {buyersList
                            .filter((b) => !buyerSearch || b.name.toLowerCase().includes(buyerSearch.toLowerCase()))
                            .map((b) => {
                              const checked = permDraft.buyers.buyerIds?.includes(b.id);
                              return (
                                <label key={b.id} className="flex items-center gap-2 text-xs cursor-pointer p-1 rounded hover:bg-base-200">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const updated = { ...permDraft };
                                      const currentIds: string[] = updated.buyers.buyerIds || [];
                                      if (e.target.checked) {
                                        updated.buyers.buyerIds = [...new Set([...currentIds, b.id])];
                                      } else {
                                        updated.buyers.buyerIds = currentIds.filter((x) => x !== b.id);
                                      }
                                      setPermDraft(updated);
                                    }}
                                    className="checkbox checkbox-primary checkbox-xs"
                                  />
                                  <span className="truncate">{b.name}</span>
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: DOWNLOADS */}
                {permActiveTab === 'downloads' && (
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-base-content/60">
                      Grant authorization to export and download Excel spreadsheets and PDF reports:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {DOWNLOAD_GROUPS.map((category) => {
                        const allChecked = category.items.every(([k]) => permDraft.downloads[k]);
                        const someChecked = category.items.some(([k]) => permDraft.downloads[k]);

                        return (
                          <div key={category.title} className="card bg-base-100 border border-base-300 p-4 shadow-sm">
                            <div className="flex items-center justify-between pb-2 border-b border-base-200">
                              <span className="font-extrabold text-xs">{category.title}</span>
                              <input
                                type="checkbox"
                                checked={allChecked}
                                ref={(el) => {
                                  if (el) el.indeterminate = someChecked && !allChecked;
                                }}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  const updated = { ...permDraft };
                                  category.items.forEach(([k]) => {
                                    updated.downloads[k] = val;
                                  });
                                  setPermDraft(updated);
                                }}
                                className="toggle toggle-primary toggle-xs"
                              />
                            </div>

                            <div className="pt-2 space-y-1.5">
                              {category.items.map(([k, label]) => (
                                <label key={k} className="flex items-center justify-between text-xs cursor-pointer hover:bg-base-200/50 p-1 rounded">
                                  <span>{label}</span>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(permDraft.downloads[k])}
                                    onChange={(e) => {
                                      const updated = { ...permDraft };
                                      updated.downloads[k] = e.target.checked;
                                      setPermDraft(updated);
                                    }}
                                    className="checkbox checkbox-primary checkbox-xs"
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-base-300 flex items-center justify-between bg-base-200/50">
              <span className="text-xs text-base-content/60 font-semibold">
                Click &quot;Apply Permissions&quot; to commit these access rules.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPermModalOpen(false)}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyPermissions}
                  className="btn btn-primary btn-sm font-bold gap-1.5"
                >
                  <Check className="h-4 w-4" /> Apply Permissions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 2. EDIT USER PROFILE MODAL                                  */}
      {/* ========================================================== */}
      {editModalOpen && (
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
                    onChange={(e) => setEditRole(e.target.value as any)}
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
                    onChange={(e) => setEditStatus(e.target.value as any)}
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
                  onClick={() => openPermissionBuilder('edit', editPermissionsDraft)}
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
                  {savingEdit ? <span className="loading loading-spinner loading-xs" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
