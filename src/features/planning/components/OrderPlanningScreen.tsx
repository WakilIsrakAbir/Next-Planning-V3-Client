'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  History,
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
  sectionAccess,
  sectionsFor,
  type GroupKey,
  type OrderPageAction,
  type OrderPageModel,
  type SaveTarget,
  type SectionDef,
} from '@/features/planning/lib/order-page-model';
import {
  buildSavePlansBody,
  confirmCompletions,
  findFailingEntry,
  postSavePlans,
  SavePlansError,
  type PlanSaveEntry,
  type SaveExtra,
} from '@/features/planning/lib/order-page-save';
import {
  BACKUP_DELAY_MS,
  backupFits,
  buildBackup,
  readBackup,
  readStoredUser,
  removeBackups,
  writeBackup,
  type DeptBackup,
} from '@/features/planning/lib/order-page-backup';
import {
  getHiddenSectionsServerSnapshot,
  getHiddenSectionsSnapshot,
  parseHiddenSections,
  setSectionHidden,
  subscribeHiddenSections,
} from '@/features/planning/lib/section-visibility';
import { confirmLeave, useUnsavedChanges } from '@/lib/unsaved-changes';
import OrderGeneralInfo from '@/features/planning/components/OrderGeneralInfo';
import PlanSection from '@/features/planning/components/PlanSection';

// Save Data runs these after the plans (SPEC C2 10a). Empty here; the Planning Guide joins it later.
const NO_SAVE_EXTRAS: SaveExtra[] = [];

type GroupRef = { dept: string; group: GroupKey };

/** A section the user may change and save (plan D4 / D8). Any other section is never counted, sent or backed up. */
const changeable = (m: OrderPageModel, def: SectionDef, canEditOthers: boolean) => sectionAccess(def, canEditOthers, m.deptFlags).canSave;

const dirtyIn = (m: OrderPageModel, def: SectionDef, canEditOthers: boolean) => {
  if (!changeable(m, def, canEditOthers)) return false;
  const draft = m.drafts[def.dept];
  return draft ? isGroupDirty(draft, def.dept, def.group) : false;
};

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
  const pageDepts = useMemo(() => deptsFor(dept), [dept]);

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
  // The newest saved plan taken so far (set when a save answer or a read is dispatched, before the page renders it):
  // the keep-newest guard of a read that answers right after a save compares with it.
  const newestPlanRef = useRef<Loose>(model.planData);

  const routeRows = model.drafts[dept]?.rows ?? [];
  // Spinner only while no items are on screen (no cache, or a cached order without items) until the first fetch ends.
  const [loading, setLoading] = useState<boolean>(() => routeRows.length === 0);
  const [notFound, setNotFound] = useState<boolean>(false);
  // A save (or a "Load latest" read) is running: every Save is disabled. `keys`: the sections being saved.
  const [saving, setSaving] = useState<{ keys: string[]; all: boolean } | null>(null);
  const savingRef = useRef(false);
  const [ringKeys, setRingKeys] = useState<string[]>([]);
  const [scrollTo, setScrollTo] = useState<{ key: string } | null>(null);
  // Unsaved work of an earlier visit (sessionStorage backup) that may be restored.
  const [restoreOffer, setRestoreOffer] = useState<DeptBackup[] | null>(null);
  // 1. Resolve Admin / Approver Role from localStorage (false during SSR / hydration, then the stored role)
  const isAdmin = useSyncExternalStore(subscribeToNothing, readIsAdminRole, () => false);
  // Plan D4: sections of other departments are editable only for the role 'Admin' (the Sidebar's admin rule).
  const canEditOthers = useSyncExternalStore(subscribeToNothing, batchIsAdmin, () => false);
  const canEditOthersRef = useRef(canEditOthers);
  useLayoutEffect(() => {
    canEditOthersRef.current = canEditOthers;
  });
  const hiddenSnapshot = useSyncExternalStore(subscribeHiddenSections, getHiddenSectionsSnapshot, getHiddenSectionsServerSnapshot);
  // Hide/Unhide is remembered per page (route department): hiding Dyeing on the Knitting page leaves the Dyeing page as it is.
  const hiddenKey = useCallback((key: string) => `${dept}:${key}`, [dept]);
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

  // Back, the arrow and the card's Cancel leave the page: with unsaved work they ask first (SPEC C2 item 8, 10b).
  const handleBack = useCallback(() => {
    if (!confirmLeave()) return;
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

  /* ---------------- backup of unsaved work (sessionStorage) ---------------- */

  // waiting: until the first read (a backup of an earlier visit must not be overwritten before it is offered);
  // offer: a restore is offered (its departments are left alone); armed: the backup follows the unsaved work.
  const backupPhaseRef = useRef<'waiting' | 'offer' | 'armed'>('waiting');
  const offeredDeptsRef = useRef<Set<string>>(new Set());
  // The user the page was opened by (a forced sign-out removes the stored user before the page goes away).
  const backupUserRef = useRef<string | null>(null);
  useEffect(() => {
    backupUserRef.current = readStoredUser();
  }, []);

  /**
   * Each department's unsaved work is stored (or its backup removed when it has none). Only departments the user may
   * change on this page: a View only section leaves the backup of its own page alone.
   */
  const writeBackups = useCallback(() => {
    const phase = backupPhaseRef.current;
    if (phase === 'waiting') return;
    const m = modelRef.current;
    const user = backupUserRef.current ?? readStoredUser();
    pageDepts.forEach((d) => {
      if (phase === 'offer' && offeredDeptsRef.current.has(d)) return;
      if (!sections.some((def) => def.dept === d && changeable(m, def, canEditOthersRef.current))) return;
      const groups = sections.filter((def) => def.dept === d && dirtyIn(m, def, canEditOthersRef.current)).map((def) => def.group);
      const base = m.fingerprints[d];
      if (groups.length === 0 || !base) removeBackups(user, orderNo, d);
      else writeBackup(user, orderNo, buildBackup(m.drafts[d], d, groups, base, Date.now()));
    });
  }, [pageDepts, sections, orderNo]);
  const writeBackupsRef = useRef(writeBackups);
  useLayoutEffect(() => {
    writeBackupsRef.current = writeBackups;
  });

  // Debounced after every change; at once when the page goes away (navigation, forced sign-out, reload, tab close).
  useEffect(() => {
    const timer = setTimeout(writeBackups, BACKUP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [model, writeBackups]);
  useEffect(() => {
    const flush = () => writeBackupsRef.current();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  /** After the first read: offer the backups still made on the stored data, for sections the user may change. */
  const decideRestoreOffer = useCallback(
    (m: OrderPageModel) => {
      if (backupPhaseRef.current !== 'waiting') return;
      const user = backupUserRef.current ?? readStoredUser();
      const found: DeptBackup[] = [];
      pageDepts.forEach((d) => {
        const base = m.fingerprints[d];
        const backup = base ? readBackup(user, orderNo, d, base) : null;
        if (!backup || !backupFits(backup, m.drafts[d])) return;
        const groups = backup.groups.filter((g) =>
          sections.some((def) => def.dept === d && def.group === g && changeable(m, def, canEditOthersRef.current))
        );
        if (groups.length > 0) found.push({ ...backup, groups });
      });
      if (found.length === 0) {
        backupPhaseRef.current = 'armed';
        return;
      }
      backupPhaseRef.current = 'offer';
      offeredDeptsRef.current = new Set(found.map((b) => b.dept));
      setRestoreOffer(found);
    },
    [pageDepts, sections, orderNo]
  );

  /* ---------------- reads ---------------- */

  /**
   * Applies a detail read (keep-newest guard, then merge). A section the read makes unchangeable (View only, not in
   * the latest file, no items) gives up its draft, like Discard. `drop`: groups whose drafts are given up as well
   * ("Load latest"). Returns the action dispatched, or null when the read was older than the data on screen.
   */
  const applyRead = useCallback(
    (data: Loose, drop: GroupRef[] = []): OrderPageAction | null => {
      const m = modelRef.current;
      const currentOrder = data.order || {};
      const currentPlan = data.planData || {};

      // Keep-newest guard: a read older than the plan on screen (another server instance's cache) is ignored, and
      // is not cached either.
      if (isOlderPlanData(currentPlan, newestPlanRef.current)) return null;
      newestPlanRef.current = currentPlan;

      const lost = sections.filter(
        (def) =>
          sectionAccess(def, canEditOthersRef.current, m.deptFlags).canSave &&
          !sectionAccess(def, canEditOthersRef.current, data.deptFlags || null).canSave
      );
      // Clean sections are merged again from the read; sections with unsaved edits keep them.
      const action: OrderPageAction = {
        type: 'hydrate',
        data: { order: currentOrder, planData: currentPlan, fingerprints: data.fingerprints, deptFlags: data.deptFlags },
        drop: [...drop, ...lost.map((def) => ({ dept: def.dept, group: def.group }))],
      };
      dispatch(action);

      // Save to client cache for 0ms subsequent returns
      setPrecachedOrderDetail(dept, orderNo, {
        order: currentOrder,
        planData: currentPlan,
        fingerprints: data.fingerprints,
        deptFlags: data.deptFlags,
      });
      return action;
    },
    [sections, dept, orderNo]
  );

  const fetchOrderAndDropdowns = useCallback(
    async (fresh = false) => {
      // `loading` starts true when no items are populated from cache; re-fetches after a save keep the tables visible.
      let read: OrderPageAction | null = null;
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

        read = applyRead(orderRes.data || {});
      } catch (err) {
        console.error(err);
        if ((modelRef.current.drafts[dept]?.rows.length ?? 0) === 0) {
          showToast((err as Loose)?.message || 'Error loading order details.');
        }
      } finally {
        setLoading(false);
        // The first read decides the restore offer, on the fingerprints it brought (else the cached ones).
        if (backupPhaseRef.current === 'waiting') decideRestoreOffer(read ? orderPageReducer(modelRef.current, read) : modelRef.current);
      }
    },
    [dept, orderNo, showToast, applyRead, decideRestoreOffer]
  );

  useEffect(() => {
    // Fetch-on-mount: state is only set once the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrderAndDropdowns();
  }, [fetchOrderAndDropdowns]);

  // Bring a section into view: the failing one of a refused check, or the first refused one of Save Data (409).
  useEffect(() => {
    if (!scrollTo) return;
    const el = document.querySelector(`[data-plan-section="${scrollTo.key}"]`) as HTMLElement | null;
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [scrollTo]);

  const toggleHidden = useCallback(
    (key: string) => setSectionHidden(hiddenKey(key), !parseHiddenSections(getHiddenSectionsSnapshot()).includes(hiddenKey(key))),
    [hiddenKey]
  );

  /** A section the user may change and save (plan D4 / D8). Any other section is never counted or sent. */
  const mayChange = useCallback((m: typeof model, def: SectionDef) => changeable(m, def, canEditOthers), [canEditOthers]);

  const sectionDirty = useCallback((m: typeof model, def: SectionDef) => dirtyIn(m, def, canEditOthers), [canEditOthers]);

  /**
   * The page's dispatch for edits. A failed Save Data check keeps its ring until the failing department is edited
   * again (rows, status or Discard), or until the next save starts.
   */
  const editDispatch = useCallback(
    (action: OrderPageAction) => {
      dispatch(action);
      if (action.type === 'rows' || action.type === 'status' || action.type === 'discard') {
        const edited = action.dept;
        setRingKeys((prev) => {
          const next = prev.filter((k) => sections.find((s) => s.key === k)?.dept !== edited);
          return next.length === prev.length ? prev : next;
        });
      }
    },
    [sections]
  );

  const runSave = useCallback(
    async (target: SaveTarget, opts: { noBase?: string[]; onlyDirty?: boolean } = {}) => {
      if (savingRef.current) return;
      const m = modelRef.current;

      // Which departments (and delivery groups) this save sends.
      const groupsByDept = new Map<string, GroupKey[]>();
      const keys: string[] = [];
      const add = (def: SectionDef) => {
        groupsByDept.set(def.dept, [...(groupsByDept.get(def.dept) || []), def.group]);
        keys.push(def.key);
      };
      // A section's own Save always sends that section, even when it is clean (as today's Save did). "Save mine
      // anyway" sends only what still has unsaved work (`onlyDirty`): never a clean section without its base.
      const pick = (def: SectionDef) => (opts.onlyDirty ? sectionDirty(m, def) : mayChange(m, def));
      if (target.kind === 'section') {
        sections.filter((def) => def.key === target.key && pick(def)).forEach(add);
      } else if (target.kind === 'dept') {
        sections.filter((def) => def.dept === target.dept && pick(def)).forEach(add);
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
          failingKeys.forEach((k) => setSectionHidden(hiddenKey(k), false));
          setRingKeys(failingKeys);
          setScrollTo({ key: failingKeys[0] });
          return;
        }
        // Today's Completed prompt per department, in pipeline order; Cancel restores that saved status and stops.
        const restoreStatus = (d: string, status: string) => dispatch({ type: 'status', dept: d, update: status });
        if (!confirmCompletions(entries, { ...ctx, restoreStatus })) return;
      }

      // Plan D7: a department settled with "Save mine anyway" is sent without its base (no conflict check).
      const forced = new Set([...(opts.noBase || []), ...Object.keys(m.conflicts).filter((d) => m.conflicts[d].force)]);
      const bases = { ...m.fingerprints };
      forced.forEach((d) => delete bases[d]);

      savingRef.current = true;
      setSaving({ keys, all: target.kind === 'all' });
      setRingKeys([]);
      let plansSaved = false;
      try {
        if (entries.length > 0) {
          const result = await postSavePlans(buildSavePlansBody(orderNo, entries, bases));
          if (!isOlderPlanData(result.planData, newestPlanRef.current)) newestPlanRef.current = result.planData;
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
        // Nothing was saved: every draft stays as it is. A 409 (plan D7): the refused sections show the conflict
        // alert ("Load latest" / "Save mine anyway"); the toast shows the server's message.
        const conflictDepts = err instanceof SavePlansError ? err.conflictDepartments : null;
        if (conflictDepts) {
          dispatch({ type: 'conflict', depts: conflictDepts, sent: entries.map((e) => ({ dept: e.dept, groups: e.groups })), target });
          const first = target.kind === 'all' ? sections.find((s) => keys.includes(s.key) && conflictDepts.includes(s.dept)) : undefined;
          if (first) setScrollTo({ key: first.key });
        }
        showToast((err as Loose)?.message || 'Error saving planning schedule.');
      } finally {
        savingRef.current = false;
        setSaving(null);
      }
    },
    [sections, mayChange, sectionDirty, hiddenKey, orderNo, isAdmin, showToast, fetchOrderAndDropdowns]
  );

  /** Plan D7 "Load latest": reads the order again past the server cache and merges `drop` (given up) from it. */
  const loadLatest = useCallback(
    async (drop: GroupRef[]) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setSaving({ keys: [], all: false });
      try {
        const res = await fetchOrderDetail(dept, orderNo, true, true);
        if (!res.ok || !res.data || !applyRead(res.data, drop)) throw new Error('not loaded');
      } catch {
        showToast(`Could not load the latest plan of Order #${orderNo}. Please try again.`);
      } finally {
        savingRef.current = false;
        setSaving(null);
      }
    },
    [dept, orderNo, applyRead, showToast]
  );

  const handleSaveSection = useCallback((key: string) => runSave({ kind: 'section', key }), [runSave]);
  // The route card's footer "Save Planning Schedule": on the delivery page each of the two cards saves the whole
  // Delivery plan (Floor and Lock), as today's single footer button did; elsewhere it is the section's own Save.
  const handleSaveFooter = useCallback(
    (key: string) => {
      const def = sections.find((s) => s.key === key);
      return runSave(def && def.dept === 'delivery' ? { kind: 'dept', dept: def.dept } : { kind: 'section', key });
    },
    [sections, runSave]
  );
  const handleSaveData = useCallback(() => runSave({ kind: 'all' }), [runSave]);

  /** The refused sections of `key`'s department (plan D7), or null. */
  const conflictOf = useCallback(
    (key: string) => {
      const def = sections.find((s) => s.key === key);
      const conflict = def ? modelRef.current.conflicts[def.dept] : undefined;
      if (!def || !conflict) return null;
      return { conflict, affected: sections.filter((s) => s.dept === def.dept && conflict.groups.includes(s.group)) };
    },
    [sections]
  );

  // Plan D7 "Load latest": asks first when unsaved changes would be lost, then re-merges only those sections.
  const handleLoadLatest = useCallback(
    (key: string) => {
      const found = conflictOf(key);
      if (!found) return;
      const titles = found.affected.map((s) => s.title).join(', ');
      const hasWork = found.affected.some((s) => sectionDirty(modelRef.current, s));
      if (hasWork && !window.confirm(`Load the latest saved ${titles}? Your unsaved changes in ${titles} will be lost.`)) return;
      loadLatest(found.affected.map((s) => ({ dept: s.dept, group: s.group })));
    },
    [conflictOf, sectionDirty, loadLatest]
  );

  // Plan D7 "Save mine anyway": the refused save again (Save Data, or the refused sections of this department),
  // without `base` for the departments it was refused for.
  const handleSaveMine = useCallback(
    (key: string) => {
      const found = conflictOf(key);
      if (!found) return;
      const { conflict, affected } = found;
      const depts = conflict.depts.filter((d) => modelRef.current.conflicts[d]);
      const target: SaveTarget =
        conflict.target.kind === 'all'
          ? { kind: 'all' }
          : affected.length === 1
            ? { kind: 'section', key: affected[0].key }
            : { kind: 'dept', dept: affected[0].dept };
      dispatch({ type: 'force', depts });
      runSave(target, { noBase: depts, onlyDirty: true });
    },
    [conflictOf, runSave]
  );

  const handleDiscard = useCallback(
    (key: string) => {
      const def = sections.find((s) => s.key === key);
      if (!def) return;
      if (!window.confirm(`Discard the unsaved changes in ${def.title}?`)) return;
      const refused = Boolean(modelRef.current.conflicts[def.dept]?.groups.includes(def.group));
      editDispatch({ type: 'discard', dept: def.dept, group: def.group });
      // Its saved data is known to be out of date (plan D7): show the latest.
      if (refused) loadLatest([{ dept: def.dept, group: def.group }]);
    },
    [sections, editDispatch, loadLatest]
  );

  const handleRouteStatusChange = useCallback((status: string) => editDispatch({ type: 'status', dept, update: status }), [editDispatch, dept]);

  // Restore offer: put the backed-up work back into the sections it still fits (same base, same items, changeable).
  const handleRestore = useCallback(() => {
    const m = modelRef.current;
    const offer = restoreOffer || [];
    const fits = offer
      .filter((b) => m.fingerprints[b.dept] === b.base && backupFits(b, m.drafts[b.dept]))
      .map((b) => ({
        ...b,
        groups: b.groups.filter((g) => sections.some((def) => def.dept === b.dept && def.group === g && changeable(m, def, canEditOthersRef.current))),
      }))
      .filter((b) => b.groups.length > 0);
    if (fits.length > 0) dispatch({ type: 'restore', backups: fits });
    if (fits.length < offer.length) showToast('Some unsaved changes could not be restored: the saved plan has changed since.');
    backupPhaseRef.current = 'armed';
    setRestoreOffer(null);
  }, [restoreOffer, sections, showToast]);

  const handleDropBackup = useCallback(() => {
    const user = backupUserRef.current ?? readStoredUser();
    (restoreOffer || []).forEach((b) => removeBackups(user, orderNo, b.dept));
    backupPhaseRef.current = 'armed';
    setRestoreOffer(null);
    // Unsaved work typed while the offer was shown is backed up from now on.
    writeBackupsRef.current();
  }, [restoreOffer, orderNo]);

  const dirtyKeys = useMemo(() => sections.filter((def) => sectionDirty(model, def)).map((def) => def.key), [sections, sectionDirty, model]);
  const dirtyCount = dirtyKeys.length + NO_SAVE_EXTRAS.filter((e) => e.isDirty).length;

  // SPEC C2 item 8: the shared guard (Sidebar links, Back, beforeunload) names the sections with unsaved work.
  const unsavedLabels = useMemo(() => sections.filter((def) => dirtyKeys.includes(def.key)).map((def) => def.title), [sections, dirtyKeys]);
  useUnsavedChanges('order-page', unsavedLabels);

  const restoreLabels = useMemo(
    () =>
      restoreOffer
        ? sections.filter((def) => restoreOffer.some((b) => b.dept === def.dept && b.groups.includes(def.group))).map((def) => def.title)
        : [],
    [restoreOffer, sections]
  );

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
        <div data-toast className="fixed top-5 right-5 z-50 animate-bounce">
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

      {/* Unsaved work of an earlier visit (kept in this tab, e.g. across a forced sign-out): restore it? */}
      {restoreLabels.length > 0 && (
        <div
          data-c2-chrome
          data-restore-offer
          role="alert"
          className="alert alert-info text-xs py-2 px-3 rounded-sm flex flex-col sm:flex-row items-start sm:items-center gap-2"
        >
          <History className="h-4 w-4 shrink-0" />
          <p className="flex-1 min-w-0 font-semibold">
            Unsaved changes in: {restoreLabels.join(', ')} were kept from your last visit. Restore them?
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" data-action="restore-backup" onClick={handleRestore} disabled={isSaving} className="btn btn-xs">
              Restore
            </button>
            <button type="button" data-action="drop-backup" onClick={handleDropBackup} className="btn btn-xs btn-ghost">
              Discard
            </button>
          </div>
        </div>
      )}

      {/* ==========================================================
          GENERAL INFORMATION & PLANNING CARD
          Exact Replica of Exp index.html lines 1403-1478 & detailed-view.js lines 193-219
         ========================================================== */}
      <OrderGeneralInfo
        order={order}
        displayQty={displayQty}
        orderStatus={model.drafts[dept]?.status ?? 'On Process'}
        onStatusChange={handleRouteStatusChange}
        loaded={model.loaded}
        hidden={hidden.has(hiddenKey('general'))}
        onToggleHidden={toggleHidden}
      />

      {/* ==========================================================
          PLAN SECTIONS: the page's own department first, then Knitting, Dyeing, Delivery Floor and Delivery Lock
         ========================================================== */}
      {sections.map((def) => {
        const draft = model.drafts[def.dept];
        // Plan D4 / D8: the page's own department as today; any other section for 'Admin' only, and only while the
        // order is in that department's latest file (the same rule decides what a save may send).
        const { editable, readOnlyTitle, notInLatest, noItems } = sectionAccess(def, canEditOthers, model.deptFlags);
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
            noItems={noItems}
            notInLatest={notInLatest}
            dirty={dirtyKeys.includes(def.key)}
            hidden={hidden.has(hiddenKey(def.key))}
            ring={ringKeys.includes(def.key)}
            loading={loading}
            loaded={model.loaded}
            conflict={Boolean(model.conflicts[def.dept]?.groups.includes(def.group))}
            unitOptions={unitOptions}
            processOptions={processOptions}
            saving={isSaving}
            spinning={Boolean(saving?.keys.includes(def.key))}
            dispatch={editDispatch}
            showToast={showToast}
            onSave={handleSaveSection}
            onSaveFooter={handleSaveFooter}
            onDiscard={handleDiscard}
            onToggleHidden={toggleHidden}
            onBack={handleBack}
            onLoadLatest={handleLoadLatest}
            onSaveMine={handleSaveMine}
          />
        );
      })}
    </div>
  );
}
