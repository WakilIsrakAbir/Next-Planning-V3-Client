'use client';

/* Batch Plan module root: loads the Batch data once, connects the Batch logic to the Next router and renders
   the feature root ([data-batch-app]) with its loading screen, load error banner and toast.
   It is rendered by app/(dashboard)/batch/layout.tsx, so it stays mounted while the user moves between
   the Batch routes; the data stays in memory when the user leaves the Batch pages and comes back, and is
   reloaded when another page changed it (upload, plan save, Dropdown Master unit change). */
import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { toast as toastStyle } from '../ui/styles';
import { clearBatchDataStale, isBatchDataStale } from '@/features/batch/lib/batch-navigation';
import { BatchApi, S, initializeStorage, setBatchNavigator, useBatchVersion } from '@/features/batch/lib';

let loadStarted = false;

export default function BatchProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useBatchVersion();

  // Batch logic navigates through the Next router (unit tabs, floor jumps, view changes).
  useEffect(() => {
    setBatchNavigator((path, options) => {
      if (options?.replace) router.replace(path, { scroll: false });
      else router.push(path, { scroll: false });
    });
    return () => setBatchNavigator(null);
  }, [router]);

  // First visit: load the data. Later visits: reload only when another page changed the data, after asking
  // when this page has unsaved work.
  useEffect(() => {
    if (!loadStarted) {
      loadStarted = true;
      clearBatchDataStale();
      void initializeStorage();
      return;
    }
    if (isBatchDataStale() && !S.mutationBusy) {
      const reload =
        !BatchApi.hasUnsavedChanges() || window.confirm('Batch Plan has unsaved changes. Load the latest data and discard them?');
      clearBatchDataStale();
      if (reload) void initializeStorage();
    }
  }, []);

  /* The old page filled an iframe, so its `vh` meant the height of the content area. `--batch-vh` is 1% of
     the feature root's height; the register and report tables size themselves with it. */
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const apply = () => root.style.setProperty('--batch-vh', root.clientHeight / 100 + 'px');
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const className = cn(
    'flex h-full min-h-0 flex-col bg-batch-page font-batch leading-[normal] text-batch-text antialiased [page:batch-plan]',
    'dark:[color-scheme:dark] print:block print:h-auto print:bg-white print:text-black'
  );

  return (
    <div className={className} ref={rootRef} data-batch-app="" data-loading={S.loading ? '' : undefined}>
      {S.loadError && (
        <div
          id="batchLoadError"
          role="alert"
          className="sticky top-0 z-[999] m-0 border-b border-solid border-[#fecaca] bg-[#fef2f2] px-4 py-3 font-[system-ui,sans-serif] text-[13px] font-semibold leading-[1.4] text-[#991b1b] dark:border-[rgba(239,68,68,0.35)] dark:bg-[rgba(239,68,68,0.12)] dark:text-[#fca5a5]"
        >
          Batch Plan data could not be loaded. {S.loadError}
        </div>
      )}
      <div className="flex h-full min-h-0 flex-1 overflow-hidden print:block print:h-auto print:overflow-visible">
        <main className="mx-auto flex h-full w-full min-w-0 max-w-[1840px] flex-1 flex-col overflow-hidden px-7 py-[22px] print:block print:h-auto print:max-w-none print:overflow-visible print:p-0">
          {S.loading && <BatchLoading />}
          {/* The requested page stays mounted but hidden until the data has loaded. */}
          <div className={S.loading ? 'hidden' : 'contents'}>{children}</div>
        </main>
      </div>
      <div id="toast" className={cn(toastStyle.base, !S.toastMessage && toastStyle.hidden)} role="status" aria-live="polite">
        {S.toastMessage}
      </div>
    </div>
  );
}

/** The loading screen shown until the data has loaded (old #batchLoading). */
function BatchLoading() {
  const [seconds, setSeconds] = React.useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const hint =
    seconds >= 6
      ? seconds + ' s · The server may be waking up after a pause; the first load can then take up to a minute.'
      : seconds
        ? seconds + ' s'
        : '';
  return (
    <div
      id="batchLoading"
      role="status"
      aria-live="polite"
      className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center font-[system-ui,-apple-system,'Segoe_UI',Roboto,sans-serif] print:hidden"
    >
      <div className="relative mb-4 h-14 w-14" aria-hidden="true">
        <div className="absolute inset-0 rounded-full border-4 border-solid border-[#e5e7eb] dark:border-[#374151]" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-solid border-transparent border-r-[#10b981] border-t-[#10b981]" />
        <div className="absolute inset-2 animate-spin-reverse rounded-full border-4 border-solid border-transparent border-b-[#3b82f6] border-l-[#3b82f6]" />
        <div className="absolute left-5 top-5 h-4 w-4 animate-pulse rounded-full bg-[#f97316]" />
      </div>
      <h3 id="batchLoadingTitle" className="m-0 text-lg font-bold text-[#1f2937] dark:text-[#e2e8f0]">
        Loading Batch Plan...
      </h3>
      <p id="batchLoadingText" className="mx-0 mb-0 mt-1.5 text-[13px] text-[#64748b] dark:text-[#94a3b8]">
        {S.loadingText}
      </p>
      <p id="batchLoadingHint" className="mx-0 mb-0 mt-3.5 min-h-[18px] max-w-[420px] text-xs text-[#94a3b8] dark:text-[#64748b]">
        {hint}
      </p>
    </div>
  );
}
