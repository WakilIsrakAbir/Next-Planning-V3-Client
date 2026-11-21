'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import InlineSpinner from '@/components/ui/InlineSpinner';
import {
  findPrecachedOrder,
  getPrecachedOrderDetail,
  setPrecachedOrderDetail,
  setPrecachedOrderDetailAllDepts,
  cachedDropdownOptions,
  prefetchDropdowns,
  fetchOrderDetail,
  markOrderRecentlySaved,
} from '@/features/planning/lib/planning-cache';
import { batchIsAdmin, markBatchDataStale } from '@/features/batch/lib/batch-navigation';
import {
  readIsAdminRole,
  subscribeToNothing,
  type Loose,
} from '@/features/planning/lib/order-plan-logic';
import {
  deptMetaOf,
  deptsFor,
  initOrderPageModel,
  isGroupDirty,
  isOlderPlanData,
  orderPageReducer,
  rowsForSave,
  sectionsFor,
  type GroupKey,
  type SectionDef,
} from '@/features/planning/lib/order-page-model';
import {
  buildSavePlansBody,
  confirmCompletions,
  findFailingEntry,
  postSavePlans,
  type PlanSaveEntry,
  type SaveExtra,
} from '@/features/planning/lib/order-page-save';
import {
  getHiddenSectionsServerSnapshot,
  getHiddenSectionsSnapshot,
  parseHiddenSections,
  setSectionHidden,
  subscribeHiddenSections,
} from '@/features/planning/lib/section-visibility';
import OrderGeneralInfo from '@/features/planning/components/OrderGeneralInfo';
import PlanSection from '@/features/planning/components/PlanSection';

/** How long a failed Save Data check keeps the failing section highlighted. */
const RING_MS = 6000;

// Save Data runs these after the plans (SPEC C2 10a). Empty here; the Planning Guide joins it later.
const NO_SAVE_EXTRAS: SaveExtra[] = [];

type SaveTarget = { kind: 'section'; key: string } | { kind: 'all' };

export default function OrderPlanningScreen() {
  const params = useParams();

  const dept = (params.dept as string)?.toLowerCase() || 'knitting';
  const orderNo = params.orderNo as string;

  // A new order or department starts from a fresh page state.
  return <OrderPlanningPage key={`${dept}/${orderNo}`} dept={dept} orderNo={orderNo} />;
}

function OrderPlanningPage({ dept, orderNo }: { dept: string; orderNo: string }) {
  const router = useRouter();

  const sections = useMemo(() => sectionsFor(dept), [dept]);

  // 0. High-speed initial hydration: check cache & list header (0ms instant render)
  const [model, dispatch] = useReducer(orderPageReducer, null, () => {
    const cachedDetail = getPrecachedOrderDetail(dept, orderNo);
    const precachedHeader = findPrecachedOrder(orderNo);
    return initOrderPageModel(deptsFor(dept), cachedDetail, precachedHeader || { orderNo });
  });
  const modelRef = useRef(model);
  useLayoutEffect(() => {
    modelRef.current = model;
  });

  const routeRows = model.drafts[dept]?.rows ?? [];
  // Spinner only while no items are on screen (no cache, or a cached order without items) until the first fetch ends.
  const [loading, setLoading] = useState<boolean>(() => routeRows.length === 0);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [saving, setSaving] = useState<{ keys: string[]; all: boolean } | null>(null);
  const savingRef = useRef(false);
  const [ringKeys, setRingKeys] = useState<string[]>([]);
  // 1. Resolve Admin / Approver Role from localStorage (false during SSR / hydration, then the stored role)
  const isAdmin = useSyncExternalStore(subscribeToNothing, readIsAdminRole, () => false);
  // Plan D4: sections of other departments are editable only for the role 'Admin' (the Sidebar's admin rule).
  const canEditOthers = useSyncExternalStore(subscribeToNothing, batchIsAdmin, () => false);
  const hiddenSnapshot = useSyncExternalStore(subscribeHiddenSections, getHiddenSectionsSnapshot, getHiddenSectionsServerSnapshot);
  const hidden = useMemo(() => new Set(parseHiddenSections(hiddenSnapshot)), [hiddenSnapshot]);
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

  const deptMeta = deptMetaOf(dept);

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/planning/${dept}`);
    }
  }, [router, dept]);

  const showToast = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3800);
  }, []);

  const fetchOrderAndDropdowns = useCallback(
    async (fresh = false) => {
      // `loading` starts true when no items are populated from cache; re-fetches after a save keep the tables visible.
      try {
        // Parallelize dropdowns fetch & order detail fetch (joins a still-running hover prefetch of this order;
        // `fresh` after a save always reads the saved state). One request gives every department of the order.
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

        // Keep-newest guard: a read older than the plan on screen (another server instance's cache) is ignored.
        if (isOlderPlanData(currentPlan, modelRef.current.planData)) return;

        // Clean sections are merged again from the read; sections with unsaved edits keep them.
        dispatch({ type: 'hydrate', data: { order: currentOrder, planData: currentPlan, fingerprints: data.fingerprints, deptFlags: data.deptFlags } });

        // Save to client cache for 0ms subsequent returns
        setPrecachedOrderDetail(dept, orderNo, {
          order: currentOrder,
          planData: currentPlan,
          fingerprints: data.fingerprints,
          deptFlags: data.deptFlags,
        });
      } catch (err) {
        console.error(err);
        if ((modelRef.current.drafts[dept]?.rows.length ?? 0) === 0) {
          showToast((err as Loose)?.message || 'Error loading order details.');
        }
      } finally {
        setLoading(false);
      }
    },
    [dept, orderNo, showToast]
  );

  useEffect(() => {
    // Fetch-on-mount: state is only set once the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrderAndDropdowns();
  }, [fetchOrderAndDropdowns]);

  // Failed Save Data check: bring the failing section into view, then drop the highlight after a while.
  useEffect(() => {
    if (ringKeys.length === 0) return;
    const el = document.querySelector(`[data-plan-section="${ringKeys[0]}"]`) as HTMLElement | null;
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    const timer = setTimeout(() => setRingKeys([]), RING_MS);
    return () => clearTimeout(timer);
  }, [ringKeys]);

  const toggleHidden = useCallback(
    (key: string) => setSectionHidden(key, !parseHiddenSections(getHiddenSectionsSnapshot()).includes(key)),
    []
  );

  const sectionDirty = useCallback(
    (m: typeof model, def: SectionDef) => {
      const draft = m.drafts[def.dept];
      return draft ? isGroupDirty(draft, def.dept, def.group) : false;
    },
    []
  );

  const runSave = useCallback(
    async (target: SaveTarget) => {
      if (savingRef.current) return;
      const m = modelRef.current;

      // Which departments (and delivery groups) this save sends.
      const groupsByDept = new Map<string, GroupKey[]>();
      const keys: string[] = [];
      const add = (def: SectionDef) => {
        groupsByDept.set(def.dept, [...(groupsByDept.get(def.dept) || []), def.group]);
        keys.push(def.key);
      };
      if (target.kind === 'section') {
        // A section's own Save always sends that section, even when it is clean (as today's Save did).
        const def = sections.find((s) => s.key === target.key);
        if (def) add(def);
      } else {
        sections.filter((def) => sectionDirty(m, def)).forEach(add);
      }
      const extras = target.kind === 'all' ? NO_SAVE_EXTRAS.filter((e) => e.isDirty) : [];
      if (groupsByDept.size === 0 && extras.length === 0) return;

      const entries: PlanSaveEntry[] = [...groupsByDept].map(([d, groups]) => ({ dept: d, groups, ...rowsForSave(m.drafts[d], d, groups) }));
      const ctx = { orderNo, order: m.order, planData: m.planData, isAdmin, showToast };

      if (entries.length > 0) {
        // Today's checks of each department, downstream first; the first failure stops everything.
        const failing = findFailingEntry(entries, ctx);
        if (failing) {
          const failingKeys = sections.filter((s) => s.dept === failing.dept && failing.groups.includes(s.group)).map((s) => s.key);
          failingKeys.forEach((k) => setSectionHidden(k, false));
          setRingKeys(failingKeys);
          return;
        }
        // Today's Completed prompt per department, in pipeline order; Cancel restores that saved status and stops.
        const restoreStatus = (d: string, status: string) => dispatch({ type: 'status', dept: d, update: status });
        if (!confirmCompletions(entries, { ...ctx, restoreStatus })) return;
      }

      savingRef.current = true;
      setSaving({ keys, all: target.kind === 'all' });
      setRingKeys([]);
      let plansSaved = false;
      try {
        if (entries.length > 0) {
          const result = await postSavePlans(buildSavePlansBody(orderNo, entries, m.fingerprints));
          // Only the saved sections are merged again (and adopt the new fingerprints); others keep their drafts.
          dispatch({
            type: 'saved',
            saved: entries.map((e) => ({ dept: e.dept, groups: e.groups })),
            planData: result.planData,
            fingerprints: result.fingerprints,
          });
          // Every department page of this order opens with the saved data.
          setPrecachedOrderDetailAllDepts(orderNo, {
            order: m.order,
            planData: result.planData,
            fingerprints: result.fingerprints,
            deptFlags: m.deptFlags || undefined,
          });
          markOrderRecentlySaved(orderNo);
          // Batch Plan reads the saved units and plan dates: reload it the next time it is shown.
          markBatchDataStale();
          showToast(`Planning schedule successfully saved for Order #${orderNo}!`, 'success');
          plansSaved = true;
        }
        for (const extra of extras) {
          try {
            await extra.save();
          } catch (err) {
            const reason = (err as Loose)?.message || 'Unknown error';
            showToast(plansSaved ? `Plans saved. ${extra.label} not saved: ${reason}` : `${extra.label} not saved: ${reason}`);
          }
        }
        if (plansSaved) fetchOrderAndDropdowns(true);
      } catch (err) {
        // Nothing was saved: every draft stays as it is (409 included, until the conflict dialog arrives).
        showToast((err as Loose)?.message || 'Error saving planning schedule.');
      } finally {
        savingRef.current = false;
        setSaving(null);
      }
    },
    [sections, sectionDirty, orderNo, isAdmin, showToast, fetchOrderAndDropdowns]
  );

  const handleSaveSection = useCallback((key: string) => runSave({ kind: 'section', key }), [runSave]);
  const handleSaveData = useCallback(() => runSave({ kind: 'all' }), [runSave]);

  const handleDiscard = useCallback(
    (key: string) => {
      const def = sections.find((s) => s.key === key);
      if (!def) return;
      if (!window.confirm(`Discard the unsaved changes in ${def.title}?`)) return;
      dispatch({ type: 'discard', dept: def.dept, group: def.group });
    },
    [sections]
  );

  const handleRouteStatusChange = useCallback((status: string) => dispatch({ type: 'status', dept, update: status }), [dept]);

  const dirtyKeys = useMemo(() => sections.filter((def) => sectionDirty(model, def)).map((def) => def.key), [sections, sectionDirty, model]);
  const dirtyCount = dirtyKeys.length + NO_SAVE_EXTRAS.filter((e) => e.isDirty).length;

  // Calculate order quantity fallback
  const totalItemQty = routeRows.reduce((acc, it) => {
    const q = Number(it.itemData?.RequiredQtyKgs || it.RequiredQtyKgs || it.requiredQtyKgs || it['Req Qty'] || it.Qty || 0);
    return acc + (isNaN(q) ? 0 : q);
  }, 0);
  const order = model.order;
  const displayQty = order.requiredQtyKgs || (totalItemQty > 0 ? totalItemQty : '—');

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

  const isSaving = saving !== null;

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
      <div
        data-page-header
        className="bg-gray-100 dark:bg-[#1f2637] border-b border-gray-200 dark:border-[#2a3346] flex flex-col sm:flex-row items-start sm:items-center px-4 py-2 shrink-0 justify-between w-full gap-2 rounded-sm shadow-sm"
      >
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
            type="button"
            data-c2-chrome
            data-action="save-data"
            onClick={handleSaveData}
            disabled={isSaving || dirtyCount === 0}
            title={dirtyCount === 0 ? 'Nothing to save' : `Save every section with unsaved changes (${dirtyCount})`}
            className="px-4 md:px-6 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving?.all ? (
              <InlineSpinner size={14} />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {dirtyCount > 0 ? `Save Data (${dirtyCount})` : 'Save Data'}
          </button>
        </div>
      </div>

      {/* ==========================================================
          GENERAL INFORMATION & PLANNING CARD
          Exact Replica of Exp index.html lines 1403-1478 & detailed-view.js lines 193-219
         ========================================================== */}
      <OrderGeneralInfo
        order={order}
        displayQty={displayQty}
        orderStatus={model.drafts[dept]?.status ?? 'On Process'}
        onStatusChange={handleRouteStatusChange}
        hidden={hidden.has('general')}
        onToggleHidden={toggleHidden}
      />

      {/* ==========================================================
          PLAN SECTIONS: the page's own department first, then Knitting, Dyeing, Delivery Floor and Delivery Lock
         ========================================================== */}
      {sections.map((def) => {
        const draft = model.drafts[def.dept];
        const flags = model.deptFlags?.[def.dept];
        const notInLatest = flags ? flags.inLatestFile === false : false;
        const meta = deptMetaOf(def.dept);
        // Plan D4 / D8: the page's own department as today; any other section for 'Admin' only, and only while the
        // order is in that department's latest file.
        const editable = def.isRoute || (canEditOthers && !notInLatest);
        const readOnlyTitle = editable
          ? null
          : !canEditOthers
            ? `View only: no ${meta.label} Plan access`
            : `This order is not in the latest ${meta.label} file, so it is not listed on the ${meta.label} Plan page.`;
        return (
          <PlanSection
            key={def.key}
            def={def}
            orderNo={orderNo}
            order={order}
            planData={model.planData}
            rows={draft.rows}
            status={draft.status}
            isAdmin={isAdmin}
            editable={editable}
            readOnlyTitle={readOnlyTitle}
            noItems={!def.isRoute && Boolean(flags && flags.hasItems === false)}
            notInLatest={notInLatest}
            dirty={dirtyKeys.includes(def.key)}
            hidden={hidden.has(def.key)}
            ring={ringKeys.includes(def.key)}
            loading={loading}
            unitOptions={unitOptions}
            processOptions={processOptions}
            saving={isSaving}
            spinning={Boolean(saving?.keys.includes(def.key))}
            dispatch={dispatch}
            showToast={showToast}
            onSave={handleSaveSection}
            onDiscard={handleDiscard}
            onToggleHidden={toggleHidden}
            onBack={handleBack}
          />
        );
      })}
    </div>
  );
}
