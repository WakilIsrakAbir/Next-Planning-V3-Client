'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Search,
  Plus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  Sliders,
  Check,
  X,
  Download,
  Database,
  Lock,
  RefreshCw,
  Tag,
  Box,
  Layers,
  IdCard,
  ChartColumn,
  ChartNoAxesColumn,
  Funnel,
  Scale,
  FileSpreadsheet,
  FileCheck,
  Calculator,
  UserCog,
  Upload,
  Save,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { UserRole } from '@/types/user';
import ExpLoadingSpinner from '@/components/common/ExpLoadingSpinner';
import InlineSpinner from '@/components/common/InlineSpinner';

// ==========================================================
// RBAC STRUCTURE DEFINITIONS (Matching Exp System)
// ==========================================================

type PermissionItem = [key: string, label: string];

interface MenuGroup {
  key: string;
  title: string;
  icon: React.ReactNode;
  items: PermissionItem[];
}

interface PermissionGroup {
  title: string;
  icon?: React.ReactNode;
  items: PermissionItem[];
}

type PermissionFlags = Record<string, boolean>;

interface BuyerAccess {
  accessType: string;
  buyerIds: string[];
}

/* A user's permissions as the old manage-users.js writes them: { menus, actions, buyers, downloads }.
   Keys this page does not know (written by another page or by the old app) are kept as they are. */
interface PermissionSet {
  menus: Record<string, PermissionFlags>;
  actions: PermissionFlags;
  buyers: BuyerAccess;
  downloads: PermissionFlags;
  [otherKey: string]: unknown;
}

const ALL_ORDERS_ITEM: PermissionItem = ['all', 'All Orders'];
// The demo's five floors: the Batch Plan / Batch Card unit switches until (or if never) the server lists its units.
const STATIC_BATCH_UNIT_ITEMS: PermissionItem[] = [
  ['efl', 'EFL'],
  ['ekl', 'EKL'],
  ['ext', 'Ext'],
  ['pluvia', 'Pluvia'],
  ['outside', 'Outside'],
];
const BATCH_UNIT_GROUP_KEYS = new Set(['batchPlan', 'batchCard']);
const UNIT_PERMISSION_KEY = /^[a-z0-9]{1,40}$/;

const groupIcon = 'h-3.5 w-3.5';

export const MENU_GROUPS: MenuGroup[] = [
  {
    key: 'dataManagement',
    title: 'Data Management',
    icon: <Database className={groupIcon} />,
    items: [
      ['view', 'Source File Upload'],
      ['setup', 'Dropdown Master Setup'],
      ['dyeingMc', 'Dyeing MC'],
      ['flatAllowance', 'Flat Allowance'],
      ['unitSetup', 'Unit Setup'],
    ],
  },
  {
    key: 'orderManagement',
    title: 'Order Management',
    icon: <Box className={groupIcon} />,
    items: [
      ['yd', 'YD Plan'],
      ['knitting', 'Knitting Plan'],
      ['dyeing', 'Dyeing Plan'],
      ['finishing', 'Finishing Plan'],
      ['delivery', 'Delivery Plan'],
    ],
  },
  {
    // Unit items are replaced by the Dyeing Plan units from the server (loadBatchUnitItems).
    key: 'batchPlan',
    title: 'Batch Plan',
    icon: <Layers className={groupIcon} />,
    items: [ALL_ORDERS_ITEM, ...STATIC_BATCH_UNIT_ITEMS],
  },
  {
    key: 'batchCard',
    title: 'Batch Card',
    icon: <IdCard className={groupIcon} />,
    items: [ALL_ORDERS_ITEM, ...STATIC_BATCH_UNIT_ITEMS],
  },
  {
    key: 'reports',
    title: 'Report',
    icon: <ChartColumn className={groupIcon} />,
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
    key: 'batchReport',
    title: 'Batch Report',
    icon: <ChartNoAxesColumn className={groupIcon} />,
    items: [
      ['dyeableBatch', 'Dyeable Batch'],
      ['dyeableSummary', 'Dyeable Batch Summary'],
      ['dailyConfirm', 'Daily Confirm Batch Plan'],
    ],
  },
  {
    key: 'planFilter',
    title: 'Plan Filter',
    icon: <Funnel className={groupIcon} />,
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
    icon: <Scale className={groupIcon} />,
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
    icon: <FileSpreadsheet className={groupIcon} />,
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
    icon: <FileCheck className={groupIcon} />,
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
    icon: <Calculator className={groupIcon} />,
    items: [
      ['detailed', 'Detailed Load Download'],
      ['summary', 'Buyer-wise Load Summary'],
    ],
  },
  {
    key: 'manageUsers',
    title: 'Manage Users',
    icon: <UserCog className={groupIcon} />,
    items: [['view', 'Manage Users']],
  },
];

export const ACTION_GROUPS: PermissionGroup[] = [
  {
    title: 'Data Upload & Management',
    icon: <Upload className={groupIcon} />,
    items: [
      ['uploadGeneral', 'Upload General Data'],
      ['uploadYD', 'Upload YD Data'],
      ['uploadKnitting', 'Upload Knitting Data'],
      ['uploadDyeing', 'Upload Dyeing Data'],
      ['uploadFinishing', 'Upload Finishing Data'],
      ['uploadDelivery', 'Upload Delivery Data'],
      ['uploadBP', 'Upload BP Data'],
      ['deleteFiles', 'Delete Uploaded Files'],
      ['wipeSystem', 'Wipe System Data'],
    ],
  },
  {
    title: 'Planning Save Permissions',
    icon: <Save className={groupIcon} />,
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
    icon: <Save className={groupIcon} />,
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
    icon: <ChartColumn className={groupIcon} />,
    items: [
      ['loadSummaryYd', 'Load Summary (YD)'],
      ['loadSummaryKnitting', 'Load Summary (Knitting)'],
      ['loadSummaryDyeing', 'Load Summary (Dyeing)'],
      ['loadSummaryDelivery', 'Load Summary (Delivery)'],
      ['loadSummaryDeliveryfloor', 'Load Summary (Delivery Floor)'],
    ],
  },
  {
    title: 'Batch Plan Actions',
    icon: <Layers className={groupIcon} />,
    items: [
      ['batchEdit', 'Edit Batch Plan (rows, machines, General Info)'],
      ['batchTentative', 'Make Batch Plan Tentative'],
      ['batchConfirm', 'Confirm / Re-Confirm Batch Plan'],
      ['batchInternalChange', 'Approve Internal change'],
      ['batchMovePending', 'Move Batch Plan to Pending'],
      ['batchCardGenerate', 'Generate / Revise Batch Card'],
    ],
  },
  {
    title: 'Order Workflow Actions',
    icon: <RefreshCw className={groupIcon} />,
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

export const DOWNLOAD_GROUPS: PermissionGroup[] = [
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
  {
    title: 'Batch Plan & Batch Report',
    items: [
      ['batchPlanPrint', 'Batch Plan Print / PDF'],
      ['batchCardPrint', 'Batch Card Print / PDF'],
      ['dyeableExcel', 'Dyeable Batch (Excel)'],
      ['dyeableSummaryExcel', 'Dyeable Batch Summary (Excel / Print)'],
      ['dailyConfirmExcel', 'Daily Confirm Batch Plan (Excel / Print)'],
    ],
  },
];

// Permission keys added with the Batch Plan module. A user saved before they existed gets them only
// when an Admin ticks them in the permission builder, never from the role template.
const BATCH_PERMISSION_KEYS = {
  menus: {
    dataManagement: ['dyeingMc', 'flatAllowance', 'unitSetup'],
    batchPlan: ['all', 'efl', 'ekl', 'ext', 'pluvia', 'outside'],
    batchCard: ['all', 'efl', 'ekl', 'ext', 'pluvia', 'outside'],
    batchReport: ['dyeableBatch', 'dyeableSummary', 'dailyConfirm'],
  } as Record<string, string[]>,
  actions: ['uploadBP', 'batchEdit', 'batchTentative', 'batchConfirm', 'batchInternalChange', 'batchMovePending', 'batchCardGenerate'],
  downloads: ['batchPlanPrint', 'batchCardPrint', 'dyeableExcel', 'dyeableSummaryExcel', 'dailyConfirmExcel'],
};

const USER_ROLES: UserRole[] = ['Admin', 'Approver', 'Planner', 'Viewer'];

function asUserRole(value: unknown): UserRole {
  return USER_ROLES.includes(value as UserRole) ? (value as UserRole) : 'Viewer';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwnKey(obj: unknown, key: string): boolean {
  return isRecord(obj) && Object.prototype.hasOwnProperty.call(obj, key);
}

function clonePermissions(p: PermissionSet): PermissionSet {
  return JSON.parse(JSON.stringify(p)) as PermissionSet;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function emptyPermissions(groups: MenuGroup[] = MENU_GROUPS): PermissionSet {
  const menus: Record<string, PermissionFlags> = {};
  groups.forEach((g) => {
    menus[g.key] = {};
    g.items.forEach(([k]) => {
      menus[g.key][k] = false;
    });
  });

  const actions: PermissionFlags = {};
  ACTION_GROUPS.forEach((g) => {
    g.items.forEach(([k]) => {
      actions[k] = false;
    });
  });

  const downloads: PermissionFlags = {};
  DOWNLOAD_GROUPS.forEach((g) => {
    g.items.forEach(([k]) => {
      downloads[k] = false;
    });
  });

  // Same key order as the old app writes: menus, actions, buyers, downloads.
  return {
    menus,
    actions,
    buyers: { accessType: 'all', buyerIds: [] },
    downloads,
  };
}

export function makeTemplate(role: string, groups: MenuGroup[] = MENU_GROUPS): PermissionSet {
  const p = emptyPermissions(groups);
  const setMenu = (group: string, val = true) => {
    if (p.menus[group]) {
      Object.keys(p.menus[group]).forEach((k) => (p.menus[group][k] = val));
    }
  };
  const setAllObj = (obj: PermissionFlags, val = true) => {
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
      'batchConfirm',
      'batchInternalChange',
      'batchMovePending',
      'batchCardGenerate',
    ].forEach((k) => (p.actions[k] = true));
    ['batchPlan', 'batchCard', 'batchReport'].forEach((k) => setMenu(k));
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
    ['batchPlan', 'batchCard', 'batchReport'].forEach((k) => setMenu(k));
    [
      'batchEdit',
      'batchTentative',
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
      // Planners need Tracking Downloads since they have actualTracking menu
      'trackingYD',
      'trackingKnitting',
      'trackingDyeing',
      'trackingFinishing',
      'trackingDelivery',
      'trackingDeliveryFloor',
      'batchPlanPrint',
      'batchCardPrint',
      'dyeableExcel',
      'dyeableSummaryExcel',
      'dailyConfirmExcel',
    ].forEach((k) => (p.downloads[k] = true));
    p.buyers.accessType = 'selected';
    p.buyers.buyerIds = ['hm', 'next', 'marks'];
  } else {
    // Viewer
    ['reports', 'planFilter', 'trackingReports', 'planTrackingFilter', 'batchReport'].forEach((k) => setMenu(k));
    ['globalSearch'].forEach((k) => (p.actions[k] = true));
    [
      // Viewers need report downloads since they have reports menu
      'reportUpdatedExcelYD',
      'reportUpdatedExcelKnitting',
      'reportUpdatedExcelDyeing',
      'reportUpdatedExcelFinishing',
      'reportUpdatedExcelDelivery',
      'osDetailedExcel',
      'osDetailedPdf',
      // Tracking downloads
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

/* A stored permission object (old, partial or empty) -> a complete one, as the old normalizePermissions:
   missing keys come from the role template, except the Batch Plan keys, which are off when missing.
   Nothing the stored object has is dropped, so saving it back never loses a key. */
function normalizePermissions(raw: unknown, role: string | undefined, groups: MenuGroup[] = MENU_GROUPS): PermissionSet {
  const template = makeTemplate(role || 'Viewer', groups);
  if (!isRecord(raw) || Object.keys(raw).length === 0) return template;

  const rawMenus = isRecord(raw.menus) ? raw.menus : {};
  const rawBuyers = isRecord(raw.buyers) ? raw.buyers : {};
  const normalized: PermissionSet = {
    menus: {},
    actions: { ...template.actions, ...(isRecord(raw.actions) ? (raw.actions as PermissionFlags) : {}) },
    buyers: {
      accessType:
        (typeof rawBuyers.accessType === 'string' && rawBuyers.accessType) || template.buyers.accessType || 'all',
      buyerIds: Array.isArray(rawBuyers.buyerIds) ? (rawBuyers.buyerIds as string[]) : template.buyers.buyerIds || [],
    },
    downloads: { ...template.downloads, ...(isRecord(raw.downloads) ? (raw.downloads as PermissionFlags) : {}) },
  };

  // Deep merge menus for all known groups
  Object.keys(template.menus).forEach((group) => {
    const rawGroup = rawMenus[group];
    normalized.menus[group] = {
      ...(template.menus[group] || {}),
      ...(isRecord(rawGroup) ? (rawGroup as PermissionFlags) : {}),
    };
  });

  // Batch Plan and Batch Card have one key per Dyeing Plan unit; a unit key the user never had is off.
  const batchMenuKeys: Record<string, string[]> = { ...BATCH_PERMISSION_KEYS.menus };
  groups
    .filter((g) => BATCH_UNIT_GROUP_KEYS.has(g.key))
    .forEach((g) => {
      batchMenuKeys[g.key] = g.items.map(([k]) => k);
    });
  Object.entries(batchMenuKeys).forEach(([group, keys]) => {
    if (!normalized.menus[group]) normalized.menus[group] = {};
    keys.forEach((key) => {
      if (!hasOwnKey(rawMenus[group], key)) normalized.menus[group][key] = false;
    });
  });
  BATCH_PERMISSION_KEYS.actions.forEach((key) => {
    if (!hasOwnKey(raw.actions, key)) normalized.actions[key] = false;
  });
  BATCH_PERMISSION_KEYS.downloads.forEach((key) => {
    if (!hasOwnKey(raw.downloads, key)) normalized.downloads[key] = false;
  });

  // Menu groups and top-level keys this page does not know are kept as stored (never counted or shown).
  Object.keys(rawMenus).forEach((group) => {
    if (group !== '__proto__' && !hasOwnKey(normalized.menus, group)) {
      normalized.menus[group] = rawMenus[group] as PermissionFlags;
    }
  });
  Object.keys(raw).forEach((key) => {
    if (key !== '__proto__' && !hasOwnKey(normalized, key)) normalized[key] = raw[key];
  });

  return normalized;
}

function countTrue(value: unknown): number {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (!isRecord(value)) return 0;
  return Object.values(value).filter(Boolean).length;
}

function permissionCounts(p: PermissionSet | null | undefined, groups: MenuGroup[]) {
  if (!isRecord(p)) return { menu: 0, action: 0, download: 0 };
  const menus = isRecord(p.menus) ? p.menus : {};
  return {
    menu: groups.reduce((n, g) => n + countTrue(menus[g.key]), 0),
    action: countTrue(p.actions),
    download: countTrue(p.downloads),
  };
}

function itemCount(groups: { items: PermissionItem[] }[]): number {
  return groups.reduce((n, g) => n + g.items.length, 0);
}

// Menu groups with the Batch Plan / Batch Card unit switches loaded from the server ("All Orders" first).
function withBatchUnits(unitItems: PermissionItem[] | null): MenuGroup[] {
  if (!unitItems) return MENU_GROUPS;
  return MENU_GROUPS.map((g) => (BATCH_UNIT_GROUP_KEYS.has(g.key) ? { ...g, items: [ALL_ORDERS_ITEM, ...unitItems] } : g));
}

/* Batch Plan / Batch Card: a unit this user is ticked for but that is no longer listed still gets a
   switch, so the tick can be seen and removed. */
function permissionMenuItems(group: MenuGroup, ...drafts: (PermissionSet | null | undefined)[]): PermissionItem[] {
  if (!BATCH_UNIT_GROUP_KEYS.has(group.key)) return group.items;
  const listed = new Set(group.items.map(([k]) => k));
  const extra: string[] = [];
  drafts.forEach((draft) => {
    const ticked = draft?.menus?.[group.key];
    if (!isRecord(ticked)) return;
    Object.keys(ticked).forEach((k) => {
      if (ticked[k] === true && !listed.has(k) && UNIT_PERMISSION_KEY.test(k) && !extra.includes(k)) extra.push(k);
    });
  });
  return [...group.items, ...extra.map((k): PermissionItem => [k, `${k.toUpperCase()} (not in use)`])];
}

// Visits every switch the permission builder shows (menus, actions, downloads) on a draft the caller owns.
function forEachSwitch(
  p: PermissionSet,
  groups: MenuGroup[],
  shownFrom: (PermissionSet | null)[],
  visit: (flags: PermissionFlags, key: string) => void
) {
  groups.forEach((g) => {
    const items = permissionMenuItems(g, ...shownFrom);
    if (!isRecord(p.menus[g.key])) p.menus[g.key] = {};
    items.forEach(([k]) => visit(p.menus[g.key], k));
  });
  ACTION_GROUPS.forEach((g) => g.items.forEach(([k]) => visit(p.actions, k)));
  DOWNLOAD_GROUPS.forEach((g) => g.items.forEach(([k]) => visit(p.downloads, k)));
}

/* Plan section 16.3: Batch Plan and Batch Card permissions have one switch per Dyeing Plan unit
   (Dropdown Master Setup units plus the units used in Batch Plan). A unit's key is made exactly as the
   server's unitKey (src/lib/batch/source.ts) does, in small letters: the demo's five floors keep their keys. */
const BATCH_LEGACY_UNIT_ALIASES: Record<string, string[]> = {
  EFL: ['EFL', 'EFL Floor', 'Epyllion Fabrics Limited'],
  EKL: ['EKL', 'EKL Floor', 'Epyllion Knitex Limited'],
  EXT: ['Ext', 'Ext Floor', 'EFL-Ext', 'EFL Ext', 'Extension', 'Extension Floor'],
  PLUVIA: ['Pluvia', 'Pluvia Wash', 'Pluvia Washing'],
  OUTSIDE: [
    'Outside',
    'Outside Dyeing',
    'Outside Dyeing Floor',
    'Out Side',
    'Out Side Dyeing',
    'Outsource',
    'Outsourcing',
    'Subcontract',
    'Subcontract Dyeing',
  ],
};
const BATCH_NO_UNIT_TEXTS = new Set(['-', 'n/a', 'na', 'select', 'null', 'undefined', 'none', '0']);

function batchUnitPermissionKey(name: unknown): string {
  const text = String(name ?? '').trim();
  if (!text || text.includes('+') || BATCH_NO_UNIT_TEXTS.has(text.toLowerCase())) return '';
  const key = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!key || key === 'ALL') return '';
  for (const [floor, aliases] of Object.entries(BATCH_LEGACY_UNIT_ALIASES)) {
    if (aliases.some((alias) => alias.toUpperCase().replace(/[^A-Z0-9]/g, '') === key)) return floor.toLowerCase();
  }
  return key.slice(0, 40).toLowerCase();
}

/* The unit switches for Batch Plan / Batch Card: Dropdown Master units, then the units from
   GET /api/batch/units, then the demo's five floors (so an old tick such as pluvia can still be removed).
   null when neither list loads: the page then keeps the static five floors. */
async function loadBatchUnitItems(): Promise<PermissionItem[] | null> {
  if (typeof window === 'undefined' || !localStorage.getItem('token')) return null;
  const units = new Map<string, string>();
  const add = (key: string, label: unknown) => {
    if (!UNIT_PERMISSION_KEY.test(key) || key === 'all' || units.has(key)) return;
    units.set(key, String(label || '').replace(/[<>&"'`]/g, '').trim() || key.toUpperCase());
  };
  const [dropdowns, batchUnits] = await Promise.allSettled([
    apiClient<{ units?: { name?: unknown }[] }>('/api/dropdowns'),
    apiClient<{ units?: { key?: unknown; label?: unknown }[] }>('/api/batch/units'),
  ]);
  if (dropdowns.status === 'fulfilled') {
    (Array.isArray(dropdowns.value?.units) ? dropdowns.value.units : []).forEach((u) =>
      add(batchUnitPermissionKey(u?.name), u?.name)
    );
  } else {
    console.warn('Dropdown units not loaded:', dropdowns.reason);
  }
  if (batchUnits.status === 'fulfilled') {
    (Array.isArray(batchUnits.value?.units) ? batchUnits.value.units : []).forEach((u) =>
      add(String(u?.key || '').toLowerCase(), u?.label)
    );
  } else {
    console.warn('Batch units not loaded:', batchUnits.reason);
  }
  if (!units.size) return null;
  STATIC_BATCH_UNIT_ITEMS.forEach(([key, label]) => add(key, label));
  return Array.from(units, ([key, label]): PermissionItem => [key, label]);
}

interface ApiUser {
  _id?: string;
  id?: string;
  username?: string;
  role?: string;
  status?: string;
  permissions?: unknown;
  lastActive?: string;
  createdAt?: string;
}

interface DirectoryUser {
  id: string;
  username: string;
  role: string;
  status: string;
  permissions: PermissionSet;
}

type PermissionScope = 'create' | 'edit' | 'user';

// Module-level cache for instant tab loading
let cachedUsers: ApiUser[] | null = null;
let cachedBuyersList: { id: string; name: string }[] | null = null;
let cachedBatchUnitItems: PermissionItem[] | null = null;

export default function UserManagementPage() {
  const [users, setUsers] = useState<ApiUser[]>(() => cachedUsers || []);
  const [loading, setLoading] = useState(() => !cachedUsers);
  const [buyersList, setBuyersList] = useState<{ id: string; name: string }[]>(() => cachedBuyersList || []);
  const [batchUnitItems, setBatchUnitItems] = useState<PermissionItem[] | null>(() => cachedBatchUnitItems);

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
  const [permActiveTab, setPermActiveTab] = useState<'menu' | 'actions' | 'buyers' | 'downloads'>('menu');
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
          cachedUsers = Array.isArray(data) ? data : [];
          setUsers(cachedUsers);
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
          cachedBuyersList = Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name));
          setBuyersList(cachedBuyersList);
        })
        .catch(() => {}),
    []
  );

  // 3. Batch Plan / Batch Card unit switches (the static five floors stay if the units cannot be loaded)
  const loadBatchUnits = useCallback(
    () =>
      loadBatchUnitItems().then((items) => {
        if (items) {
          cachedBatchUnitItems = items;
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

        <button onClick={() => void loadUsers()} className="btn btn-outline btn-sm gap-2">
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
                  <div
                    key={u.id}
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
                <h3 className="font-black text-base">{permModalTitle}</h3>
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
                  onClick={closePermissionBuilder}
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
                      {menuGroups.map((group) => {
                        const groupPerms = isRecord(permDraft.menus[group.key]) ? permDraft.menus[group.key] : {};
                        const items = permissionMenuItems(group, permDraftBase, permDraft);
                        const allChecked = items.every(([k]) => groupPerms[k]);
                        const someChecked = items.some(([k]) => groupPerms[k]);

                        return (
                          <div key={group.key} className="card bg-base-100 border border-base-300 p-4 shadow-sm">
                            <div className="flex items-center justify-between pb-2 border-b border-base-200">
                              <span className="font-extrabold text-xs flex items-center gap-1.5">
                                <span className="text-primary">{group.icon}</span>
                                {group.title}
                              </span>
                              <input
                                type="checkbox"
                                checked={allChecked}
                                ref={(el) => {
                                  if (el) el.indeterminate = someChecked && !allChecked;
                                }}
                                onChange={(e) =>
                                  setMenuFlags(
                                    group.key,
                                    items.map(([k]) => k),
                                    e.target.checked
                                  )
                                }
                                className="toggle toggle-primary toggle-xs"
                              />
                            </div>

                            <div className="pt-2 space-y-1.5">
                              {items.map(([k, label]) => (
                                <label key={k} className="flex items-center justify-between text-xs cursor-pointer hover:bg-base-200/50 p-1 rounded">
                                  <span>{label}</span>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(groupPerms[k])}
                                    onChange={(e) => setMenuFlags(group.key, [k], e.target.checked)}
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
                              <span className="font-extrabold text-xs flex items-center gap-1.5">
                                <span className="text-success">{category.icon}</span>
                                {category.title}
                              </span>
                              <input
                                type="checkbox"
                                checked={allChecked}
                                ref={(el) => {
                                  if (el) el.indeterminate = someChecked && !allChecked;
                                }}
                                onChange={(e) =>
                                  setFlags(
                                    'actions',
                                    category.items.map(([k]) => k),
                                    e.target.checked
                                  )
                                }
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
                                    onChange={(e) => setFlags('actions', [k], e.target.checked)}
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
                          onChange={() => updateDraft((d) => (d.buyers.accessType = 'all'))}
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
                          onChange={() => updateDraft((d) => (d.buyers.accessType = 'selected'))}
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
                          onChange={() => updateDraft((d) => (d.buyers.accessType = 'none'))}
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
                              onClick={() => updateDraft((d) => (d.buyers.buyerIds = buyersList.map((b) => b.id)))}
                              className="btn btn-outline btn-xs"
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              onClick={() => updateDraft((d) => (d.buyers.buyerIds = []))}
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
                              const checked = Array.isArray(permDraft.buyers.buyerIds) && permDraft.buyers.buyerIds.includes(b.id);
                              return (
                                <label key={b.id} className="flex items-center gap-2 text-xs cursor-pointer p-1 rounded hover:bg-base-200">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const tick = e.target.checked;
                                      updateDraft((d) => {
                                        const currentIds = Array.isArray(d.buyers.buyerIds) ? d.buyers.buyerIds : [];
                                        d.buyers.buyerIds = tick
                                          ? [...new Set([...currentIds, b.id])]
                                          : currentIds.filter((x) => x !== b.id);
                                      });
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
                                onChange={(e) =>
                                  setFlags(
                                    'downloads',
                                    category.items.map(([k]) => k),
                                    e.target.checked
                                  )
                                }
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
                                    onChange={(e) => setFlags('downloads', [k], e.target.checked)}
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
                {permModalScope === 'user'
                  ? 'Click "Save Permissions" to store these access rules for this user.'
                  : 'Click "Apply Permissions" to commit these access rules.'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closePermissionBuilder}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleApplyPermissions()}
                  disabled={savingPerms}
                  className="btn btn-primary btn-sm font-bold gap-1.5"
                >
                  {savingPerms ? <InlineSpinner size={14} /> : <Check className="h-4 w-4" />}
                  {permModalScope === 'user' ? 'Save Permissions' : 'Apply Permissions'}
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
                  onClick={() =>
                    openPermissionBuilder(
                      'edit',
                      editPermissionsDraft ||
                        directoryUsers.find((u) => u.id === editingUserId)?.permissions ||
                        makeTemplate(editRole, menuGroups)
                    )
                  }
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
      )}
    </div>
  );
}
