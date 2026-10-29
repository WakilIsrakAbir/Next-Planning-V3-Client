'use client';

/* Batch Plan route page (/batch/plan and /batch/plan/<UNIT>; an open report adds ?order=<number>).
   The old #batchPlanListView (register) or #reportContainer (report), and the page's dialogs (reportui's machine
   evaluation / Tall/Big / OD dialogs, Internal change, re-confirm revision, tentative questionnaire, confirm checks,
   full view). The report keeps the heading (eyebrow, title, badge) with the unit tabs; the register has no heading
   and starts with its own unit tabs, like the plan lists (see BatchRegister).
   Route -> state (old BatchApi.route()): when the data is ready, and whenever the URL changes from outside
   (sidebar, browser history, a typed URL) or the data is reloaded, the unit of the URL is opened
   (routeBatchPlan -> selectFloor; without the all-orders permission /batch/plan opens the first unit the user
   may open) and ?order= opens that report again. State -> route: when the page itself moves (unit tab, floor
   jump, search result, open report, Back to List), the URL is replaced to follow it. */
import React, { Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { BATCH_NAVIGATE_EVENT, rememberBatchRoute } from '@/features/batch/lib/batch-navigation';
import {
  S,
  batchPlanUrl,
  leaveBatchPlan,
  noteBatchPlanDataLoaded,
  prepareBatchPlanPrint,
  routeBatchPlan,
  syncBatchPlanRoute,
  takePendingBatchPlanUrl,
  useBatchVersion,
} from '@/features/batch/lib';
import BatchHeader from '@/features/batch/components/shell/BatchHeader';
import UnitTabs from './UnitTabs';
import BatchRegister from './BatchRegister';
import BatchPlanReportView from './BatchPlanReportView';
import InternalChangeDialog from './InternalChangeDialog';
import ReconfirmRevisionDialog from './ReconfirmRevisionDialog';
import TentativeQuestionnaire from './TentativeQuestionnaire';
import ConfirmChecksDialog from './ConfirmChecksDialog';
import BatchPlanPreviewDialog from './BatchPlanPreviewDialog';
import ReportDialogs from '@/features/batch/components/plan/report/ReportDialogs';

// Mounted Batch Plan pages: a new unit in the URL mounts the page again, which is not leaving it.
let mountedPlanPages = 0;

export default function BatchPlanPage({ unit }: { unit: string | null }) {
  useBatchVersion();

  // Leaving the Batch Plan page for another page closes its report and drops the draft (old switchMainView).
  useLayoutEffect(() => {
    mountedPlanPages++;
    return () => {
      mountedPlanPages--;
      window.setTimeout(() => {
        if (!mountedPlanPages) leaveBatchPlan();
      }, 0);
    };
  }, []);

  // The sidebar's Batch Plan item opens the unit used last (kept in this browser).
  useEffect(() => {
    rememberBatchRoute(unit ? 'plan/' + unit : 'plan');
  }, [unit]);

  // A sidebar click on the page that is open goes back to its list (old route() on the same hash).
  useEffect(() => {
    const onNavigate = (event: Event) => {
      const route = String((event as CustomEvent<{ route?: string }>).detail?.route || '');
      if (route !== (unit ? 'plan/' + unit : 'plan') || S.loading) return;
      routeBatchPlan(unit, null);
    };
    window.addEventListener(BATCH_NAVIGATE_EVENT, onNavigate);
    return () => window.removeEventListener(BATCH_NAVIGATE_EVENT, onNavigate);
  }, [unit]);

  // The browser's own print command gets the page footer too (old beforeprint listener).
  useEffect(() => {
    window.addEventListener('beforeprint', prepareBatchPlanPrint);
    return () => window.removeEventListener('beforeprint', prepareBatchPlanPrint);
  }, []);

  // A closed dialog gives the focus back (old .focus() calls; the engine names the element).
  useEffect(() => {
    const target = S.ui.planflowFocus as string | HTMLElement | null | undefined;
    if (!target) return;
    S.ui.planflowFocus = null;
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (element && typeof element.focus === 'function') element.focus();
  });

  // The open unit shows as the active tab in the heading (old switchMainView: the title has no unit).
  const title = 'Batch Plan Generation';

  return (
    <>
      <Suspense fallback={null}>
        <PlanRouteSync unit={unit} />
      </Suspense>
      {S.currentViewingNumber ? (
        <>
          <BatchHeader eyebrow="Planning & Production Info" title={title} badge="Active Register">
            <UnitTabs kind="plan" />
          </BatchHeader>
          <BatchPlanReportView />
        </>
      ) : (
        // Mounted once the data has loaded, so the register measures its table area at once (Auto page size).
        !S.loading && <BatchRegister />
      )}
      <ReportDialogs />
      <InternalChangeDialog />
      <ReconfirmRevisionDialog />
      <TentativeQuestionnaire />
      <ConfirmChecksDialog />
      <BatchPlanPreviewDialog />
    </>
  );
}

/** Keeps the route and the state in step (see the comment at the top). Renders nothing. */
function PlanRouteSync({ unit }: { unit: string | null }) {
  const version = useBatchVersion();
  const order = useSearchParams().get('order') || null;
  // The URL this page last routed or followed.
  const seenUrl = useRef<string | null>(null);

  useEffect(() => {
    if (S.loading) return; // the data is not loaded yet (old route() ran from BatchApi.ready() / failed())
    const url = batchPlanUrl(unit, order);
    const arrived = seenUrl.current !== url;
    seenUrl.current = url;
    // A (re)load of the data makes ALL BUYERS active and routes again (old BatchApi.ready()).
    const reloaded = noteBatchPlanDataLoaded();
    const ownMove = arrived && takePendingBatchPlanUrl(url);
    if (reloaded || (arrived && !ownMove)) {
      routeBatchPlan(unit, order);
      return;
    }
    // The page moved by itself (or the requested report could not be opened): the URL follows.
    if (batchPlanUrl() !== url) syncBatchPlanRoute();
  }, [unit, order, version]);

  return null;
}
