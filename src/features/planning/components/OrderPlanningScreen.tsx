'use client';

import React, { useEffect, useState, useMemo, useSyncExternalStore } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
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
  formatExcelDate,
  formatPlanPayload,
  readIsAdminRole,
  subscribeToNothing,
  ydKnitPlan,
  type Loose,
} from '@/features/planning/lib/order-plan-logic';
import { createDeptPlanLogic } from '@/features/planning/lib/dept-plan-logic';
import DeptPlanSection from '@/features/planning/components/DeptPlanSection';

const DEPARTMENTS: Record<string, { name: string; label: string }> = {
  knitting: { name: 'Knitting Plan', label: 'Knitting' },
  dyeing: { name: 'Dyeing Plan', label: 'Dyeing' },
  finishing: { name: 'Finishing Plan', label: 'Finishing' },
  delivery: { name: 'Delivery Plan', label: 'Delivery' },
  yd: { name: 'YD Plan', label: 'YD' },
};

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
      <DeptPlanSection
        dept={dept}
        deptMeta={deptMeta}
        orderNo={orderNo}
        order={order}
        planItems={planItems}
        loading={loading}
        isAdmin={isAdmin}
        unitOptions={unitOptions}
        processOptions={processOptions}
        ydBKnitPlan={ydBKnitPlan}
        saving={saving}
        onBack={handleBack}
        onSave={handleSavePlanning}
        logic={logic}
      />
    </div>
  );
}
