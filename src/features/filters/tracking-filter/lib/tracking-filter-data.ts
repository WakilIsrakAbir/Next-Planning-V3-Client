import { API_BASE } from '@/lib/constants';
import { asArray } from '@/features/filters/lib/as-array';
import { buildUnitOptions, extractUnitAndProcess } from '@/features/filters/lib/unit-filter';
import { isUnitProcessDept } from '@/features/filters/tracking-filter/lib/tracking-filter-config';
import type {
  ActualInfo,
  OrderInfo,
  PlanDoc,
  PlanItem,
  TrackingDataset,
  TrackingRow,
} from '@/features/filters/tracking-filter/types';

export const cachedTrackingFilterData: Record<string, TrackingDataset> = {};

/**
 * Loads (or returns the cached) tracking rows, buyers and Unit options for a department.
 * Never throws: on failure it returns an empty, uncached dataset.
 */
export async function loadTrackingFilterData(dept: string, forceRefresh = false): Promise<TrackingDataset> {
  if (!forceRefresh && cachedTrackingFilterData[dept]) return cachedTrackingFilterData[dept];

  const rows: TrackingRow[] = [];
  const buyersSet = new Set<string>();
  const unitProcessDept = isUnitProcessDept(dept);

  try {
    const token = localStorage.getItem('token');
    const dbDeptKey = dept === 'deliveryfloor' ? 'delivery' : dept;

    const res = await fetch(`${API_BASE}/api/orders/tracking/${dept}?all=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return { rows: [], buyers: [], units: [] };

    const data = (await res.json()) as { planDocs?: PlanDoc[]; orderMap?: Record<string, OrderInfo> };
    const planDocs = asArray<PlanDoc>(data.planDocs);
    const orderMap = data.orderMap || {};

    planDocs.forEach((plan) => {
      const deptItems = asArray<PlanItem>(plan[dbDeptKey]).filter((i) => i && typeof i === 'object');
      let startDates: string[] = [];
      let endDates: string[] = [];
      let planStart = '';
      let planEnd = '';

      if (deptItems.length > 0) {
        if (dept === 'deliveryfloor') {
          const floorItems = deptItems.filter(
            (i) => i.floorPlanType === 'Confirm' || i.floorPlanType === 'Tentative'
          );
          startDates = floorItems.map((i) => i.floorStartDate || '').filter(Boolean);
          endDates = floorItems.map((i) => i.floorEndDate || '').filter(Boolean);
        } else {
          startDates = deptItems.map((i) => i.startDate || '').filter(Boolean);
          endDates = deptItems.map((i) => i.endDate || '').filter(Boolean);
        }

        if (startDates.length > 0) { startDates.sort(); planStart = startDates[0]; }
        if (endDates.length > 0) { endDates.sort(); planEnd = endDates[endDates.length - 1]; }
      }

      if (!planStart && !planEnd) {
        const oInfo = orderMap[plan.orderNo] || {};
        if (dept === 'knitting') { planStart = oInfo.knitStart || ''; planEnd = oInfo.knitEnd || ''; }
        else if (dept === 'dyeing') { planStart = oInfo.dyeStart || ''; planEnd = oInfo.dyeEnd || ''; }
        else if (dept === 'delivery' || dept === 'deliveryfloor') { planStart = oInfo.deliStart || ''; planEnd = oInfo.deliEnd || ''; }
      }

      const actualKey = (dept === 'deliveryfloor' ? 'delivery' : dept) + 'Actual';
      const actual = (plan[actualKey] || null) as ActualInfo | null;
      const actualStart = actual?.actualStart || '';
      const actualEnd = actual?.actualEnd || '';
      const failReason = actual ? actual.failReason || actual.remarks || '' : '';
      const relatedDept = actual?.relatedDept || '';

      const orderInfo = orderMap[plan.orderNo] || {};
      const displayBuyer = String(orderInfo.buyer || plan.buyer || 'N/A');
      if (displayBuyer && displayBuyer !== 'N/A') buyersSet.add(displayBuyer.trim());

      // Unit & Process (Dyeing / Delivery / Delivery Floor): prefer server-computed values,
      // otherwise derive them from the order's dyeing items (legacy extractPvatfUnitAndProcess).
      let rowUnit = '';
      let rowProcessName = '';
      if (unitProcessDept) {
        if (plan.unit || plan.processName) {
          rowUnit = plan.unit || '';
          rowProcessName = plan.processName || '';
        } else {
          const extracted = extractUnitAndProcess(plan.dyeing || []);
          rowUnit = extracted.unit;
          rowProcessName = extracted.processName;
        }
      }

      rows.push({
        orderNo: plan.orderNo,
        buyer: displayBuyer,
        unit: rowUnit,
        processName: rowProcessName,
        planStart,
        planEnd,
        actualStart,
        actualEnd,
        failReason,
        relatedDept,
      });
    });

    const dataset: TrackingDataset = {
      rows,
      buyers: Array.from(buyersSet).sort(),
      units: unitProcessDept ? buildUnitOptions(rows.map((r) => r.unit)) : [],
    };
    cachedTrackingFilterData[dept] = dataset;
    return dataset;
  } catch (err) {
    console.error('Failed to fetch tracking filter data:', err);
    return { rows: [], buyers: [], units: [] };
  }
}
