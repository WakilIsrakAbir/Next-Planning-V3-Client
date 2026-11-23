import { API_BASE } from '@/lib/constants';
import { asArray } from '@/features/filters/lib/as-array';
import { buildUnitOptions, fetchActiveMasterUnits } from '@/features/filters/lib/unit-filter';
import { PF_UNIT_FILTER_DEPTS } from '@/features/filters/plan-filter/lib/plan-filter-config';
import { buildPfRow, parseShortDateToISO } from '@/features/filters/plan-filter/lib/plan-filter-rows';
import type {
  JsonObject,
  OrderInfo,
  PfDataset,
  PfRow,
  PlanDoc,
  PlanItem,
} from '@/features/filters/plan-filter/types';

export const cachedPlanFilterData: Record<string, PfDataset> = {};

/**
 * Loads (or returns the cached) Plan Filter rows, buyers and Unit options for a department.
 * Never throws: on failure it returns an empty, uncached dataset.
 */
export async function loadPlanFilterData(dept: string, forceRefresh = false): Promise<PfDataset> {
  if (!forceRefresh && cachedPlanFilterData[dept]) return cachedPlanFilterData[dept];

  const rows: PfRow[] = [];
  const buyersSet = new Set<string>();
  const hasUnitFilter = PF_UNIT_FILTER_DEPTS.has(dept);

  try {
    const token = localStorage.getItem('token');
    const dbDeptKey = dept === 'deliveryfloor' ? 'delivery' : dept;

    // Active units from the dropdown master (legacy dropdownMasterCache), fetched in parallel.
    const masterUnitsPromise = hasUnitFilter ? fetchActiveMasterUnits() : Promise.resolve<string[]>([]);

    // 1. Fetch tracking data
    const res = await fetch(`${API_BASE}/api/orders/tracking/${dbDeptKey}?all=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return { rows: [], buyers: [], units: [] };

    const data = (await res.json()) as { planDocs?: PlanDoc[]; orderMap?: Record<string, OrderInfo> };
    const planDocs = asArray<PlanDoc>(data.planDocs);
    const orderMap = data.orderMap || {};
    const loadedOrderNos = new Set<string>();

    planDocs.forEach((plan) => {
      asArray<PlanItem>(plan[dbDeptKey]).forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const planType = dept === 'deliveryfloor' ? item.floorPlanType : item.planType;
        if (planType !== 'Confirm' && planType !== 'Tentative') return;

        loadedOrderNos.add(plan.orderNo);
        const orderInfo = orderMap[plan.orderNo] || {};
        const displayBuyer = String(orderInfo.buyer || plan.buyer || 'N/A');
        if (displayBuyer && displayBuyer !== 'N/A') buyersSet.add(displayBuyer.trim().toUpperCase());

        const sd = dept === 'deliveryfloor' ? item.floorStartDate : item.startDate;
        const ed = dept === 'deliveryfloor' ? item.floorEndDate : item.endDate;

        const row = buildPfRow(
          { ...(item.itemData || {}), ...item },
          {
            orderNo: plan.orderNo,
            buyer: displayBuyer,
            colorFallback: plan.color,
            unitFallback: orderInfo.floor,
            processFallback: orderInfo.programType,
          }
        );
        row['Plan Start Date'] = sd || '';
        row['Plan End Date'] = ed || '';
        row['Plan Type'] = planType;
        row._start = parseShortDateToISO(sd);
        row._end = parseShortDateToISO(ed);
        rows.push(row);
      });
    });

    // 2. Fetch tentative orders
    try {
      const tRes = await fetch(
        `${API_BASE}/api/orders?dept=${dbDeptKey}&status=Tentative&limit=5000&populateItems=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (tRes.ok) {
        const tData = (await tRes.json()) as { orders?: OrderInfo[] };
        asArray<OrderInfo>(tData.orders).forEach((order) => {
          const orderNo = String(order.orderNo ?? '');
          if (loadedOrderNos.has(orderNo)) return;
          if (order.buyer) buyersSet.add(order.buyer.trim().toUpperCase());

          let sd: string | undefined = '';
          let ed: string | undefined = '';
          if (dept === 'knitting') { sd = order.knitStart; ed = order.knitEnd; }
          else if (dept === 'dyeing') { sd = order.dyeStart; ed = order.dyeEnd; }
          else if (dept === 'delivery' || dept === 'deliveryfloor') { sd = order.deliStart; ed = order.deliEnd; }
          else if (dept === 'yd') { sd = order.ydStart; ed = order.ydEnd; }

          asArray<JsonObject>(order[`${dbDeptKey}Items`]).forEach((item) => {
            if (!item || typeof item !== 'object') return;
            const row = buildPfRow(item, {
              orderNo,
              buyer: order.buyer || 'N/A',
              unitFallback: order.floor,
              processFallback: order.programType,
            });
            row['Plan Start Date'] = sd || '';
            row['Plan End Date'] = ed || '';
            row['Plan Type'] = 'Tentative';
            row._start = parseShortDateToISO(sd);
            row._end = parseShortDateToISO(ed);
            rows.push(row);
          });
        });
      }
    } catch (err) {
      console.error('Error fetching tentative orders:', err);
    }

    const units = hasUnitFilter ? buildUnitOptions(rows.map((r) => r.Unit), await masterUnitsPromise) : [];
    const dataset: PfDataset = { rows, buyers: Array.from(buyersSet).sort(), units };
    cachedPlanFilterData[dept] = dataset;
    return dataset;
  } catch (err) {
    console.error('Error fetching plan filter data:', err);
    return { rows: [], buyers: [], units: [] };
  }
}
