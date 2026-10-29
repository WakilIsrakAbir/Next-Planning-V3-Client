import { API_BASE } from '@/lib/constants';
import { sharedRequest, whenBrowserIdle, whenRequestsSettled } from '@/lib/shared-request';
import { PlanStatus } from '@/types/order';

export interface IDeptPageState {
  page: number;
  limit: number;
  activeTab: PlanStatus | 'All';
  activeBuyer: string;
  globalSearch: string;
  colSearchOrder: string;
  colSearchDate: string;
  colSearchBuyer: string;
  colSearchStatus: string;
}

export const deptListStates: Record<string, IDeptPageState> = {};

export function getSavedDeptState(dept: string): IDeptPageState {
  const d = (dept || '').toLowerCase();
  if (deptListStates[d]) {
    return deptListStates[d];
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(`dept_state_${d}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        deptListStates[d] = parsed;
        return parsed;
      }
    } catch {}
  }
  return {
    page: 1,
    limit: 10,
    activeTab: 'Pending',
    activeBuyer: '',
    globalSearch: '',
    colSearchOrder: '',
    colSearchDate: '',
    colSearchBuyer: '',
    colSearchStatus: '',
  };
}

export function saveDeptState(dept: string, state: Partial<IDeptPageState>): void {
  const d = (dept || '').toLowerCase();
  const current = getSavedDeptState(d);
  const updated: IDeptPageState = { ...current, ...state };
  deptListStates[d] = updated;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(`dept_state_${d}`, JSON.stringify(updated));
    } catch {}
  }
}

export interface ICachedPlanningData {
  orders: any[];
  totalPages: number;
  total: number;
  buyers?: string[];
}

export interface ICachedOrderDetail {
  order: any;
  planData: any;
  timestamp: number;
}

export const cachedPlanningOrders: Record<string, ICachedPlanningData> = {};
export const cachedDeptBuyers: Record<string, string[]> = {};
export const cachedOrderDetails: Map<string, ICachedOrderDetail> = new Map();
export let cachedDropdownOptions: { units: string[]; processes: string[] } | null = null;

let isPrefetching = false;

// Background prefetch waits this long after it is requested, so the screen being opened sends its own requests first.
const PREFETCH_START_DELAY_MS = 800;

// One department list page request (the same query shape the department screen keeps in state).
export interface IPlanningListQuery {
  dept: string;
  activeTab: PlanStatus | 'All';
  activeBuyer: string;
  page: number;
  limit: number;
  globalSearch: string;
}

/** Cache key of a department list page in `cachedPlanningOrders` (shared by the screen and the prefetch). */
export function planningListKey(q: IPlanningListQuery): string {
  return `${q.dept}_${q.activeTab}_${q.activeBuyer}_${q.page}_${q.limit}_${q.globalSearch}`;
}

/**
 * Fetches one department list page and stores it in `cachedPlanningOrders` / `cachedDeptBuyers`.
 * Shared while in flight: the background prefetch and the screen never send the same page request twice.
 * Resolves `null` for a non-OK response.
 */
export function fetchPlanningOrders(q: IPlanningListQuery): Promise<ICachedPlanningData | null> {
  const query = new URLSearchParams({
    dept: q.dept,
    status: q.activeTab === 'All' ? 'Completed' : q.activeTab,
    buyer: q.activeBuyer,
    page: String(q.page),
    limit: String(q.limit),
    search: q.globalSearch,
  });
  const url = `${API_BASE}/api/orders?${query.toString()}`;

  return sharedRequest(url, async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const entry: ICachedPlanningData = {
      orders: data.orders || [],
      totalPages: data.totalPages || 1,
      total: data.total || 0,
      buyers: data.buyers || [],
    };
    cachedPlanningOrders[planningListKey(q)] = entry;
    if (entry.buyers && entry.buyers.length > 0) {
      cachedDeptBuyers[q.dept] = entry.buyers;
    }
    return entry;
  });
}

// Result of GET /api/orders/:orderNo (status kept so the detail screen can show "Order Not Found").
export interface IOrderDetailResponse {
  ok: boolean;
  status: number;
  data: Partial<Pick<ICachedOrderDetail, 'order' | 'planData'>> | null;
}

/**
 * Fetches one order's detail. Shared while in flight, so a hover prefetch followed by a click sends one request.
 * `fresh` starts a new request (used after saving).
 */
export function fetchOrderDetail(dept: string, orderNo: string, fresh = false): Promise<IOrderDetailResponse> {
  const url = `${API_BASE}/api/orders/${encodeURIComponent(orderNo)}?dept=${dept}`;
  return sharedRequest(
    url,
    async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { ok: res.ok, status: res.status, data: res.ok ? await res.json() : null };
    },
    fresh
  );
}

/**
 * Searches across all cached order lists to find an existing order header by orderNo.
 * Allows detail pages to display general information immediately (0ms).
 */
export function findPrecachedOrder(orderNo: string): any | null {
  if (!orderNo) return null;
  const target = String(orderNo).trim();
  for (const key of Object.keys(cachedPlanningOrders)) {
    const list = cachedPlanningOrders[key]?.orders;
    if (Array.isArray(list)) {
      const found = list.find((o) => String(o.orderNo).trim() === target);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Retrieves cached order detail if available and not expired (< 3 minutes)
 */
export function getPrecachedOrderDetail(dept: string, orderNo: string): { order: any; planData: any } | null {
  const key = `${dept.toLowerCase()}_${String(orderNo).trim()}`;
  const entry = cachedOrderDetails.get(key);
  if (entry && Date.now() - entry.timestamp < 3 * 60 * 1000) {
    return { order: entry.order, planData: entry.planData };
  }
  return null;
}

/**
 * Stores single order detail in memory cache
 */
export function setPrecachedOrderDetail(dept: string, orderNo: string, data: { order: any; planData: any }): void {
  const key = `${dept.toLowerCase()}_${String(orderNo).trim()}`;
  cachedOrderDetails.set(key, {
    order: data.order,
    planData: data.planData,
    timestamp: Date.now(),
  });
}

/**
 * Clears order detail cache for a specific order or all orders
 */
export function invalidateOrderDetailCache(orderNo?: string): void {
  if (!orderNo) {
    cachedOrderDetails.clear();
    return;
  }
  const target = String(orderNo).trim();
  for (const k of cachedOrderDetails.keys()) {
    if (k.endsWith(`_${target}`)) {
      cachedOrderDetails.delete(k);
    }
  }
}

/**
 * Pre-fetches master dropdown options (units and processes) once
 */
export async function prefetchDropdowns(): Promise<{ units: string[]; processes: string[] } | null> {
  if (cachedDropdownOptions) return cachedDropdownOptions;
  if (typeof window === 'undefined') return null;

  try {
    const url = `${API_BASE}/api/dropdowns`;
    return await sharedRequest(url, async () => {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      const data = await res.json();
      const units = data.units && data.units.length > 0 ? data.units.map((u: any) => u.name) : ['EFL', 'EKL', 'Ext', 'Outside'];
      const processes = data.processes && data.processes.length > 0 ? data.processes.map((p: any) => p.name) : ['Solid', 'Dyeing Wash', 'HTR', 'Pluvia', 'SB', 'WH', 'DF'];
      cachedDropdownOptions = { units, processes };
      return cachedDropdownOptions;
    });
  } catch {}
  return null;
}

/**
 * High-speed background prefetch on hover over the Eye button or Order link.
 * Guarantees that by the time user clicks, data is already in memory (0ms load);
 * a click while it is still running joins this request instead of sending another one.
 */
export async function prefetchOrderDetail(dept: string, orderNo: string): Promise<void> {
  if (!orderNo || typeof window === 'undefined') return;
  const key = `${dept.toLowerCase()}_${String(orderNo).trim()}`;
  if (cachedOrderDetails.has(key)) return;

  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetchOrderDetail(dept, orderNo);
    if (res.ok && res.data) {
      cachedOrderDetails.set(key, {
        order: res.data.order,
        planData: res.data.planData,
        timestamp: Date.now(),
      });
    }
  } catch {
    // Non-fatal prefetch failure
  }
}

/**
 * Background pre-fetching engine for all 5 Order Management departments:
 * Pre-caches Page 1 (Pending orders) so when user clicks any department,
 * the page renders in 0ms without waiting for network or showing blank spinners.
 * It starts only after the open screen's own requests have settled and the browser is idle,
 * and a department screen loading the same page shares the request (no duplicate).
 */
export async function prefetchOrderManagement(): Promise<void> {
  if (isPrefetching) return;
  if (typeof window === 'undefined') return;

  const token = localStorage.getItem('token');
  if (!token) return;

  isPrefetching = true;
  const depts = ['yd', 'knitting', 'dyeing', 'finishing', 'delivery'];
  let started = false;

  try {
    for (const dept of depts) {
      const q: IPlanningListQuery = { dept, activeTab: 'Pending', activeBuyer: '', page: 1, limit: 10, globalSearch: '' };
      if (cachedPlanningOrders[planningListKey(q)]) continue;

      if (!started) {
        await new Promise((r) => setTimeout(r, PREFETCH_START_DELAY_MS));
        started = true;
      }
      // Never compete with what the user is waiting for
      await whenRequestsSettled();
      await whenBrowserIdle();
      if (cachedPlanningOrders[planningListKey(q)] || !localStorage.getItem('token')) continue;

      try {
        await fetchPlanningOrders(q);
      } catch {}
      // Small delay to keep network light
      await new Promise((r) => setTimeout(r, 60));
    }
  } finally {
    isPrefetching = false;
  }
}
