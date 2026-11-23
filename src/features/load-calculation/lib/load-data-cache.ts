import { API_BASE } from '@/lib/constants';
import {
  processOrdersForLoadDepartment,
  type LoadReportResponse,
  type LoadRow,
} from '@/features/load-calculation/lib/load-calc-utils';

// Persistent module-level cache identical to Exp globalLoadData.
// Rows are built from the includePending report payload (Confirm + Tentative +
// Pending with T&A / Floor date fallbacks), one entry per department key.
export const cachedGlobalLoadData: Record<string, LoadRow[]> = {};

// Fetch a department's report (Confirm + Tentative + Pending) and build its load rows.
// Delivery data also yields the Delivery (Floor) rows, so both keys are cached together.
export async function fetchLoadRowsForDept(deptKey: string): Promise<Record<string, LoadRow[]> | null> {
  const token = localStorage.getItem('token');
  const actualDept = deptKey === 'deliveryfloor' ? 'delivery' : deptKey;

  const res = await fetch(`${API_BASE}/api/orders/report/${actualDept}?includePending=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data: LoadReportResponse = await res.json();
  if (!data.orders || !data.planMap) return null;

  const updates: Record<string, LoadRow[]> = {
    [actualDept]: processOrdersForLoadDepartment(data.orders, data.planMap, actualDept),
  };
  if (actualDept === 'delivery') {
    updates.deliveryfloor = processOrdersForLoadDepartment(data.orders, data.planMap, 'deliveryfloor');
  }

  Object.assign(cachedGlobalLoadData, updates);
  return updates;
}
