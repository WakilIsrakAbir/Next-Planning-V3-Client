'use client';

/* Batch Plan module root: loads the Batch data once, connects the engine to the Next router and renders
   the feature root (.batch-app) with its loading screen, load error banner and toast.
   It is rendered by app/(dashboard)/batch/layout.tsx, so it stays mounted while the user moves between
   the Batch routes; the data stays in memory when the user leaves the Batch pages and comes back, and is
   reloaded when another page changed it (upload, plan save, Dropdown Master unit change). */
import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { clearBatchDataStale, isBatchDataStale } from '@/lib/batch-module';
import { BatchApi, S, initializeStorage, permissionClasses, setBatchNavigator, useBatchVersion } from '../../engine';

let loadStarted = false;

export default function BatchProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useBatchVersion();

  // Engine code navigates through the Next router (unit tabs, floor jumps, view changes).
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
     the feature root's height, used by styles/batch.css where the old layout sized panels with vh. */
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

  const className = ['batch-app', permissionClasses(), S.loading ? 'batch-loading' : ''].filter(Boolean).join(' ');

  return (
    <div className={className} ref={rootRef}>
      {S.loadError && (
        <div
          id="batchLoadError"
          role="alert"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 999,
            margin: 0,
            padding: '12px 16px',
            background: '#fef2f2',
            color: '#991b1b',
            borderBottom: '1px solid #fecaca',
            font: '600 13px/1.4 system-ui,sans-serif',
          }}
        >
          Batch Plan data could not be loaded. {S.loadError}
        </div>
      )}
      <div className="app">
        <main className="main">
          <BatchLoading />
          {children}
        </main>
      </div>
      <div id="toast" className={'toast' + (S.toastMessage ? '' : ' hidden')} role="status" aria-live="polite">
        {S.toastMessage}
      </div>
    </div>
  );
}

/** The loading screen shown until the data has loaded (old #batchLoading). */
function BatchLoading() {
  const [seconds, setSeconds] = React.useState(0);
  const loading = S.loading;
  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [loading]);
  const hint =
    seconds >= 6
      ? seconds + ' s · The server may be waking up after a pause; the first load can then take up to a minute.'
      : seconds
        ? seconds + ' s'
        : '';
  return (
    <div id="batchLoading" role="status" aria-live="polite">
      <div className="batch-spinner" aria-hidden="true">
        <div className="ring-base" />
        <div className="ring-a" />
        <div className="ring-b" />
        <div className="dot" />
      </div>
      <h3 id="batchLoadingTitle">Loading Batch Plan...</h3>
      <p id="batchLoadingText">{S.loadingText}</p>
      <p className="batch-loading-hint" id="batchLoadingHint">
        {loading ? hint : ''}
      </p>
    </div>
  );
}
