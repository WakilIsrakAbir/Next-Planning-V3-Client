/* Batch Plan module: routes, menu permissions and the "data changed" flag shared with the rest of the app.
   Port of the old project's js/batch-module.js. Used by the Batch routes (BatchRouteGuard, BatchProvider),
   the sidebar, the Source File Upload page and every page that changes data the Batch pages read. */

export type BatchRouteInfo = {
  title: string;
  group: 'batchPlan' | 'batchCard' | 'batchReport' | 'dataManagement';
  key: string;
};

// route -> title and permission (menus.<group>.<key>), as in the old BATCH_ROUTES.
export const BATCH_ROUTES: Record<string, BatchRouteInfo> = {
  plan: { title: 'Batch Plan', group: 'batchPlan', key: 'all' },
  card: { title: 'Batch Card', group: 'batchCard', key: 'all' },
  'setup/dyeing': { title: 'Dyeing MC', group: 'dataManagement', key: 'dyeingMc' },
  'setup/flat': { title: 'Flat Allowance', group: 'dataManagement', key: 'flatAllowance' },
  'setup/unit': { title: 'Unit Setup', group: 'dataManagement', key: 'unitSetup' },
  'report/detail': { title: 'Dyeable Batch', group: 'batchReport', key: 'dyeableBatch' },
  'report/summary': { title: 'Dyeable Batch Summary', group: 'batchReport', key: 'dyeableSummary' },
  'report/daily': { title: 'Daily Confirm Batch Plan', group: 'batchReport', key: 'dailyConfirm' },
};

const UNIT_ROUTE = /^(plan|card)\/([A-Z0-9]{1,40})$/;

/* The Dyeing Plan units (EFL, EKL, Ext, DTL, ...) are tabs in the heading of the Batch page.
   A unit route is "plan/<KEY>" or "card/<KEY>"; its permission key is the unit key in small letters
   (menus.batchPlan.dtl). */
export function batchRouteInfo(route: string): BatchRouteInfo | null {
  if (Object.prototype.hasOwnProperty.call(BATCH_ROUTES, route)) return BATCH_ROUTES[route];
  const match = UNIT_ROUTE.exec(String(route || ''));
  if (!match) return null;
  const [, kind, key] = match;
  return kind === 'plan'
    ? { title: 'Batch Plan', group: 'batchPlan', key: key.toLowerCase() }
    : { title: 'Batch Card', group: 'batchCard', key: key.toLowerCase() };
}

// "/batch/plan/EFL" -> "plan/EFL"; "/batch" -> "plan". Unknown routes give "plan" (the old default).
export function batchRouteFromPath(pathname: string): string {
  const rest = String(pathname || '')
    .replace(/^\/batch\/?/, '')
    .replace(/\/+$/, '');
  let route = rest;
  try {
    route = decodeURIComponent(rest);
  } catch {
    route = rest;
  }
  return batchRouteInfo(route) ? route : 'plan';
}

export function batchPathFromRoute(route: string): string {
  return '/batch/' + (batchRouteInfo(route) ? route : 'plan');
}

export function isBatchPath(pathname: string | null | undefined): boolean {
  return pathname === '/batch' || String(pathname || '').startsWith('/batch/');
}

/* ---------- permissions (the server checks the same keys, server src/utils/batch-rules.ts) ---------- */
type PermissionTree = {
  menus?: Record<string, Record<string, unknown> | undefined>;
  actions?: Record<string, unknown>;
} | null;
type StoredUser = { role: string; permissions: PermissionTree };

function storedUser(): StoredUser {
  if (typeof window === 'undefined') return { role: '', permissions: null };
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (user && typeof user === 'object') {
      let permissions = user.permissions;
      if (!permissions) permissions = JSON.parse(localStorage.getItem('permissions') || 'null');
      return { role: String(user.role || localStorage.getItem('role') || ''), permissions };
    }
  } catch {
    /* fall back to the single keys */
  }
  try {
    return { role: localStorage.getItem('role') || '', permissions: JSON.parse(localStorage.getItem('permissions') || 'null') };
  } catch {
    return { role: localStorage.getItem('role') || '', permissions: null };
  }
}

export function batchIsAdmin(): boolean {
  return storedUser().role === 'Admin';
}

export function batchHasMenu(group: string, key: string): boolean {
  const { role, permissions } = storedUser();
  if (role === 'Admin') return true;
  return !!(permissions && permissions.menus && permissions.menus[group] && permissions.menus[group][key] === true);
}

// Any permission in a menu group (the unit keys are not a fixed list).
export function batchHasAnyMenu(group: string): boolean {
  const { role, permissions } = storedUser();
  if (role === 'Admin') return true;
  const menu = permissions && permissions.menus && permissions.menus[group];
  return !!(menu && Object.values(menu).some((value) => value === true));
}

export function batchHasAction(key: string): boolean {
  const { role, permissions } = storedUser();
  if (role === 'Admin') return true;
  return !!(permissions && permissions.actions && permissions.actions[key] === true);
}

/* A unit page can be opened with that unit's permission or with the all-orders permission (the server's
   canUseFloor rule). The plain "plan"/"card" route (key "all") opens with any permission of the group:
   the Batch page then shows all orders or the first unit the user may open. */
export function batchCanOpen(group: string, key: string): boolean {
  if (key === 'all') return batchHasAnyMenu(group);
  return batchHasMenu(group, key) || batchHasMenu(group, 'all');
}

export function batchCanOpenRoute(route: string): boolean {
  const info = batchRouteInfo(route);
  return !!info && batchCanOpen(info.group, info.key);
}

export function batchHasAccess(): boolean {
  return (
    batchHasAnyMenu('batchPlan') ||
    batchHasAnyMenu('batchCard') ||
    batchHasAnyMenu('batchReport') ||
    ['dyeingMc', 'flatAllowance', 'unitSetup'].some((key) => batchHasMenu('dataManagement', key))
  );
}

// Source File Upload > BP Data tab (Admin always; the server checks actions.uploadBP too).
export function batchCanUploadBP(): boolean {
  return batchHasAction('uploadBP');
}

/* ---------- the unit opened last on Batch Plan and on Batch Card, kept in this browser ---------- */
const BATCH_LAST_ROUTE_KEY = 'batchLastRoute';

function batchLastRoutes(): Record<string, string> {
  try {
    const value = JSON.parse(localStorage.getItem(BATCH_LAST_ROUTE_KEY) || 'null');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

export function rememberBatchRoute(route: string): void {
  const match = /^(plan|card)(?:\/[A-Z0-9]{1,40})?$/.exec(String(route || ''));
  if (!match) return;
  const last = batchLastRoutes();
  last[match[1]] = route;
  try {
    localStorage.setItem(BATCH_LAST_ROUTE_KEY, JSON.stringify(last));
  } catch {
    /* ignore */
  }
}

// Sidebar item: the route opened last for that kind when the user may still open it, else the plain route.
export function batchMenuRoute(kind: 'plan' | 'card'): string {
  const last = batchLastRoutes()[kind];
  const info = last ? batchRouteInfo(last) : null;
  return info && String(last).startsWith(kind + '/') && batchCanOpen(info.group, info.key) ? last : kind;
}

/* ---------- newer data: the Batch page reloads it the next time it is shown ----------
   Set after a source file upload or delete, a full reset, a department plan save and a Dropdown Master
   unit change (the old project's markDataDirty hooks). */
let batchDataStale = false;
const staleListeners = new Set<() => void>();

export function markBatchDataStale(): void {
  batchDataStale = true;
  staleListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore */
    }
  });
}

export function isBatchDataStale(): boolean {
  return batchDataStale;
}

export function clearBatchDataStale(): void {
  batchDataStale = false;
}

export function onBatchDataStale(listener: () => void): () => void {
  staleListeners.add(listener);
  return () => {
    staleListeners.delete(listener);
  };
}

/* ---------- a sidebar click on the page that is already open re-opens it (old showBatchModule) ---------- */
export const BATCH_NAVIGATE_EVENT = 'batch-module:navigate';

export function requestBatchRoute(route: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BATCH_NAVIGATE_EVENT, { detail: { route } }));
}
