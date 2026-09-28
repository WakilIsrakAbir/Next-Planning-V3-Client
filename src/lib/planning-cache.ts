import { API_BASE } from './constants';

export interface ICachedPlanningData {
  orders: any[];
  totalPages: number;
  total: number;
  buyers?: string[];
}

export const cachedPlanningOrders: Record<string, ICachedPlanningData> = {};
export const cachedDeptBuyers: Record<string, string[]> = {};

let isPrefetching = false;

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
