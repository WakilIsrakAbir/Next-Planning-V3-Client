import { API_BASE } from './constants';

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
const inFlightOrderDetail = new Set<string>();

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
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const res = await fetch(`${API_BASE}/api/dropdowns`, { headers });
    if (res.ok) {
      const data = await res.json();
      const units = data.units && data.units.length > 0 ? data.units.map((u: any) => u.name) : ['EFL', 'EKL', 'Ext', 'Outside'];
      const processes = data.processes && data.processes.length > 0 ? data.processes.map((p: any) => p.name) : ['Solid', 'Dyeing Wash', 'HTR', 'Pluvia', 'SB', 'WH', 'DF'];
      cachedDropdownOptions = { units, processes };
      return cachedDropdownOptions;
    }
  } catch {}
  return null;
}

/**
 * High-speed background prefetch on hover over the Eye button or Order link.
 * Guarantees that by the time user clicks, data is already in memory (0ms load).
 */
export async function prefetchOrderDetail(dept: string, orderNo: string): Promise<void> {
  if (!orderNo || typeof window === 'undefined') return;
  const key = `${dept.toLowerCase()}_${String(orderNo).trim()}`;
  if (cachedOrderDetails.has(key) || inFlightOrderDetail.has(key)) return;

  const token = localStorage.getItem('token');
  if (!token) return;

  inFlightOrderDetail.add(key);
  try {
    const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderNo)}?dept=${dept}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      cachedOrderDetails.set(key, {
        order: data.order,
        planData: data.planData,
        timestamp: Date.now(),
      });
    }
  } catch {
    // Non-fatal prefetch failure
  } finally {
    inFlightOrderDetail.delete(key);
  }
}

/**
 * Background pre-fetching engine for all 5 Order Management departments:
 * Pre-caches Page 1 (Pending orders) so when user clicks any department,
 * the page renders in 0ms without waiting for network or showing blank spinners.
 */
export async function prefetchOrderManagement(): Promise<void> {
  if (isPrefetching) return;
  if (typeof window === 'undefined') return;

  const token = localStorage.getItem('token');
  if (!token) return;

  isPrefetching = true;
  const depts = ['yd', 'knitting', 'dyeing', 'finishing', 'delivery'];

  try {
    for (const dept of depts) {
      const key = `${dept}_Pending__1_10_`;
      if (!cachedPlanningOrders[key]) {
        try {
          const res = await fetch(`${API_BASE}/api/orders?dept=${dept}&status=Pending&page=1&limit=10`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            const ords = data.orders || [];
            const tPages = data.totalPages || 1;
            const total = data.total || 0;
            const buyers = data.buyers || [];

            cachedPlanningOrders[key] = {
              orders: ords,
              totalPages: tPages,
              total,
              buyers,
            };

            if (buyers.length > 0) {
              cachedDeptBuyers[dept] = buyers;
            }
          }
        } catch {}
        // Small delay to keep network light
        await new Promise((r) => setTimeout(r, 60));
      }
    }
  } finally {
    isPrefetching = false;
  }
}
