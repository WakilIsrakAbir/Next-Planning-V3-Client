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
import {
  buildMergedItems,
  formatDateDisplay,
  formatExcelDate,
  formatPlanPayload,
  readIsAdminRole,
  subscribeToNothing,
  withCurrentOption,
  ydKnitPlan,
  type Loose,
} from '@/features/planning/lib/order-plan-logic';
import { createDeptPlanLogic } from '@/features/planning/lib/dept-plan-logic';

const DEPARTMENTS: Record<string, { name: string; label: string }> = {
  knitting: { name: 'Knitting Plan', label: 'Knitting' },
  dyeing: { name: 'Dyeing Plan', label: 'Dyeing' },
  finishing: { name: 'Finishing Plan', label: 'Finishing' },
  delivery: { name: 'Delivery Plan', label: 'Delivery' },
  yd: { name: 'YD Plan', label: 'YD' },
};

// Port of the old `.resizable-table-input` CSS (index.html): one-row textarea that resizes both ways.
const RESIZABLE_INPUT_CLS =
  'resize min-w-[90px] min-h-[26px] h-[26px] leading-[1.25] align-middle box-border overflow-auto dark:bg-[#151921] dark:border-[#2a3346] dark:text-[#cbd5e1]';

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

  // For YD: Upstream Knit Plan from first knitting item or general order info (detailed-view.js lines 446-458)
  const ydBKnitPlan = useMemo(() => {
    if (dept !== 'yd') return { start: '', end: '' };
    return ydKnitPlan(planData, order);
  }, [dept, planData, order]);

  const logic = createDeptPlanLogic({
    dept,
    orderNo,
    order,
    planData,
    planItems,
    setPlanItems,
    orderStatus,
    setOrderStatus,
    isAdmin,
    showToast,
  });
  const {
    getUpstreamPlans,
    handleYarnDateChange,
    handleStartDateChange,
    handleEndDateChange,
    handlePlanTypeChange,
    handleUnitProcessChange,
    handleFloorChange,
    handleYarnOkDateChange,
    handleMatchingOptionDateChange,
    handleCustomQtyChange,
    handleTextChange,
  } = logic;

  const handleSavePlanning = async () => {
    if (!logic.validateForSave()) return;
    if (!logic.confirmCompletion()) return;
    const finalStatus = orderStatus;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');

      // Format payload accurately for server persistence
      const formattedItems = formatPlanPayload(dept, planItems);

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
            data-action="save"
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
                data-field="orderStatus"
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
          <table data-plan-table={dept} className="w-full text-left whitespace-nowrap border-collapse min-w-[1600px]">
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
                    data-row={idx}
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
                            data-field="yarnDate"
                            type="date"
                            value={item.yarnDate || ''}
                            onChange={(e) => handleYarnDateChange(idx, e.target.value)}
                            title={idx === 0 ? '⚡ Changing Row 1 Yarn Date auto-fills all items' : undefined}
                            className="row-yarn-date p-1 border border-yellow-300 dark:border-yellow-700/50 rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-yellow-50/70 dark:bg-[#151921] text-yellow-950 dark:text-yellow-100 font-semibold"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <input
                            data-field="startDate"
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
                            data-field="endDate"
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
                            data-field="planType"
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
                            data-field="limitation"
                            rows={1}
                            value={item.limitation || ''}
                            onChange={(e) => handleTextChange(idx, 'limitation', e.target.value)}
                            placeholder="Limitation"
                            className={`row-limitation ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
                          <textarea
                            data-field="remarks"
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
                            data-field="unit"
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
                            data-field="processName"
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
                            data-field="startDate"
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
                            data-field="endDate"
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
                            data-field="planType"
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
                            data-field="limitation"
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
                            data-field="remarks"
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
                            data-field="startDate"
                            type="date"
                            value={item.startDate || ''}
                            onChange={(e) => handleStartDateChange(idx, e.target.value)}
                            className="row-start-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <input
                            data-field="endDate"
                            type="date"
                            value={item.endDate || ''}
                            min={item.startDate || undefined}
                            onChange={(e) => handleEndDateChange(idx, e.target.value)}
                            className="row-end-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <select
                            data-field="planType"
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
                            data-field="limitation"
                            rows={1}
                            placeholder="Limitation"
                            value={item.limitation || ''}
                            onChange={(e) => handleTextChange(idx, 'limitation', e.target.value)}
                            className={`row-limitation ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[100px]">
                          <textarea
                            data-field="remarks"
                            rows={1}
                            placeholder="Remarks"
                            value={item.remarks || ''}
                            onChange={(e) => handleTextChange(idx, 'remarks', e.target.value)}
                            className={`row-remarks ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                          <input
                            data-field="yarnOkDate"
                            type="date"
                            value={item.yarnOkDate || ''}
                            onChange={(e) => handleYarnOkDateChange(idx, e.target.value)}
                            className="row-yarn-ok-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[95px]">
                          <input
                            data-field="matchingOptionDate"
                            type="date"
                            value={item.matchingOptionDate || ''}
                            onChange={(e) => handleMatchingOptionDateChange(idx, e.target.value)}
                            className="row-matching-option-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                          <input
                            data-field="floorStartDate"
                            type="date"
                            value={item.floorStartDate || ''}
                            onChange={(e) => handleFloorChange(idx, 'floorStartDate', e.target.value)}
                            className="row-floor-start p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                          <input
                            data-field="floorEndDate"
                            type="date"
                            value={item.floorEndDate || ''}
                            min={item.floorStartDate || undefined}
                            onChange={(e) => handleFloorChange(idx, 'floorEndDate', e.target.value)}
                            className="row-floor-end p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                          <select
                            data-field="floorPlanType"
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
                            data-field="barrierQty"
                            type="number"
                            value={item.barrierQty !== undefined && item.barrierQty !== null ? item.barrierQty : ''}
                            onChange={(e) => handleCustomQtyChange(idx, 'barrierQty', e.target.value)}
                            className="row-barrier-qty w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] outline-none text-center bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                          <input
                            data-field="workableQty"
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
                            data-field="floorStartDate"
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
                            data-field="floorEndDate"
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
                            data-field="floorPlanType"
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
                            data-field="startDate"
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
                            data-field="endDate"
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
                            data-field="planType"
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
                            data-field="limitation"
                            rows={1}
                            value={item.limitation || ''}
                            onChange={(e) => handleTextChange(idx, 'limitation', e.target.value)}
                            placeholder="Limitation"
                            className={`row-limitation ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
                          <textarea
                            data-field="remarks"
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
                            data-field="unit"
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
                            data-field="processName"
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
                            data-field="startDate"
                            type="date"
                            value={item.startDate || ''}
                            onChange={(e) => handleStartDateChange(idx, e.target.value)}
                            className="row-start-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <input
                            data-field="endDate"
                            type="date"
                            value={item.endDate || ''}
                            min={item.startDate || undefined}
                            onChange={(e) => handleEndDateChange(idx, e.target.value)}
                            className="row-end-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <select
                            data-field="planType"
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
                            data-field="limitation"
                            rows={1}
                            value={item.limitation || ''}
                            onChange={(e) => handleTextChange(idx, 'limitation', e.target.value)}
                            placeholder="Limitation"
                            className={`row-limitation ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
                          <textarea
                            data-field="remarks"
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
              data-action="save"
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
