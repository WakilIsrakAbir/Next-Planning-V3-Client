import {
  Database,
  RefreshCw,
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
import type {
  MenuGroup,
  PermissionFlags,
  PermissionGroup,
  PermissionItem,
  PermissionSet,
} from '@/features/management/users/types';
import { hasOwnKey, isRecord } from '@/features/management/users/lib/helpers';
import {
  ALL_ORDERS_ITEM,
  BATCH_UNIT_GROUP_KEYS,
  STATIC_BATCH_UNIT_ITEMS,
  UNIT_PERMISSION_KEY,
} from '@/features/management/users/lib/batch-units';

// ==========================================================
// RBAC STRUCTURE DEFINITIONS (Matching Exp System)
// ==========================================================

const groupIcon = 'h-3.5 w-3.5';

export const MENU_GROUPS: MenuGroup[] = [
  {
    key: 'dataManagement',
    title: 'Data Management',
    icon: <Database className={groupIcon} />,
    items: [
      ['view', 'Source File Upload'],
      ['atlasMonitor', 'Atlas Monitor'],
      ['planCheckList', 'Plan Check List'],
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
      // US-11 (the Sidebar uses `delivery` while a user has neither of these keys)
      ['deliveryFloor', 'Delivery Plan (Floor)'],
      ['deliveryLock', 'Delivery Plan (Lock)'],
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
      // US-12 (the Sidebar uses `delivery` while a user has neither of these keys)
      ['deliveryFloor', 'Updated Delivery Plan (Floor) Report'],
      ['deliveryLock', 'Updated Delivery Plan (Lock) Report'],
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

// Pending report download of each department (Reports page, Pending card)
const PENDING_REPORT_KEYS = [
  'reportPendingExcelYD',
  'reportPendingExcelKnitting',
  'reportPendingExcelDyeing',
  'reportPendingExcelFinishing',
  'reportPendingExcelDelivery',
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
      ['reportPendingExcelYD', 'Pending YD Report'],
      ['reportPendingExcelKnitting', 'Pending Knitting Report'],
      ['reportPendingExcelDyeing', 'Pending Dyeing Report'],
      ['reportPendingExcelFinishing', 'Pending Finishing Report'],
      ['reportPendingExcelDelivery', 'Pending Delivery Report'],
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

// "Wipe System & Files" was removed from both apps (16 Nov 2026); its permission is dropped on save.
const REMOVED_ACTION_KEYS = ['wipeSystem'];

// Permission keys added with the Batch Plan module. A user saved before they existed gets them only
// when an Admin ticks them in the permission builder, never from the role template.
const BATCH_PERMISSION_KEYS = {
  menus: {
    // atlasMonitor and planCheckList came later still; they are off for every saved user too until an Admin ticks them.
    dataManagement: ['dyeingMc', 'flatAllowance', 'unitSetup', 'atlasMonitor', 'planCheckList'],
    batchPlan: ['all', 'efl', 'ekl', 'ext', 'pluvia', 'outside'],
    batchCard: ['all', 'efl', 'ekl', 'ext', 'pluvia', 'outside'],
    batchReport: ['dyeableBatch', 'dyeableSummary', 'dailyConfirm'],
  } as Record<string, string[]>,
  actions: ['uploadBP', 'batchEdit', 'batchTentative', 'batchConfirm', 'batchInternalChange', 'batchMovePending', 'batchCardGenerate'],
  downloads: ['batchPlanPrint', 'batchCardPrint', 'dyeableExcel', 'dyeableSummaryExcel', 'dailyConfirmExcel'],
};

export function clonePermissions(p: PermissionSet): PermissionSet {
  return JSON.parse(JSON.stringify(p)) as PermissionSet;
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
      ...PENDING_REPORT_KEYS,
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
      ...PENDING_REPORT_KEYS,
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
export function normalizePermissions(raw: unknown, role: string | undefined, groups: MenuGroup[] = MENU_GROUPS): PermissionSet {
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
  // Pending report keys are new: a user saved before they existed keeps the access of the
  // matching Updated report (the same rule as the old app).
  PENDING_REPORT_KEYS.forEach((key) => {
    if (!hasOwnKey(raw.downloads, key)) {
      normalized.downloads[key] = !!normalized.downloads[key.replace('reportPendingExcel', 'reportUpdatedExcel')];
    }
  });
  // The one exception to "nothing stored is dropped": permissions of features that were removed,
  // so the next save of this user clears them.
  REMOVED_ACTION_KEYS.forEach((key) => {
    delete normalized.actions[key];
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

export function permissionCounts(p: PermissionSet | null | undefined, groups: MenuGroup[]) {
  if (!isRecord(p)) return { menu: 0, action: 0, download: 0 };
  const menus = isRecord(p.menus) ? p.menus : {};
  return {
    menu: groups.reduce((n, g) => n + countTrue(menus[g.key]), 0),
    action: countTrue(p.actions),
    download: countTrue(p.downloads),
  };
}

export function itemCount(groups: { items: PermissionItem[] }[]): number {
  return groups.reduce((n, g) => n + g.items.length, 0);
}

// Menu groups with the Batch Plan / Batch Card unit switches loaded from the server ("All Orders" first).
export function withBatchUnits(unitItems: PermissionItem[] | null): MenuGroup[] {
  if (!unitItems) return MENU_GROUPS;
  return MENU_GROUPS.map((g) => (BATCH_UNIT_GROUP_KEYS.has(g.key) ? { ...g, items: [ALL_ORDERS_ITEM, ...unitItems] } : g));
}

/* Batch Plan / Batch Card: a unit this user is ticked for but that is no longer listed still gets a
   switch, so the tick can be seen and removed. */
export function permissionMenuItems(group: MenuGroup, ...drafts: (PermissionSet | null | undefined)[]): PermissionItem[] {
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
export function forEachSwitch(
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
