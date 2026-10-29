'use client';

import React, { useEffect, useState, useMemo, useSyncExternalStore } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Layers,
} from 'lucide-react';
import InlineSpinner from '@/components/ui/InlineSpinner';
import { API_BASE } from '@/lib/constants';
import { getColData } from '@/lib/data-utils';
import {
  findPrecachedOrder,
  getPrecachedOrderDetail,
  setPrecachedOrderDetail,
  cachedDropdownOptions,
  prefetchDropdowns,
  fetchOrderDetail,
  invalidateOrderDetailCache,
} from '@/features/planning/lib/planning-cache';
import { markBatchDataStale } from '@/features/batch/lib/batch-navigation';

// Excel rows, saved plan items and order documents are free-form JSON shared with the old vanilla-JS app.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

// Admin / Approver role from localStorage (`user.role`, else `role` / `userRole`), read without a setState-in-effect.
const subscribeToNothing = () => () => {};
function readIsAdminRole(): boolean {
  let role = '';
  try {
    const stored = localStorage.getItem('user');
    if (stored) {
      const u = JSON.parse(stored);
      role = u.role || '';
    }
  } catch {}
  if (!role) {
    role = localStorage.getItem('role') || localStorage.getItem('userRole') || '';
  }
  const r = String(role).toLowerCase();
  return r === 'admin' || r === 'approver';
}

const DEPARTMENTS: Record<string, { name: string; label: string }> = {
  knitting: { name: 'Knitting Plan', label: 'Knitting' },
  dyeing: { name: 'Dyeing Plan', label: 'Dyeing' },
  finishing: { name: 'Finishing Plan', label: 'Finishing' },
  delivery: { name: 'Delivery Plan', label: 'Delivery' },
  yd: { name: 'YD Plan', label: 'YD' },
};

function formatDateDisplay(d: Loose): string {
  if (!d || d === '-' || d === 'N/A') return '—';
  try {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return String(d);
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = parsed.toLocaleString('en-US', { month: 'short' });
    const year = parsed.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return String(d);
  }
}

function formatExcelDate(val: Loose): string {
  if (!val || val === 'N/A' || val === '-' || val === '') return '—';
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return formatDateDisplay(d);
  }
  if (typeof val === 'string') {
    const num = Number(val);
    if (!isNaN(num) && num > 30000 && num < 60000) {
      const d = new Date(Math.round((num - 25569) * 86400 * 1000));
      return formatDateDisplay(d);
    }
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return formatDateDisplay(val);
    return val;
  }
  return String(val);
}

function generateItemId(itemData: Loose, tabId: string): string {
  if (!itemData) return Date.now().toString();
  const currentDept = tabId.replace('_report', '').toLowerCase();
  const bNo = String(itemData.OrderNo !== undefined && itemData.OrderNo !== null ? itemData.OrderNo : 'N/A').trim();
  const color = String(itemData.Color !== undefined && itemData.Color !== null ? itemData.Color : 'N/A').trim();

  if (currentDept === 'knitting' || currentDept === 'delivery') {
    const fabConst = String(
      itemData.FabricConstruction !== undefined && itemData.FabricConstruction !== null
        ? itemData.FabricConstruction
        : 'N/A'
    ).trim();
    const gsm = String(itemData.GSM !== undefined && itemData.GSM !== null ? itemData.GSM : 'N/A').trim();
    return `${bNo}_${color}_${fabConst}_${gsm}`.toLowerCase().replace(/\s+/g, '');
  } else if (currentDept === 'yd') {
    const type = String(
      itemData['Booking Type'] !== undefined && itemData['Booking Type'] !== null
        ? itemData['Booking Type']
        : 'N/A'
    ).trim();
    const ydb = String(itemData.YDB !== undefined && itemData.YDB !== null ? itemData.YDB : 'N/A').trim();
    return `${bNo}_${type}_${ydb}`.toLowerCase().replace(/\s+/g, '');
  } else {
    // data-processing.js (HEAD): ProcessName, else "Process Name", else ""; "n/a" and "-" count as empty.
    let procName = String(
      itemData.ProcessName !== undefined && itemData.ProcessName !== null
        ? itemData.ProcessName
        : itemData['Process Name'] !== undefined && itemData['Process Name'] !== null
          ? itemData['Process Name']
          : ''
    ).trim();
    if (procName.toLowerCase() === 'n/a' || procName === '-') procName = '';
    return `${bNo}_${color}_${procName}`.toLowerCase().replace(/\s+/g, '');
  }
}

// Port of the old `.resizable-table-input` CSS (index.html): one-row textarea that resizes both ways.
const RESIZABLE_INPUT_CLS =
  'resize min-w-[90px] min-h-[26px] h-[26px] leading-[1.25] align-middle box-border overflow-auto dark:bg-[#151921] dark:border-[#2a3346] dark:text-[#cbd5e1]';

// Old setup.js buildDynamicOptions: a saved value missing from the master list is still offered (first).
function withCurrentOption(options: string[], current: Loose): string[] {
  const val = current !== undefined && current !== null ? String(current) : '';
  if (val.trim() && !options.includes(val)) return [val, ...options];
  return options;
}

// detailed-view.js (HEAD): a delivery row reads the dyeing plan matched by colour, or by an itemId containing `_<colour>_`.
function matchesDyeColor(d: Loose, myColor: string): boolean {
  if (!d) return false;
  const c = String((d.itemData && d.itemData.Color) || d.Color || '').trim().toLowerCase();
  if (c === myColor) return true;
  if (d.itemId && String(d.itemId).toLowerCase().includes(`_${myColor}_`)) return true;
  return false;
}

function buildMergedItems(currentOrder: Loose, currentPlan: Loose, dept: string): Loose[] {
  if (!currentOrder) return [];
  const excelItems = currentOrder[`${dept}Items`] || [];
  const savedItems = (currentPlan && currentPlan[dept]) || [];
  const planMap = new Map<string, Loose>();
  savedItems.forEach((it: Loose) => {
    if (it.itemId) planMap.set(it.itemId, it);
  });

  const merged = excelItems.map((exItem: Loose, idx: number) => {
    let itemData: Record<string, Loose> = {};

    if (dept === 'knitting' || dept === 'delivery') {
      itemData = {
        OrderNo: getColData(exItem, ['BookingNo', 'OrderNo', 'EWO', 'Booking', 'Order No', 'Booking No']) || currentOrder.orderNo,
        Color: getColData(exItem, ['Color', 'Colour', 'Fab Color']),
        FabricConstruction: getColData(exItem, ['FabricConstruction', 'Construction', 'Fab Const', 'Fabric']),
        GSM: getColData(exItem, ['GSM', 'G.S.M']),
        RequiredQtyKgs: getColData(exItem, ['RequiredQtyKgs', 'Req Qty', 'Qty']),
        Buyer: getColData(exItem, ['Buyer', 'BuyerName', 'Customer']) || currentOrder.buyer,
        Allowance: getColData(exItem, ['Allowance %', 'Allowance', 'Wastage %', 'Wastage', 'Allow %', 'Allow']),
        YarnReq: getColData(exItem, ['Yarn req.', 'YarnReq', 'Yarn Req', 'Yarn Req.']),
        AllocatedQty: getColData(exItem, ['Allocated Qty', 'Allocated Qty ', 'AllocatedQty', 'Alloc Qty']),
        YarnBala: getColData(exItem, ['Yarn bala.', 'YarnBala', 'Yarn Bala', 'Yarn Balance']),
        GreyReq: getColData(exItem, ['Grey Req.', 'GreyReq', 'Grey Req']),
        KnitProd: getColData(exItem, ['Knit Prod.', 'KnitProd', 'Knit Prod', 'Knit Production']),
        KnitBala: getColData(exItem, ['Knit. Bala.', 'KnitBala', 'Knit Bala.', 'Knit Bala', 'Knit. Bal.']),
        NetReceivedQtyKgs: getColData(exItem, ['NetReceivedQtyKgs', 'NetReceivedQty', 'ReceivedQty']),
        NetDeliveryQtyKgs: getColData(exItem, ['NetDeliveryQtyKgs', 'NetDeliveryQty', 'DeliveryQty']),
        DeliBal: getColData(exItem, ['Deli. Bal.', 'Deli Bal.', 'DeliBal', 'Delivery Balance', 'Deli. Bala.']),
        RFD: getColData(exItem, ['RFD']),
        Slowmoving: getColData(exItem, ['Slowmoving', 'Slow Moving']),
        FFStock: getColData(exItem, ['FF Stock', 'FFStock', 'FF_Stock']),
      };
    } else if (dept === 'yd') {
      itemData = {
        OrderNo: getColData(exItem, ['BookingNo', 'OrderNo', 'EWO', 'Booking', 'Order No', 'Booking No']) || currentOrder.orderNo,
        'Booking Type': getColData(exItem, ['Booking Type', 'Type', 'YD Type', 'BookingType']),
        YDB: getColData(exItem, ['YDB', 'YD B', 'YDB#']),
        'YD Booking Date': getColData(exItem, ['YD Booking Date', 'Date', 'Booking Date', 'YDBookingDate']),
        'YD T&A Start': getColData(exItem, ['YD T&A Start', 'T&A Start', 'YD T&A Start Date', 'YD TNA Start', 'TNA Start', 'Start Date']),
        'YD T&A End': getColData(exItem, ['YD T&A End', 'T&A End', 'YD T&A End Date', 'YD TNA End', 'TNA End', 'End Date']),
        'YD REQ.': getColData(exItem, ['YD REQ.', 'YD REQ', 'YD Req', 'Requirement', 'YDReq']),
        DYED: getColData(exItem, ['DYED', 'Dyed', 'Dye']),
        'YD BALANCE': getColData(exItem, ['YD BALANCE', 'YD Balance', 'YDBalance']),
        'YD Delivered': getColData(exItem, ['YD Delivered', 'Delivered', 'Delivery', 'YDDelivered']),
        'YD DELIVERY BALANCE': getColData(exItem, ['YD DELIVERY BALANCE', 'YD Balance_1', 'YD Balance 2', 'YDDeliveryBalance']),
        'Barrier Qty.': getColData(exItem, ['Barrier Qty.', 'Barrier Qty', 'Barrier', 'BarrierQty']),
        'Workable Qty.': getColData(exItem, ['Workable Qty.', 'Workable Qty', 'Workable', 'WorkableQty']),
      };
    } else {
      // Dyeing / Finishing (same key set as old HEAD detailed-view.js, so saved itemData matches the old app)
      itemData = {
        OrderNo: getColData(exItem, ['BookingNo', 'OrderNo', 'EWO', 'Booking', 'Order No', 'Booking No']) || currentOrder.orderNo,
        Color: getColData(exItem, ['Color', 'Colour', 'Fab Color']),
        RequiredQtyKgs: getColData(exItem, ['RequiredQtyKgs', 'Req Qty', 'Qty', 'Order Qty']),
        Buyer: getColData(exItem, ['Buyer', 'BuyerName', 'Customer']) || currentOrder.buyer,
        Unit: getColData(exItem, ['Unit']),
        ProcessName: getColData(exItem, ['Process Name', 'ProcessName', 'Process']),
        Allowance: getColData(exItem, ['Allowance %', 'Allowance', 'Wastage %', 'Wastage', 'Allow %', 'Allow']),
        YarnReq: getColData(exItem, ['Yarn req.', 'YarnReq', 'Yarn Req', 'Yarn Req.']),
        AllocatedQty: getColData(exItem, ['Allocated Qty', 'Allocated Qty ', 'AllocatedQty', 'Alloc Qty']),
        YarnBala: getColData(exItem, ['Yarn bala.', 'YarnBala', 'Yarn Bala', 'Yarn Balance']),
        GreyReq: getColData(exItem, ['Grey Req.', 'GreyReq', 'Grey Req']),
        KnitProd: getColData(exItem, ['Knit Prod.', 'KnitProd', 'Knit Prod', 'Knit Production']),
        KnitBala: getColData(exItem, ['Knit. Bala.', 'KnitBala', 'Knit Bala.', 'Knit Bala', 'Knit. Bal.']),
        BPQty: getColData(exItem, ['BP Qty', 'BPQty', 'BP_Qty']),
        DyeingProd: getColData(exItem, ['Dyeing Prod.', 'DyeingProd', 'Dyeing Prod', 'Dyeing ok', 'Dyeing Production']),
        DyeingBala: getColData(exItem, ['Dyeing Bala.', 'DyeingBala', 'Dyeing Bala', 'Dyeing Bal.']),
        NetReceivedQtyKgs: getColData(exItem, ['NetReceivedQtyKgs', 'NetReceivedQty', 'ReceivedQty']),
        NetDeliveryQtyKgs: getColData(exItem, ['NetDeliveryQtyKgs', 'NetDeliveryQty', 'DeliveryQty']),
        DeliBal: getColData(exItem, ['Deli. Bal.', 'Deli Bal.', 'DeliBal', 'Delivery Balance', 'Deli. Bala.']),
        RFD: getColData(exItem, ['RFD']),
        Slowmoving: getColData(exItem, ['Slowmoving', 'Slow Moving']),
        FFStock: getColData(exItem, ['FF Stock', 'FFStock', 'FF_Stock']),
      };
    }

    const genId = generateItemId(itemData, dept);
    const itemId = exItem.itemId || genId || `item_${idx}`;

    // Resilient saved-item (dbItem) matching, as in old HEAD detailed-view.js:
    // exact id -> id ignoring a trailing "_" / "_n/a" -> same Color (dyeing/finishing) -> same YDB (yd).
    let dbItem: Loose = planMap.get(itemId) || planMap.get(genId);
    if (!dbItem && savedItems.length > 0) {
      const cleanId = String(itemId).replace(/(_n\/a|_)$/i, '').toLowerCase();
      dbItem = savedItems.find(
        (d: Loose) => d && d.itemId && String(d.itemId).toLowerCase().replace(/(_n\/a|_)$/i, '') === cleanId
      );

      if (!dbItem && (dept === 'dyeing' || dept === 'finishing')) {
        const color = String(itemData.Color || '').trim().toLowerCase();
        if (color) {
          dbItem = savedItems.find(
            (d: Loose) => d && d.itemData && String(d.itemData.Color || '').trim().toLowerCase() === color
          );
        }
      }

      if (!dbItem && dept === 'yd') {
        const ydb = String(itemData.YDB || itemData['YD B'] || '').trim().toLowerCase();
        if (ydb && ydb !== 'n/a') {
          dbItem = savedItems.find(
            (d: Loose) =>
              d && d.itemData && String(d.itemData.YDB || d.itemData['YD B'] || '').trim().toLowerCase() === ydb
          );
        }
      }
    }
    const saved = dbItem || {};

    if (saved && saved.itemData) {
      if (saved.itemData.Unit) itemData.Unit = saved.itemData.Unit;
      if (saved.itemData.ProcessName) itemData.ProcessName = saved.itemData.ProcessName;
      if (saved.itemData['Process Name']) itemData['Process Name'] = saved.itemData['Process Name'];
      if (saved.itemData['Barrier Qty.']) itemData['Barrier Qty.'] = saved.itemData['Barrier Qty.'];
      if (saved.itemData['Workable Qty.']) itemData['Workable Qty.'] = saved.itemData['Workable Qty.'];
    }

    // Unit / Process Name fall back to the order's floor / program type (old HEAD, every department).
    if (!itemData.Unit && currentOrder.floor) itemData.Unit = currentOrder.floor;
    if (!itemData.ProcessName && currentOrder.programType) itemData.ProcessName = currentOrder.programType;
    if (!itemData['Process Name'] && currentOrder.programType) itemData['Process Name'] = currentOrder.programType;

    // Plan dates come only from the saved item: no T&A fallback (removed in old HEAD).
    const planType = saved.planType || exItem.planType || '';
    const startDate = saved.startDate || saved.planStart || exItem.startDate || '';
    const floorPlanType = saved.floorPlanType || exItem.floorPlanType || '';
    const floorStartDate = saved.floorStartDate || exItem.floorStartDate || '';

    // UI-only flag (never sent): a saved plan keeps Dyeing/Delivery editable even when the upstream type is blank.
    const hasExistingPlan =
      dept === 'delivery'
        ? Boolean(floorPlanType || planType || floorStartDate || startDate)
        : Boolean(planType || startDate);

    return {
      ...exItem,
      itemId,
      itemData,
      planType,
      startDate,
      endDate: saved.endDate || saved.planEnd || exItem.endDate || '',
      limitation: saved.limitation || exItem.limitation || '',
      remarks: saved.remarks || exItem.remarks || '',
      unit: saved.unit || itemData.Unit || exItem.Unit || '',
      processName: saved.processName || itemData.ProcessName || exItem.ProcessName || exItem['Process Name'] || '',
      yarnDate: saved.yarnDate || exItem.yarnDate || '',
      yarnOkDate: saved.yarnOkDate || exItem.yarnOkDate || '',
      matchingOptionDate: saved.matchingOptionDate || exItem.matchingOptionDate || '',
      floorStartDate,
      floorEndDate: saved.floorEndDate || exItem.floorEndDate || '',
      floorPlanType,
      barrierQty: saved.barrierQty !== undefined ? saved.barrierQty : (saved.itemData ? saved.itemData['Barrier Qty.'] : itemData['Barrier Qty.']),
      workableQty: saved.workableQty !== undefined ? saved.workableQty : (saved.itemData ? saved.itemData['Workable Qty.'] : itemData['Workable Qty.']),
      hasExistingPlan,
    };
  });

  // Parity with Exp detailed-view.js lines 361-380: Delivery Floor default dates from Dyeing plan
  if (dept === 'delivery') {
    merged.forEach((item: Loose) => {
      const myColor = String(item.itemData.Color || '').trim().toLowerCase();
      const dItem = currentPlan?.dyeing?.find((d: Loose) => matchesDyeColor(d, myColor));
      const hasDyePlanType = Boolean(
        dItem?.planType && dItem.planType !== 'Select' && dItem.planType !== '-' && dItem.planType !== ''
      );

      if (hasDyePlanType) {
        const dyeStart = dItem?.startDate || dItem?.planStart;
        const dyeEnd = dItem?.endDate || dItem?.planEnd;

        if (!item.floorStartDate && dyeStart) {
          const d = new Date(dyeStart);
          d.setDate(d.getDate() + 7);
          item.floorStartDate = d.toISOString().split('T')[0];
        }
        if (!item.floorEndDate && dyeEnd) {
          const d = new Date(dyeEnd);
          d.setDate(d.getDate() + 7);
          item.floorEndDate = d.toISOString().split('T')[0];
        }
        if (!item.floorPlanType) {
          item.floorPlanType = 'Tentative';
        }
      }
    });
  }

  // Parity with Exp detailed-view.js lines 472-484: YD Floor default dates from YD plan (startDate - 4 days)
  if (dept === 'yd') {
    merged.forEach((item: Loose) => {
      if (!item.floorStartDate && item.startDate) {
        const d = new Date(item.startDate);
        d.setDate(d.getDate() - 4);
        item.floorStartDate = d.toISOString().split('T')[0];
      }
      if (!item.floorEndDate && item.endDate) {
        const d = new Date(item.endDate);
        d.setDate(d.getDate() - 4);
        item.floorEndDate = d.toISOString().split('T')[0];
      }
    });
  }

  return merged;
}

export default function OrderPlanningScreen() {
  const params = useParams();
  const router = useRouter();

  const dept = (params.dept as string)?.toLowerCase() || 'knitting';
  const orderNo = params.orderNo as string;

  // 0. High-speed initial hydration: check cache & list header (0ms instant render)
  const cachedDetail = getPrecachedOrderDetail(dept, orderNo);
  const precachedHeader = findPrecachedOrder(orderNo);

  const [planItems, setPlanItems] = useState<Loose[]>(() => {
    if (cachedDetail?.order) {
      return buildMergedItems(cachedDetail.order, cachedDetail.planData, dept);
    }
    return [];
  });
  // Spinner only while no items are on screen (no cache, or a cached order without items) until the first fetch ends.
  const [loading, setLoading] = useState<boolean>(() => planItems.length === 0);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [order, setOrder] = useState<Loose>(() => cachedDetail?.order || precachedHeader || { orderNo });
  const [planData, setPlanData] = useState<Loose>(() => cachedDetail?.planData || null);
  const [orderStatus, setOrderStatus] = useState<string>(() => {
    if (cachedDetail?.planData?.[`${dept}Status`]) {
      return cachedDetail.planData[`${dept}Status`];
    }
    return 'On Process';
  });
  // 1. Resolve Admin / Approver Role from localStorage (false during SSR / hydration, then the stored role)
  const isAdmin = useSyncExternalStore(subscribeToNothing, readIsAdminRole, () => false);
  const [toast, setToast] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Dynamic dropdown options for Dyeing / Finishing
  const [unitOptions, setUnitOptions] = useState<string[]>(() => cachedDropdownOptions?.units || ['EFL', 'EKL', 'Ext', 'Outside']);
  const [processOptions, setProcessOptions] = useState<string[]>(() => cachedDropdownOptions?.processes || [
    'Solid',
    'Dyeing Wash',
    'HTR',
    'Pluvia',
    'SB',
    'WH',
    'DF',
  ]);

  const deptMeta = DEPARTMENTS[dept] || { name: dept.toUpperCase(), label: dept };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/planning/${dept}`);
    }
  };

  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3800);
  };

  const fetchOrderAndDropdowns = async (fresh = false) => {
    // `loading` starts true when no items are populated from cache; re-fetches after a save keep the table visible.
    try {
      // Parallelize dropdowns fetch & order detail fetch (joins a still-running hover prefetch of this order;
      // `fresh` after a save always reads the saved state)
      const [orderRes, ddData] = await Promise.all([
        fetchOrderDetail(dept, orderNo, fresh),
        cachedDropdownOptions ? Promise.resolve(null) : prefetchDropdowns(),
      ]);

      if (ddData) {
        if (ddData.units && ddData.units.length > 0) setUnitOptions(ddData.units);
        if (ddData.processes && ddData.processes.length > 0) setProcessOptions(ddData.processes);
      }

      if (!orderRes.ok) {
        if (orderRes.status === 404) {
          setNotFound(true);
        }
        throw new Error(`Failed to load order #${orderNo}`);
      }

      const data = orderRes.data || {};
      const currentOrder = data.order || {};
      const currentPlan = data.planData || {};

      setOrder(currentOrder);
      setPlanData(currentPlan);

      if (currentPlan[`${dept}Status`]) {
        setOrderStatus(currentPlan[`${dept}Status`]);
      } else {
        setOrderStatus('On Process');
      }

      // Merge raw items with saved plan data using Exp detailed-view.js logic
      const merged = buildMergedItems(currentOrder, currentPlan, dept);
      setPlanItems(merged);

      // Save to client cache for 0ms subsequent returns
      setPrecachedOrderDetail(dept, orderNo, { order: currentOrder, planData: currentPlan });
    } catch (err: Loose) {
      console.error(err);
      if (planItems.length === 0) {
        showToast(err.message || 'Error loading order details.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch-on-route-change: state is only set once the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrderAndDropdowns();
    // Re-fetch only when the route (dept / order) changes, not on every state update the fetch closes over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dept, orderNo]);

  // Helper to extract upstream Knitting and Dyeing plans for cross-department checks
  const getUpstreamPlans = (item: Loose) => {
    const myColor = String(item.itemData?.Color || item.Color || item['Color'] || item['Colour'] || '').trim().toLowerCase();
    const myConst = String(item.itemData?.FabricConstruction || item.FabricConstruction || item['Fabric Construction'] || item['Construction'] || '').trim().toLowerCase();

    let knitItem: Loose = null;
    let dyeItem: Loose = null;

    if (planData?.knitting && Array.isArray(planData.knitting)) {
      knitItem = planData.knitting.find((k: Loose) => {
        const c = String((k.itemData && k.itemData.Color) || k.Color || '').trim().toLowerCase();
        const fc = String((k.itemData && k.itemData.FabricConstruction) || k.FabricConstruction || '').trim().toLowerCase();
        if (myConst && fc) {
          return c === myColor && fc === myConst;
        }
        return c === myColor;
      });
      if (!knitItem) {
        knitItem = planData.knitting.find((k: Loose) => {
          const c = String((k.itemData && k.itemData.Color) || k.Color || '').trim().toLowerCase();
          return c === myColor;
        });
      }
    }

    if (planData?.dyeing && Array.isArray(planData.dyeing)) {
      dyeItem = planData.dyeing.find((d: Loose) => matchesDyeColor(d, myColor));
    }

    const isKnitTypeSelected = Boolean(
      knitItem?.planType && knitItem.planType !== 'Select' && knitItem.planType !== '-' && knitItem.planType !== ''
    );
    const isDyeTypeSelected = Boolean(
      dyeItem?.planType && dyeItem.planType !== 'Select' && dyeItem.planType !== '-' && dyeItem.planType !== ''
    );

    return { knitItem, dyeItem, isKnitTypeSelected, isDyeTypeSelected };
  };

  // For YD: Upstream Knit Plan from first knitting item or general order info (detailed-view.js lines 446-458)
  const ydBKnitPlan = useMemo(() => {
    if (dept !== 'yd') return { start: '', end: '' };
    if (planData?.knitting && Array.isArray(planData.knitting) && planData.knitting.length > 0) {
      const kItem = planData.knitting[0];
      return {
        start: kItem.startDate || kItem.planStart || '',
        end: kItem.endDate || kItem.planEnd || '',
      };
    }
    return {
      start: order?.knitStart && order.knitStart !== 'N/A' && order.knitStart !== '-' ? order.knitStart : '',
      end: order?.knitEnd && order.knitEnd !== 'N/A' && order.knitEnd !== '-' ? order.knitEnd : '',
    };
  }, [dept, planData, order]);

  // ==========================================================
  // EXACT EXP CONDITIONS (from detailed-view.js & table-headers.js)
  // ==========================================================

  // 1. isValidStartDate (Exp detailed-view.js lines 640-662)
  const isValidStartDate = (item: Loose, newStart: string): boolean => {
    if (!newStart) return true;
    const endVal = item.endDate;
    if (newStart && endVal && new Date(newStart) > new Date(endVal)) {
      showToast('Start Date cannot be greater than End Date!');
      return false;
    }

    if (dept === 'dyeing' && newStart) {
      const { knitItem } = getUpstreamPlans(item);
      const knitStart = knitItem?.startDate || knitItem?.planStart;
      const knitEnd = knitItem?.endDate || knitItem?.planEnd;
      const knitType = knitItem?.planType;

      if (!knitStart && !knitEnd && (!knitType || knitType === 'Select' || knitType === '')) {
        showToast('Cannot set Dyeing plan because Knitting plan is blank!');
        return false;
      }

      if (knitStart && knitStart !== '-' && new Date(newStart).setHours(0, 0, 0, 0) < new Date(knitStart).setHours(0, 0, 0, 0)) {
        showToast('Dyeing Start Date cannot be less than Knitting Start Date!');
        return false;
      }
    }

    return true;
  };

  // 2. isValidEndDate (Exp detailed-view.js lines 664-686)
  const isValidEndDate = (item: Loose, newEnd: string): boolean => {
    if (!newEnd) return true;
    const startVal = item.startDate;
    if (startVal && newEnd && new Date(startVal) > new Date(newEnd)) {
      showToast('Start Date cannot be greater than End Date!');
      return false;
    }

    if (dept === 'dyeing' && newEnd) {
      const { knitItem } = getUpstreamPlans(item);
      const knitStart = knitItem?.startDate || knitItem?.planStart;
      const knitEnd = knitItem?.endDate || knitItem?.planEnd;
      const knitType = knitItem?.planType;

      if (!knitStart && !knitEnd && (!knitType || knitType === 'Select' || knitType === '')) {
        showToast('Cannot set Dyeing plan because Knitting plan is blank!');
        return false;
      }

      if (knitEnd && knitEnd !== '-' && new Date(newEnd).setHours(0, 0, 0, 0) < new Date(knitEnd).setHours(0, 0, 0, 0)) {
        showToast('Dyeing End Date cannot be less than Knitting End Date!');
        return false;
      }
    }

    return true;
  };

  // 3. isValidPlanType (Exp detailed-view.js lines 688-728)
  const isValidPlanType = (item: Loose, startVal: string, endVal: string, planTypeVal: string): boolean => {
    if (!planTypeVal || planTypeVal === 'Select') return true;

    // Both Start and End are required
    if ((planTypeVal === 'Confirm' || planTypeVal === 'Tentative') && (!startVal || !endVal)) {
      showToast('Start and End dates are required to set Plan Type.');
      return false;
    }

    // Knitting specific: Confirm requires Yarn Date (table-headers.js line 221)
    if (dept === 'knitting' && planTypeVal === 'Confirm') {
      const yarnVal = item.yarnDate;
      if (!yarnVal || yarnVal === '-' || yarnVal === 'N/A') {
        showToast("Without Yarn Date input, Knitting Plan Type cannot be 'Confirm'!");
        return false;
      }
    }

    // Dyeing specific: checks knitting plan and final confirmation
    if (dept === 'dyeing' && planTypeVal) {
      const { knitItem } = getUpstreamPlans(item);
      const knitStart = knitItem?.startDate || knitItem?.planStart;
      const knitEnd = knitItem?.endDate || knitItem?.planEnd;
      const knitType = String(knitItem?.planType || '').trim();

      if (!knitStart && !knitEnd && (!knitType || knitType === 'Select' || knitType === '')) {
        showToast('Cannot set Dyeing plan because Knitting plan is blank!');
        return false;
      }

      if (planTypeVal === 'Confirm' && knitType === 'Tentative') {
        showToast('Cannot confirm Dyeing when Knitting is Tentative.');
        return false;
      }

      if (planTypeVal === 'Confirm') {
        const finalConf = String(order?.finalConfirmation || '').trim().toLowerCase();
        if (finalConf === 'no') {
          showToast("Cannot confirm Dyeing because Final Confirmation is 'No'.");
          return false;
        }
      }
    }

    // Delivery specific: Confirm requires Dyeing not Tentative or blank
    if (dept === 'delivery' && planTypeVal) {
      const { dyeItem } = getUpstreamPlans(item);
      const dyeType = String(dyeItem?.planType || '').trim();

      if (planTypeVal === 'Confirm' && (dyeType === 'Tentative' || dyeType === '-' || dyeType === '')) {
        showToast('Cannot confirm Delivery when Dyeing is Tentative or blank.');
        return false;
      }
    }

    return true;
  };

  // ==========================================================
  // EVENT HANDLERS WITH EXP CASCADING AUTO-FILL (index === 0)
  // ==========================================================

  // 1. Yarn Date Change (Knitting) - Exp table-headers.js autoFillYarnDate
  const handleYarnDateChange = (index: number, val: string) => {
    setPlanItems((prev) => {
      const next = [...prev];
      if (index === 0) {
        return next.map((it) => {
          const updated = { ...it, yarnDate: val };
          if (!val && updated.planType === 'Confirm') {
            updated.planType = '';
          }
          if (val && updated.startDate && updated.startDate < val) {
            updated.startDate = val;
          }
          if (val && updated.endDate && updated.endDate < (updated.startDate || val)) {
            updated.endDate = updated.startDate || val;
          }
          return updated;
        });
      } else {
        const updated = { ...next[index], yarnDate: val };
        if (!val && updated.planType === 'Confirm') {
          updated.planType = '';
          showToast("Without Yarn Date input, Knitting Plan Type cannot be 'Confirm'!");
        }
        if (val && updated.startDate && updated.startDate < val) {
          updated.startDate = val;
        }
        if (val && updated.endDate && updated.endDate < (updated.startDate || val)) {
          updated.endDate = updated.startDate || val;
        }
        next[index] = updated;
        return next;
      }
    });

    if (index === 0 && !val) {
      showToast("Without Yarn Date input, Knitting Plan Type cannot be 'Confirm'!");
    }
  };

  // 2. Start Date Change - Exp detailed-view.js lines 730-755 & YD syncFloorDates
  const handleStartDateChange = (index: number, newStart: string) => {
    const currentItem = planItems[index];

    if (!isValidStartDate(currentItem, newStart)) {
      setPlanItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], startDate: '' };
        return next;
      });
      return;
    }

    setPlanItems((prev) => {
      const next = [...prev];
      if (index === 0) {
        return next.map((it) => {
          const updated = { ...it, startDate: newStart };
          if (updated.endDate && updated.endDate < newStart) {
            updated.endDate = newStart;
          }
          // YD Floor Sync (table-headers.js lines 263-288: floorStart = startDate - 4 days)
          if (dept === 'yd') {
            if (newStart) {
              const d = new Date(newStart);
              d.setDate(d.getDate() - 4);
              updated.floorStartDate = d.toISOString().split('T')[0];
            } else {
              updated.floorStartDate = '';
            }
          }
          if (!isValidPlanType(updated, newStart, updated.endDate, updated.planType)) {
            updated.planType = '';
          }
          return updated;
        });
      } else {
        const updated = { ...next[index], startDate: newStart };
        if (updated.endDate && updated.endDate < newStart) {
          updated.endDate = newStart;
        }
        if (dept === 'yd') {
          if (newStart) {
            const d = new Date(newStart);
            d.setDate(d.getDate() - 4);
            updated.floorStartDate = d.toISOString().split('T')[0];
          } else {
            updated.floorStartDate = '';
          }
        }
        if (!isValidPlanType(updated, newStart, updated.endDate, updated.planType)) {
          updated.planType = '';
        }
        next[index] = updated;
        return next;
      }
    });
  };

  // 3. End Date Change - Exp detailed-view.js lines 757-782 & YD syncFloorDates
  const handleEndDateChange = (index: number, newEnd: string) => {
    const currentItem = planItems[index];

    if (!isValidEndDate(currentItem, newEnd)) {
      setPlanItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], endDate: '' };
        return next;
      });
      return;
    }

    setPlanItems((prev) => {
      const next = [...prev];
      if (index === 0) {
        return next.map((it) => {
          const updated = { ...it, endDate: newEnd };
          if (dept === 'yd') {
            if (newEnd) {
              const d = new Date(newEnd);
              d.setDate(d.getDate() - 4);
              updated.floorEndDate = d.toISOString().split('T')[0];
            } else {
              updated.floorEndDate = '';
            }
          }
          if (!isValidPlanType(updated, updated.startDate, newEnd, updated.planType)) {
            updated.planType = '';
          }
          return updated;
        });
      } else {
        const updated = { ...next[index], endDate: newEnd };
        if (dept === 'yd') {
          if (newEnd) {
            const d = new Date(newEnd);
            d.setDate(d.getDate() - 4);
            updated.floorEndDate = d.toISOString().split('T')[0];
          } else {
            updated.floorEndDate = '';
          }
        }
        if (!isValidPlanType(updated, updated.startDate, newEnd, updated.planType)) {
          updated.planType = '';
        }
        next[index] = updated;
        return next;
      }
    });
  };

  // 4. Plan Type Change - Exp detailed-view.js lines 784-818
  const handlePlanTypeChange = (index: number, newPlan: string) => {
    const currentItem = planItems[index];

    if (!isValidPlanType(currentItem, currentItem.startDate, currentItem.endDate, newPlan)) {
      setPlanItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], planType: '' };
        return next;
      });
      return;
    }

    setPlanItems((prev) => {
      const next = [...prev];
      if (index === 0) {
        return next.map((it, idx) => {
          if (idx === 0) {
            return { ...it, planType: newPlan };
          }
          if (!newPlan) {
            return { ...it, planType: '' };
          }
          if (isValidPlanType(it, it.startDate, it.endDate, newPlan)) {
            return { ...it, planType: newPlan };
          } else {
            return { ...it, planType: '' };
          }
        });
      } else {
        next[index] = { ...next[index], planType: newPlan };
        return next;
      }
    });
  };

  // 5. Unit / Process Cascading (Dyeing / Finishing) - Exp detailed-view.js lines 603-631
  const handleUnitProcessChange = (index: number, field: 'unit' | 'processName', value: string) => {
    setPlanItems((prev) => {
      const next = [...prev];
      if (index === 0) {
        return next.map((it) => ({ ...it, [field]: value }));
      } else {
        next[index] = { ...next[index], [field]: value };
        return next;
      }
    });
  };

  // 6. Floor Planning Cascading (Delivery & YD) - Exp detailed-view.js lines 820-857
  const handleFloorChange = (index: number, field: 'floorStartDate' | 'floorEndDate' | 'floorPlanType', value: string) => {
    setPlanItems((prev) => {
      const next = [...prev];
      if (index === 0) {
        return next.map((it) => ({ ...it, [field]: value }));
      } else {
        next[index] = { ...next[index], [field]: value };
        return next;
      }
    });
  };

  // 7. YD Yarn Ok Date & Matching Option Date Cascading
  const handleYarnOkDateChange = (index: number, val: string) => {
    setPlanItems((prev) => {
      const next = [...prev];
      if (index === 0) {
        return next.map((it) => ({ ...it, yarnOkDate: val }));
      } else {
        next[index] = { ...next[index], yarnOkDate: val };
        return next;
      }
    });
  };

  const handleMatchingOptionDateChange = (index: number, val: string) => {
    setPlanItems((prev) => {
      const next = [...prev];
      if (index === 0) {
        return next.map((it) => ({ ...it, matchingOptionDate: val }));
      } else {
        next[index] = { ...next[index], matchingOptionDate: val };
        return next;
      }
    });
  };

  // 8. Custom Qty change for YD (Barrier Qty, Workable Qty)
  const handleCustomQtyChange = (index: number, field: 'barrierQty' | 'workableQty', val: string) => {
    setPlanItems((prev) => {
      const next = [...prev];
      const itemDataKey = field === 'barrierQty' ? 'Barrier Qty.' : 'Workable Qty.';
      const updatedItemData = { ...(next[index].itemData || {}), [itemDataKey]: val };
      next[index] = { ...next[index], [field]: val, itemData: updatedItemData };
      return next;
    });
  };

  // Generic limitation / remarks update
  const handleTextChange = (index: number, field: 'limitation' | 'remarks', value: string) => {
    setPlanItems((prev) => {
      const next = [...prev];
      if (index === 0) {
        return next.map((it) => ({ ...it, [field]: value }));
      } else {
        next[index] = { ...next[index], [field]: value };
        return next;
      }
    });
  };

  // ==========================================================
  // COMPREHENSIVE SAVE PLANNING VALIDATION (Exp save-planning.js)
  // ==========================================================
  const handleSavePlanning = async () => {
    if (planItems.length === 0) {
      showToast('No fabric items to save! Please upload department data first.');
      return;
    }

    let validationFailed = false;

    // Check downstream department confirmation lock (save-planning.js lines 23-35)
    const checkDownstreamConfirm = (itemId: string) => {
      if (!planData) return false;
      if (dept === 'dyeing' && planData.delivery) {
        const del = planData.delivery.find((d: Loose) => d.itemId === itemId);
        return del && del.planType === 'Confirm';
      }
      if (dept === 'knitting' && planData.dyeing) {
        const dye = planData.dyeing.find((d: Loose) => d.itemId === itemId);
        return dye && dye.planType === 'Confirm';
      }
      return false;
    };

    const savedMap = new Map();
    ((planData && planData[dept]) || []).forEach((it: Loose) => {
      if (it.itemId) savedMap.set(it.itemId, it);
    });

    for (const item of planItems) {
      const itemId = item.itemId;
      const existing = savedMap.get(itemId);
      const wasConfirmed = existing && existing.planType === 'Confirm';

      // 1. Only admin can revert or modify a Confirmed plan
      if (wasConfirmed && !isAdmin && item.planType !== 'Confirm') {
        showToast('Save failed: Only Admin can change a Confirmed plan!');
        validationFailed = true;
        break;
      }

      // 2. Downstream confirmation lock for non-admin
      if (!isAdmin && checkDownstreamConfirm(itemId)) {
        const wasStart = existing ? existing.startDate : '';
        const wasEnd = existing ? existing.endDate : '';
        const wasType = existing ? existing.planType : '';

        if (item.startDate !== wasStart || item.endDate !== wasEnd || item.planType !== wasType) {
          showToast(`Save failed: Cannot change ${dept} because the next department is already Confirmed!`);
          validationFailed = true;
          break;
        }
      }

      // 3. Start > End date
      if (item.startDate && item.endDate && new Date(item.startDate) > new Date(item.endDate)) {
        showToast('Save failed: End date cant be less than start date.');
        validationFailed = true;
        break;
      }

      // 4. Floor start > Floor end
      if (item.floorStartDate && item.floorEndDate && new Date(item.floorStartDate) > new Date(item.floorEndDate)) {
        showToast('Save failed: End date cant be less than start date.');
        validationFailed = true;
        break;
      }

      // 5. Plan type selected without start or end date
      if ((item.planType === 'Confirm' || item.planType === 'Tentative') && (!item.startDate || !item.endDate)) {
        showToast('Save failed: Plan Type selected without Start and End dates.');
        validationFailed = true;
        break;
      }

      // 6. Knitting specific checks
      if (dept === 'knitting') {
        if (item.planType === 'Confirm' && (!item.yarnDate || item.yarnDate === '-' || item.yarnDate === 'N/A')) {
          showToast("Save failed: Without Yarn Date input, Knitting Plan Type cannot be 'Confirm'!");
          validationFailed = true;
          break;
        }
        if (item.startDate && item.yarnDate && item.yarnDate !== '-' && item.yarnDate !== 'N/A') {
          if (new Date(item.startDate).setHours(0, 0, 0, 0) < new Date(item.yarnDate).setHours(0, 0, 0, 0)) {
            showToast('Save failed: Knitting Planning Start Date cannot be less than Yarn Date!');
            validationFailed = true;
            break;
          }
        }
      }

      // 7. Dyeing specific checks
      if (dept === 'dyeing') {
        const { knitItem } = getUpstreamPlans(item);
        const knitType = knitItem?.planType;
        const knitStart = knitItem?.startDate || knitItem?.planStart;
        const knitEnd = knitItem?.endDate || knitItem?.planEnd;

        const hasDyePlanInput = Boolean(item.startDate || item.endDate || (item.planType && item.planType !== 'Select'));

        if (hasDyePlanInput && (!knitType || knitType === 'Select' || knitType === '-' || knitType === '')) {
          showToast('Save failed: Knitting Plan type selection is mandatory before inputting Dyeing plan!');
          validationFailed = true;
          break;
        }

        if (item.startDate && knitStart && knitStart !== '-' && new Date(item.startDate).setHours(0, 0, 0, 0) < new Date(knitStart).setHours(0, 0, 0, 0)) {
          showToast('Save failed: Dyeing Start Date cannot be before Knitting Start Date!');
          validationFailed = true;
          break;
        }

        if (item.endDate && knitEnd && knitEnd !== '-' && new Date(item.endDate).setHours(0, 0, 0, 0) < new Date(knitEnd).setHours(0, 0, 0, 0)) {
          showToast('Save failed: Dyeing End Date cannot be before Knitting End Date!');
          validationFailed = true;
          break;
        }
      }

      // 8. Delivery specific checks
      if (dept === 'delivery') {
        const { dyeItem } = getUpstreamPlans(item);
        const dyeType = dyeItem?.planType;
        const dyeStart = dyeItem?.startDate || dyeItem?.planStart;
        const dyeEnd = dyeItem?.endDate || dyeItem?.planEnd;

        const hasDeliPlanInput = Boolean(
          item.startDate || item.endDate || (item.planType && item.planType !== 'Select') || item.floorStartDate || item.floorEndDate
        );

        if (hasDeliPlanInput && (!dyeType || dyeType === 'Select' || dyeType === '-' || dyeType === '')) {
          showToast('Save failed: Dyeing Plan type selection is mandatory before inputting Delivery plan!');
          validationFailed = true;
          break;
        }

        const isDyeingBlank = !dyeStart || dyeStart === '-' || dyeStart === '';
        if (hasDeliPlanInput && isDyeingBlank) {
          showToast('Save failed: Cannot input Delivery. Dyeing plan is missing!');
          validationFailed = true;
          break;
        }

        if (item.startDate && dyeStart && dyeStart !== '-' && new Date(item.startDate).setHours(0, 0, 0, 0) < new Date(dyeStart).setHours(0, 0, 0, 0)) {
          showToast('Save failed: Delivery Start Date cannot be before Dyeing Start Date!');
          validationFailed = true;
          break;
        }

        if (item.endDate && dyeEnd && dyeEnd !== '-' && new Date(item.endDate).setHours(0, 0, 0, 0) < new Date(dyeEnd).setHours(0, 0, 0, 0)) {
          showToast('Save failed: Delivery End Date cannot be before Dyeing End Date!');
          validationFailed = true;
          break;
        }
      }
    }

    if (validationFailed) return;

    // Confirm when marking order as Completed (save-planning.js line 171)
    const prevStatus = planData?.[`${dept}Status`] || 'On Process';
    const finalStatus = orderStatus;
    if (finalStatus === 'Completed' && prevStatus !== 'Completed') {
      if (!confirm(`Are you sure you want to mark order '${orderNo}' as Completed? It will be moved to the Completed List.`)) {
        setOrderStatus(prevStatus);
        return;
      }
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');

      // Format payload accurately for server persistence
      const formattedItems = planItems.map((item) => {
        const itemData = { ...(item.itemData || {}) };
        if (dept === 'yd') {
          if (item.barrierQty !== undefined) itemData['Barrier Qty.'] = item.barrierQty;
          if (item.workableQty !== undefined) itemData['Workable Qty.'] = item.workableQty;
        }
        if (dept === 'dyeing' || dept === 'finishing') {
          if (item.unit) itemData.Unit = item.unit;
          if (item.processName) {
            itemData.ProcessName = item.processName;
            itemData['Process Name'] = item.processName;
          }
        }
        return {
          itemId: item.itemId,
          itemData,
          planType: item.planType || '',
          startDate: item.startDate || '',
          endDate: item.endDate || '',
          limitation: item.limitation || '',
          remarks: item.remarks || '',
          floorStartDate: item.floorStartDate || '',
          floorEndDate: item.floorEndDate || '',
          floorPlanType: item.floorPlanType || '',
          yarnDate: item.yarnDate || '',
          yarnOkDate: item.yarnOkDate || '',
          matchingOptionDate: item.matchingOptionDate || '',
          unit: item.unit || '',
          processName: item.processName || '',
          barrierQty: item.barrierQty !== undefined ? item.barrierQty : itemData['Barrier Qty.'],
          workableQty: item.workableQty !== undefined ? item.workableQty : itemData['Workable Qty.'],
        };
      });

      const res = await fetch(`${API_BASE}/api/orders/save-dates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderNo,
          department: dept,
          fabricItems: formattedItems,
          orderStatus: finalStatus,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to save planning schedule.');
      }

      invalidateOrderDetailCache(orderNo);
      // Batch Plan reads the saved units and plan dates: reload it the next time it is shown.
      markBatchDataStale();
      showToast(`Planning schedule successfully saved for Order #${orderNo}!`, 'success');
      fetchOrderAndDropdowns(true);
    } catch (err: Loose) {
      showToast(err.message || 'Error saving planning schedule.');
    } finally {
      setSaving(false);
    }
  };

  if (notFound && !loading) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto">
        <AlertCircle className="h-12 w-12 text-error mx-auto mb-3" />
        <h2 className="text-xl font-bold">Order Not Found</h2>
        <p className="text-xs text-base-content/60 mt-1 mb-4">
          The requested Order #{orderNo} was not found in the {deptMeta.name} registry.
        </p>
        <Link href={`/planning/${dept}`} className="btn btn-primary btn-sm">
          <ArrowLeft className="h-4 w-4 mr-1" /> Return to Planning
        </Link>
      </div>
    );
  }

  // Calculate order quantity fallback
  const totalItemQty = planItems.reduce((acc, it) => {
    const q = Number(it.itemData?.RequiredQtyKgs || it.RequiredQtyKgs || it.requiredQtyKgs || it['Req Qty'] || it.Qty || 0);
    return acc + (isNaN(q) ? 0 : q);
  }, 0);
  const displayQty = order.requiredQtyKgs || (totalItemQty > 0 ? totalItemQty : '—');

  return (
    <div className="space-y-4 pb-20 max-w-[1850px] mx-auto animate-fade-in text-[11px]">
      {/* Toast alert notification matching Exp */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div
            className={`alert ${
              toast.type === 'success' ? 'alert-success' : 'alert-error'
            } shadow-lg text-xs font-bold py-2.5 px-4 rounded border`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Top Header Bar matching Exp index.html lines 1381-1398 */}
      <div className="bg-gray-100 dark:bg-[#1f2637] border-b border-gray-200 dark:border-[#2a3346] flex flex-col sm:flex-row items-start sm:items-center px-4 py-2 shrink-0 justify-between w-full gap-2 rounded-sm shadow-sm">
        <div className="flex items-center w-full sm:w-auto">
          <button
            type="button"
            onClick={handleBack}
            className="text-gray-500 dark:text-gray-400 hover:text-blue-600 transition p-1 mr-2 cursor-pointer"
            title="Go Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm flex items-center">
            <span>Order Planning:</span>
            <span className="text-emerald-700 dark:text-emerald-400 ml-1 font-mono">{orderNo}</span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
              {deptMeta.name}
            </span>
          </h3>
        </div>

        <div className="flex gap-2 w-full sm:w-auto justify-end items-center">
          <button
            type="button"
            onClick={handleBack}
            className="px-3 md:px-4 py-1.5 border border-gray-300 dark:border-[#2a3346] text-xs font-bold rounded hover:bg-gray-200 dark:hover:bg-[#283347] text-gray-700 dark:text-gray-300 transition cursor-pointer"
          >
            Back
          </button>

          <button
            onClick={handleSavePlanning}
            disabled={saving}
            className="px-4 md:px-6 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? (
              <InlineSpinner size={14} />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save Planning
          </button>
        </div>
      </div>

      {/* ==========================================================
          GENERAL INFORMATION & PLANNING CARD
          Exact Replica of Exp index.html lines 1403-1478 & detailed-view.js lines 193-219
         ========================================================== */}
      <div className="bg-white dark:bg-[#151921] border border-gray-200 dark:border-[#2a3346] p-3 md:p-4 rounded-sm shadow-sm shrink-0 w-full max-w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-2.5">
          {/* Column 1 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                EWO No.
              </span>
              <input
                type="text"
                readOnly
                value={order.orderNo || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none font-mono"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Booking No.
              </span>
              <input
                type="text"
                readOnly
                value={order.orderNo || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none font-mono"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Booking Date
              </span>
              <input
                type="text"
                readOnly
                value={formatExcelDate(order.bookingDate)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Gmt Unit
              </span>
              <input
                type="text"
                readOnly
                value={order.gmtUnit || order.bookingUnit || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none font-semibold"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Floor
              </span>
              <input
                type="text"
                readOnly
                value={order.floor || order.unit || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Final Conf.
              </span>
              <input
                type="text"
                readOnly
                value={order.finalConfirmation || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none font-semibold"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                BP Status
              </span>
              <input
                type="text"
                readOnly
                value={formatExcelDate(order.bpStatus)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                PMC
              </span>
              <input
                type="text"
                readOnly
                value={order.pmc || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Order Status
              </span>
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-white dark:bg-[#151921] text-[11px] font-bold text-gray-800 dark:text-gray-100 outline-none cursor-pointer focus:border-emerald-500"
              >
                <option value="On Process">On Process</option>
                <option value="Pending">Pending</option>
                <option value="Tentative">Tentative</option>
                <option value="Confirm">Confirm</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Column 2 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Buyer
              </span>
              <input
                type="text"
                readOnly
                value={order.buyer || 'N/A'}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] font-bold text-emerald-700 dark:text-emerald-400 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Buyer Team
              </span>
              <input
                type="text"
                readOnly
                value={order.buyerTeam || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Booked By
              </span>
              <input
                type="text"
                readOnly
                value={order.bookedBy || order.bookingBy || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Style
              </span>
              <input
                type="text"
                readOnly
                value={order.style || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Order Qty (Kg)
              </span>
              <input
                type="text"
                readOnly
                value={displayQty}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] font-mono font-bold text-gray-800 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Event Day
              </span>
              <input
                type="text"
                readOnly
                value={order.eventDay || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                1st Ship Date
              </span>
              <input
                type="text"
                readOnly
                value={formatExcelDate(order.ship1)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Last Ship Date
              </span>
              <input
                type="text"
                readOnly
                value={formatExcelDate(order.shipLast)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Yarn Date
              </span>
              <input
                type="text"
                readOnly
                value={formatExcelDate(order.yarnDate)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>
          </div>

          {/* Column 3: Dates & Fabric Notes */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Deli. Start Date
              </span>
              <input
                type="text"
                readOnly
                value={formatExcelDate(order.deliStart)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Deli. End Date
              </span>
              <input
                type="text"
                readOnly
                value={formatExcelDate(order.deliEnd)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Knit Start Date
              </span>
              <input
                type="text"
                readOnly
                value={formatExcelDate(order.knitStart)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Knit End Date
              </span>
              <input
                type="text"
                readOnly
                value={formatExcelDate(order.knitEnd)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Dye Start Date
              </span>
              <input
                type="text"
                readOnly
                value={formatExcelDate(order.dyeStart)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Dye End Date
              </span>
              <input
                type="text"
                readOnly
                value={formatExcelDate(order.dyeEnd)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="p-1 bg-gray-100 dark:bg-[#1f2637] text-center font-bold text-xs mt-1 border border-gray-200 dark:border-[#2a3346] text-gray-700 dark:text-gray-300">
              Fabric Notes
            </div>
            <textarea
              readOnly
              value={order.fabricNotes || ''}
              className="w-full h-11 p-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[10px] text-gray-700 dark:text-gray-200 outline-none resize-none"
            />
          </div>
        </div>
      </div>

      {/* ==========================================================
          DEPARTMENT FABRIC ITEMS TABLE (EXACT EXP 2-TIER DESIGN)
         ========================================================== */}
      <div className="bg-white dark:bg-[#151921] border border-gray-200 dark:border-[#2a3346] rounded-sm shadow-sm overflow-hidden flex flex-col">
        <div className="bg-gray-100 dark:bg-[#1f2637] p-2 font-bold text-gray-800 dark:text-gray-200 text-xs flex items-center justify-between border-b border-gray-200 dark:border-[#2a3346]">
          <div className="flex items-center">
            <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mr-2" />
            <span>Department Fabric Items</span>
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 text-[10px] font-bold">
              {planItems.length}
            </span>
          </div>
          <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400 italic">
            Row 1 changes auto-fill all items below
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar w-full bg-white dark:bg-[#151921]">
          <table className="w-full text-left whitespace-nowrap border-collapse min-w-[1600px]">
            <thead className="bg-white dark:bg-[#151921] shadow-sm select-none">
              {/* Main Top Header Row */}
              <tr className="text-[10px] font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-[#1f2637] border-b border-gray-300 dark:border-[#2a3346]">
                {/* 1. KNITTING HEADERS */}
                {dept === 'knitting' && (
                  <>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Color
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
                      FabricConstruction
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[60px]">
                      GSM
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[90px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-200 font-bold">
                      Yarn Date
                    </th>
                    <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                      Knitting Planning
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                      Plan Type
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[120px]">
                      Knitting Limitation
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[120px]">
                      Remarks
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Grey Req.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Knit Prod.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px] text-orange-600 font-bold">
                      Knit. Bala.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Yarn req.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Allocated Qty
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Yarn bala.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Allowance %
                    </th>
                  </>
                )}

                {/* 2. DYEING HEADERS */}
                {dept === 'dyeing' && (
                  <>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Color
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
                      Unit
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[110px]">
                      Process Name
                    </th>
                    <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                      Knitting Planning
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                      Knitting Plan Type
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
                      Knitting Limitation
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
                      Remarks (Knitting)
                    </th>
                    <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                      Dyeing Planning
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                      Plan Type
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[120px]">
                      Dyeing Limitation
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[120px]">
                      Remarks
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      BP Qty
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Dyeing Prod.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px] text-orange-600 font-bold">
                      Dyeing Bala.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Knit Prod.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Knit. Bala.
                    </th>
                  </>
                )}

                {/* 3. YD (YARN DYEING) HEADERS (Exact Exp Parity) */}
                {dept === 'yd' && (
                  <>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                      Booking Type
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      YDB
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[95px]">
                      YD Booking Date
                    </th>
                    <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                      YD Planning
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Plan Type
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[100px]">
                      YD Remarks
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[100px]">
                      Remarks
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                      Yarn Ok<br />Date
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[95px]">
                      Matching<br />Option Date
                    </th>
                    <th colSpan={3} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                      YD Planning (Floor)
                    </th>
                    <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-100 dark:bg-[#20293a]">
                      T&A YD Plan
                    </th>
                    <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-100 dark:bg-[#20293a]">
                      Knit Plan
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Barrier Qty.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Workable Qty.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      YD REQ.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      DYED
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      YD BALANCE
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      YD Delivered
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[85px] text-red-600 font-bold">
                      YD DELIVERY BALANCE
                    </th>
                  </>
                )}

                {/* 4. DELIVERY HEADERS */}
                {dept === 'delivery' && (
                  <>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Color
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
                      FabricConstruction
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[60px]">
                      GSM
                    </th>
                    <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                      Delivery Planning (Floor)
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                      Plan Type (Floor)
                    </th>
                    <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                      Delivery Planning
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                      Plan Type
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[120px]">
                      Delivery Limitation
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[120px]">
                      Remarks
                    </th>
                    <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                      Dyeing Planning
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                      Dyeing Plan Type
                    </th>
                    <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                      Knitting Planning
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      RequiredQtyKgs
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      NetReceivedQtyKgs
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      NetDeliveryQtyKgs
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px] text-orange-600 font-bold">
                      Deli. Bal.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      RFD
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Slowmoving
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      FF Stock
                    </th>
                  </>
                )}

                {/* 5. FINISHING & DEFAULT HEADERS */}
                {dept !== 'knitting' && dept !== 'dyeing' && dept !== 'yd' && dept !== 'delivery' && (
                  <>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                      OrderNo
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Color
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      RequiredQtyKgs
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Buyer
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                      Unit
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
                      Process Name
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Grey Req.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Knit Prod.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Knit. Bala.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      BP Qty
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Dyeing Prod.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Dyeing Bala.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      NetReceivedQtyKgs
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      NetDeliveryQtyKgs
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      RFD
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Slowmoving
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      FF Stock
                    </th>
                    <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                      Finishing Planning
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                      Plan Type
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[120px]">
                      Finishing Limitation
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[120px]">
                      Remarks
                    </th>
                  </>
                )}
              </tr>

              {/* Sub-Header Row with Start Date / End Date labels */}
              <tr className="text-[9px] bg-gray-50 dark:bg-[#181f2c] border-b border-gray-300 dark:border-[#2a3346]">
                {dept === 'knitting' && (
                  <>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      Start Date
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      End Date
                    </th>
                  </>
                )}

                {dept === 'dyeing' && (
                  <>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      Start Date
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      End Date
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      Start Date
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      End Date
                    </th>
                  </>
                )}

                {dept === 'yd' && (
                  <>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      Start Date
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      End Date
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      YD Start
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      YD End
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      Plan Type
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      YD T&A<br />Start
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      YD T&A<br />End
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      Knit Start
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      Knit End
                    </th>
                  </>
                )}

                {dept === 'delivery' && (
                  <>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      Start Date
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      End Date
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      Start Date
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      End Date
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      Start Date
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      End Date
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      Start Date
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      End Date
                    </th>
                  </>
                )}

                {dept !== 'knitting' && dept !== 'dyeing' && dept !== 'yd' && dept !== 'delivery' && (
                  <>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      Start Date
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      End Date
                    </th>
                  </>
                )}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="text-[10px] bg-white dark:bg-[#151921] text-gray-700 dark:text-gray-300 divide-y divide-gray-200 dark:divide-[#2a3346]">
              {loading && planItems.length === 0 ? (
                <tr>
                  <td colSpan={30} className="p-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <InlineSpinner size={22} className="text-emerald-500" />
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                        Loading {deptMeta.name} items & milestones...
                      </span>
                      <span className="text-[11px] text-gray-400">
                        Synchronizing order plan details from database
                      </span>
                    </div>
                  </td>
                </tr>
              ) : planItems.length === 0 ? (
                <tr>
                  <td colSpan={30} className="p-10 text-center text-gray-400 text-xs">
                    No {deptMeta.name} fabric items found for Order #{orderNo}.
                  </td>
                </tr>
              ) : (
                planItems.map((item, idx) => {
                const { knitItem, dyeItem, isKnitTypeSelected, isDyeTypeSelected } = getUpstreamPlans(item);

                // Gating checks matching Exp detailed-view.js:
                const isUnitProcessReady =
                  dept !== 'dyeing' ||
                  (Boolean(item.unit) && item.unit !== 'Select' && Boolean(item.processName) && item.processName !== 'Select');

                // Old HEAD: Dyeing / Delivery stay editable for Admin/Approver, or when this row already has a saved plan,
                // even if the upstream (Knitting / Dyeing) plan type is blank.
                const isDyeAllowed = isAdmin || isKnitTypeSelected || Boolean(item.hasExistingPlan);
                const isDeliveryAllowed = isAdmin || isDyeTypeSelected || Boolean(item.hasExistingPlan);
                const isDyeKnitLocked = dept === 'dyeing' && !isDyeAllowed;
                const isDeliDyeLocked = dept === 'delivery' && !isDeliveryAllowed;
                // Old detailed-view.js: Delivery Start / End / Plan Type stay locked while the Dyeing start date is blank.
                const deliDyeStart = String(dyeItem?.startDate || dyeItem?.planStart || '').trim();
                const isDeliDyeStartMissing = dept === 'delivery' && (!deliDyeStart || deliDyeStart === '-');
                const isSavedConfirmed = item.planType === 'Confirm';
                const isNonAdminLocked = isSavedConfirmed && !isAdmin;

                const isDyeInputsDisabled = !isUnitProcessReady || isDyeKnitLocked || isNonAdminLocked;
                const isDeliInputsDisabled = isDeliDyeLocked || isNonAdminLocked || isDeliDyeStartMissing;
                // Delivery floor inputs only follow the Dyeing-plan gate (old app never locked them for Confirm).
                const isDeliFloorDisabled = isDeliDyeLocked;
                const isInputsDisabled =
                  dept === 'dyeing'
                    ? isDyeInputsDisabled
                    : dept === 'delivery'
                    ? isDeliInputsDisabled
                    : isNonAdminLocked;

                const inputDisabledClass = isInputsDisabled
                  ? 'bg-gray-100 dark:bg-gray-800/60 opacity-60 cursor-not-allowed text-gray-400'
                  : 'bg-white dark:bg-[#151921]';
                const floorDisabledClass = isDeliFloorDisabled
                  ? 'bg-gray-100 dark:bg-gray-800/60 opacity-60 cursor-not-allowed text-gray-400'
                  : 'bg-blue-50/70 dark:bg-blue-950/20';

                const disabledTitle =
                  dept === 'dyeing' && isDyeKnitLocked
                    ? 'Knitting Plan type selection is mandatory to input Dyeing plan'
                    : dept === 'dyeing' && !isUnitProcessReady
                    ? 'Unit & Process Name must be selected before planning'
                    : dept === 'delivery' && isDeliDyeLocked
                    ? 'Dyeing Plan type selection is mandatory to input Delivery plan'
                    : isNonAdminLocked
                    ? 'Only Admin can modify Confirmed plan'
                    : dept === 'delivery' && isDeliDyeStartMissing
                    ? 'Dyeing plan is missing for this item'
                    : undefined;
                const floorDisabledTitle = isDeliFloorDisabled
                  ? 'Dyeing Plan type selection is mandatory to input Delivery plan'
                  : undefined;

                return (
                  <tr
                    key={item.itemId || idx}
                    className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 border-b border-gray-200 dark:border-[#2a3346] transition-colors"
                  >
                    {/* ==========================================================
                        1. KNITTING ROWS
                       ========================================================== */}
                    {dept === 'knitting' && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-bold text-gray-800 dark:text-gray-100">
                          {item.itemData?.Color || item.Color || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[100px]">
                          {item.itemData?.FabricConstruction || item.FabricConstruction || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[60px] font-mono">
                          {item.itemData?.GSM || item.GSM || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-yellow-50 dark:bg-yellow-900/10">
                          <input
                            type="date"
                            value={item.yarnDate || ''}
                            onChange={(e) => handleYarnDateChange(idx, e.target.value)}
                            title={idx === 0 ? '⚡ Changing Row 1 Yarn Date auto-fills all items' : undefined}
                            className="row-yarn-date p-1 border border-yellow-300 dark:border-yellow-700/50 rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-yellow-50/70 dark:bg-[#151921] text-yellow-950 dark:text-yellow-100 font-semibold"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <input
                            type="date"
                            value={item.startDate || ''}
                            min={item.yarnDate || undefined}
                            disabled={isInputsDisabled}
                            title={disabledTitle}
                            onChange={(e) => handleStartDateChange(idx, e.target.value)}
                            className={`row-start-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none ${inputDisabledClass}`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <input
                            type="date"
                            value={item.endDate || ''}
                            min={item.startDate || item.yarnDate || undefined}
                            disabled={isInputsDisabled}
                            title={disabledTitle}
                            onChange={(e) => handleEndDateChange(idx, e.target.value)}
                            className={`row-end-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none ${inputDisabledClass}`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <select
                            value={item.planType || ''}
                            disabled={isInputsDisabled}
                            title={disabledTitle}
                            onChange={(e) => handlePlanTypeChange(idx, e.target.value)}
                            className={`row-plan-type p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none cursor-pointer font-bold ${inputDisabledClass}`}
                          >
                            <option value="">Select</option>
                            <option value="Confirm">Confirm</option>
                            <option value="Tentative">Tentative</option>
                          </select>
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
                          <textarea
                            rows={1}
                            value={item.limitation || ''}
                            onChange={(e) => handleTextChange(idx, 'limitation', e.target.value)}
                            placeholder="Limitation"
                            className={`row-limitation ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
                          <textarea
                            rows={1}
                            value={item.remarks || ''}
                            onChange={(e) => handleTextChange(idx, 'remarks', e.target.value)}
                            placeholder="Notes"
                            className={`row-remarks ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.GreyReq ?? item.GreyReq ?? '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.KnitProd ?? item.KnitProd ?? 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono text-orange-600 font-bold">
                          {item.itemData?.KnitBala ?? item.KnitBala ?? '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.YarnReq ?? item.YarnReq ?? '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.AllocatedQty ?? item.AllocatedQty ?? '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.YarnBala ?? item.YarnBala ?? '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.Allowance ?? item.Allowance ?? '—'}
                        </td>
                      </>
                    )}

                    {/* ==========================================================
                        2. DYEING ROWS
                       ========================================================== */}
                    {dept === 'dyeing' && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-bold text-gray-800 dark:text-gray-100">
                          {item.itemData?.Color || item.Color || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
                          <select
                            value={item.unit || ''}
                            onChange={(e) => handleUnitProcessChange(idx, 'unit', e.target.value)}
                            className="row-unit p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-full focus:border-blue-500 outline-none cursor-pointer bg-white dark:bg-[#151921]"
                          >
                            <option value="">Select</option>
                            {withCurrentOption(unitOptions, item.unit).map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[110px]">
                          <select
                            value={item.processName || ''}
                            onChange={(e) => handleUnitProcessChange(idx, 'processName', e.target.value)}
                            className="row-process p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-full focus:border-blue-500 outline-none cursor-pointer bg-white dark:bg-[#151921]"
                          >
                            <option value="">Select</option>
                            {withCurrentOption(processOptions, item.processName).map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatDateDisplay(knitItem?.startDate || knitItem?.planStart)}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatDateDisplay(knitItem?.endDate || knitItem?.planEnd)}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px] font-semibold">
                          {knitItem?.planType || '-'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[100px]">
                          {knitItem?.limitation || ''}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[100px]">
                          {knitItem?.remarks || ''}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <input
                            type="date"
                            value={item.startDate || ''}
                            disabled={isDyeInputsDisabled}
                            title={disabledTitle}
                            onChange={(e) => handleStartDateChange(idx, e.target.value)}
                            className={`row-start-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none ${inputDisabledClass}`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <input
                            type="date"
                            value={item.endDate || ''}
                            min={item.startDate || undefined}
                            disabled={isDyeInputsDisabled}
                            title={disabledTitle}
                            onChange={(e) => handleEndDateChange(idx, e.target.value)}
                            className={`row-end-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none ${inputDisabledClass}`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <select
                            value={item.planType || ''}
                            disabled={isDyeInputsDisabled}
                            title={disabledTitle}
                            onChange={(e) => handlePlanTypeChange(idx, e.target.value)}
                            className={`row-plan-type p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none cursor-pointer font-bold ${inputDisabledClass}`}
                          >
                            <option value="">Select</option>
                            <option value="Confirm">Confirm</option>
                            <option value="Tentative">Tentative</option>
                          </select>
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
                          <textarea
                            rows={1}
                            value={item.limitation || ''}
                            disabled={!isUnitProcessReady}
                            onChange={(e) => handleTextChange(idx, 'limitation', e.target.value)}
                            placeholder="Limitation"
                            className={`row-limitation ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none ${
                              !isUnitProcessReady ? 'bg-gray-100 opacity-60 cursor-not-allowed' : 'bg-white'
                            }`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
                          <textarea
                            rows={1}
                            value={item.remarks || ''}
                            disabled={!isUnitProcessReady}
                            onChange={(e) => handleTextChange(idx, 'remarks', e.target.value)}
                            placeholder="Notes"
                            className={`row-remarks ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none ${
                              !isUnitProcessReady ? 'bg-gray-100 opacity-60 cursor-not-allowed' : 'bg-white'
                            }`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.BPQty ?? item.BPQty ?? '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.DyeingProd ?? item.DyeingProd ?? 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono text-orange-600 font-bold">
                          {item.itemData?.DyeingBala ?? item.DyeingBala ?? '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.KnitProd ?? item.KnitProd ?? 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.KnitBala ?? item.KnitBala ?? '—'}
                        </td>
                      </>
                    )}

                    {/* ==========================================================
                        3. YD (YARN DYEING) ROWS (Exact Exp Parity)
                       ========================================================== */}
                    {dept === 'yd' && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px] font-semibold">
                          {item.itemData?.['Booking Type'] || item['Booking Type'] || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px] font-mono">
                          {item.itemData?.YDB || item.YDB || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[95px]">
                          {formatExcelDate(item.itemData?.['YD Booking Date'] || item['YD Booking Date'])}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <input
                            type="date"
                            value={item.startDate || ''}
                            onChange={(e) => handleStartDateChange(idx, e.target.value)}
                            className="row-start-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <input
                            type="date"
                            value={item.endDate || ''}
                            min={item.startDate || undefined}
                            onChange={(e) => handleEndDateChange(idx, e.target.value)}
                            className="row-end-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <select
                            value={item.planType || ''}
                            onChange={(e) => handlePlanTypeChange(idx, e.target.value)}
                            className="row-plan-type p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none cursor-pointer bg-white dark:bg-[#151921]"
                          >
                            <option value="">Select</option>
                            <option value="Confirm">Confirm</option>
                            <option value="Tentative">Tentative</option>
                          </select>
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[100px]">
                          <textarea
                            rows={1}
                            placeholder="Limitation"
                            value={item.limitation || ''}
                            onChange={(e) => handleTextChange(idx, 'limitation', e.target.value)}
                            className={`row-limitation ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[100px]">
                          <textarea
                            rows={1}
                            placeholder="Remarks"
                            value={item.remarks || ''}
                            onChange={(e) => handleTextChange(idx, 'remarks', e.target.value)}
                            className={`row-remarks ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                          <input
                            type="date"
                            value={item.yarnOkDate || ''}
                            onChange={(e) => handleYarnOkDateChange(idx, e.target.value)}
                            className="row-yarn-ok-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[95px]">
                          <input
                            type="date"
                            value={item.matchingOptionDate || ''}
                            onChange={(e) => handleMatchingOptionDateChange(idx, e.target.value)}
                            className="row-matching-option-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                          <input
                            type="date"
                            value={item.floorStartDate || ''}
                            onChange={(e) => handleFloorChange(idx, 'floorStartDate', e.target.value)}
                            className="row-floor-start p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                          <input
                            type="date"
                            value={item.floorEndDate || ''}
                            min={item.floorStartDate || undefined}
                            onChange={(e) => handleFloorChange(idx, 'floorEndDate', e.target.value)}
                            className="row-floor-end p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                          <select
                            value={item.floorPlanType || ''}
                            onChange={(e) => handleFloorChange(idx, 'floorPlanType', e.target.value)}
                            className="row-floor-plan p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none cursor-pointer bg-white dark:bg-[#151921]"
                          >
                            <option value="">Select</option>
                            <option value="Confirm">Confirm</option>
                            <option value="Tentative">Tentative</option>
                          </select>
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatExcelDate(item.itemData?.['YD T&A Start'])}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatExcelDate(item.itemData?.['YD T&A End'])}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatExcelDate(ydBKnitPlan.start)}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatExcelDate(ydBKnitPlan.end)}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                          <input
                            type="number"
                            value={item.barrierQty !== undefined && item.barrierQty !== null ? item.barrierQty : ''}
                            onChange={(e) => handleCustomQtyChange(idx, 'barrierQty', e.target.value)}
                            className="row-barrier-qty w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] outline-none text-center bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                          <input
                            type="number"
                            value={item.workableQty !== undefined && item.workableQty !== null ? item.workableQty : ''}
                            onChange={(e) => handleCustomQtyChange(idx, 'workableQty', e.target.value)}
                            className="row-workable-qty w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] outline-none text-center bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.['YD REQ.'] ?? '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.DYED ?? 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.['YD BALANCE'] ?? '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.['YD Delivered'] ?? 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono text-red-600 font-bold">
                          {item.itemData?.['YD DELIVERY BALANCE'] ?? '—'}
                        </td>
                      </>
                    )}

                    {/* ==========================================================
                        4. DELIVERY ROWS
                       ========================================================== */}
                    {dept === 'delivery' && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-bold text-gray-800 dark:text-gray-100">
                          {item.itemData?.Color || item.Color || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[100px]">
                          {item.itemData?.FabricConstruction || item.FabricConstruction || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[60px] font-mono">
                          {item.itemData?.GSM || item.GSM || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-blue-50/40 dark:bg-transparent">
                          <input
                            type="date"
                            value={item.floorStartDate || ''}
                            disabled={isDeliFloorDisabled}
                            title={floorDisabledTitle}
                            onChange={(e) => handleFloorChange(idx, 'floorStartDate', e.target.value)}
                            className={`row-floor-start p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[95px] focus:border-blue-500 outline-none ${floorDisabledClass}`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-blue-50/40 dark:bg-transparent">
                          <input
                            type="date"
                            value={item.floorEndDate || ''}
                            min={item.floorStartDate || undefined}
                            disabled={isDeliFloorDisabled}
                            title={floorDisabledTitle}
                            onChange={(e) => handleFloorChange(idx, 'floorEndDate', e.target.value)}
                            className={`row-floor-end p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[95px] focus:border-blue-500 outline-none ${floorDisabledClass}`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <select
                            value={item.floorPlanType || ''}
                            disabled={isDeliFloorDisabled}
                            title={floorDisabledTitle}
                            onChange={(e) => handleFloorChange(idx, 'floorPlanType', e.target.value)}
                            className={`row-floor-plan p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none cursor-pointer ${isDeliFloorDisabled ? floorDisabledClass : 'bg-white dark:bg-[#151921]'}`}
                          >
                            <option value="">Select</option>
                            <option value="Confirm">Confirm</option>
                            <option value="Tentative">Tentative</option>
                          </select>
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <input
                            type="date"
                            value={item.startDate || ''}
                            disabled={isDeliInputsDisabled}
                            title={disabledTitle}
                            onChange={(e) => handleStartDateChange(idx, e.target.value)}
                            className={`row-start-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none ${inputDisabledClass}`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <input
                            type="date"
                            value={item.endDate || ''}
                            min={item.startDate || undefined}
                            disabled={isDeliInputsDisabled}
                            title={disabledTitle}
                            onChange={(e) => handleEndDateChange(idx, e.target.value)}
                            className={`row-end-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none ${inputDisabledClass}`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <select
                            value={item.planType || ''}
                            disabled={isDeliInputsDisabled}
                            title={disabledTitle}
                            onChange={(e) => handlePlanTypeChange(idx, e.target.value)}
                            className={`row-plan-type p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none cursor-pointer font-bold ${inputDisabledClass}`}
                          >
                            <option value="">Select</option>
                            <option value="Confirm">Confirm</option>
                            <option value="Tentative">Tentative</option>
                          </select>
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
                          <textarea
                            rows={1}
                            value={item.limitation || ''}
                            onChange={(e) => handleTextChange(idx, 'limitation', e.target.value)}
                            placeholder="Limitation"
                            className={`row-limitation ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
                          <textarea
                            rows={1}
                            value={item.remarks || ''}
                            onChange={(e) => handleTextChange(idx, 'remarks', e.target.value)}
                            placeholder="Notes"
                            className={`row-remarks ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatDateDisplay(dyeItem?.startDate || dyeItem?.planStart)}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatDateDisplay(dyeItem?.endDate || dyeItem?.planEnd)}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px] font-semibold">
                          {dyeItem?.planType || '-'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatDateDisplay(knitItem?.startDate || knitItem?.planStart)}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatDateDisplay(knitItem?.endDate || knitItem?.planEnd)}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.RequiredQtyKgs ?? item.RequiredQtyKgs ?? '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.NetReceivedQtyKgs ?? item.NetReceivedQtyKgs ?? 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.NetDeliveryQtyKgs ?? item.NetDeliveryQtyKgs ?? 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono text-orange-600 font-bold">
                          {item.itemData?.DeliBal ?? item.DeliBal ?? '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.RFD ?? item.RFD ?? 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.Slowmoving ?? item.Slowmoving ?? 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.FFStock ?? item.FFStock ?? 0}
                        </td>
                      </>
                    )}

                    {/* ==========================================================
                        5. FINISHING & DEFAULT ROWS
                       ========================================================== */}
                    {dept !== 'knitting' && dept !== 'dyeing' && dept !== 'yd' && dept !== 'delivery' && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px] font-mono">
                          {item.itemData?.OrderNo ?? item.OrderNo ?? orderNo}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-bold text-gray-800 dark:text-gray-100">
                          {item.itemData?.Color || item.Color || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.RequiredQtyKgs ?? item.RequiredQtyKgs ?? '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                          {item.itemData?.Buyer ?? item.Buyer ?? order.buyer ?? '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                          <select
                            value={item.unit || ''}
                            onChange={(e) => handleUnitProcessChange(idx, 'unit', e.target.value)}
                            className="row-unit p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-full focus:border-blue-500 outline-none cursor-pointer bg-white dark:bg-[#151921]"
                          >
                            <option value="">Select</option>
                            {withCurrentOption(unitOptions, item.unit).map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
                          <select
                            value={item.processName || ''}
                            onChange={(e) => handleUnitProcessChange(idx, 'processName', e.target.value)}
                            className="row-process p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-full focus:border-blue-500 outline-none cursor-pointer bg-white dark:bg-[#151921]"
                          >
                            <option value="">Select</option>
                            {withCurrentOption(processOptions, item.processName).map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.GreyReq ?? item.GreyReq ?? '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.KnitProd ?? item.KnitProd ?? 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.KnitBala ?? item.KnitBala ?? '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.BPQty ?? item.BPQty ?? '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.DyeingProd ?? item.DyeingProd ?? 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.DyeingBala ?? item.DyeingBala ?? '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.NetReceivedQtyKgs ?? item.NetReceivedQtyKgs ?? 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.NetDeliveryQtyKgs ?? item.NetDeliveryQtyKgs ?? 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.RFD ?? item.RFD ?? 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.Slowmoving ?? item.Slowmoving ?? 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.itemData?.FFStock ?? item.FFStock ?? 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <input
                            type="date"
                            value={item.startDate || ''}
                            onChange={(e) => handleStartDateChange(idx, e.target.value)}
                            className="row-start-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <input
                            type="date"
                            value={item.endDate || ''}
                            min={item.startDate || undefined}
                            onChange={(e) => handleEndDateChange(idx, e.target.value)}
                            className="row-end-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <select
                            value={item.planType || ''}
                            onChange={(e) => handlePlanTypeChange(idx, e.target.value)}
                            className="row-plan-type p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none cursor-pointer bg-white dark:bg-[#151921]"
                          >
                            <option value="">Select</option>
                            <option value="Confirm">Confirm</option>
                            <option value="Tentative">Tentative</option>
                          </select>
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
                          <textarea
                            rows={1}
                            value={item.limitation || ''}
                            onChange={(e) => handleTextChange(idx, 'limitation', e.target.value)}
                            placeholder="Limitation"
                            className={`row-limitation ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
                          <textarea
                            rows={1}
                            value={item.remarks || ''}
                            onChange={(e) => handleTextChange(idx, 'remarks', e.target.value)}
                            placeholder="Notes"
                            className={`row-remarks ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
                          />
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
          </table>
        </div>

        {/* Footer info & Save trigger */}
        <div className="p-3 bg-gray-50 dark:bg-[#181f2c] border-t border-gray-200 dark:border-[#2a3346] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-gray-500 dark:text-gray-400">
            Total <strong className="text-gray-800 dark:text-gray-200">{planItems.length}</strong> fabric items ready for schedule synchronization.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBack}
              className="btn btn-ghost btn-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePlanning}
              disabled={saving}
              className="btn btn-primary btn-xs font-bold gap-1.5 shadow-sm"
            >
              {saving ? <InlineSpinner size={12} /> : <Save className="h-3 w-3" />}
              Save Planning Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
