'use client';

/* Batch Card route page (/batch/card, /batch/card/<UNIT>): the old #batchCardView with its heading and unit tabs.
   Once the data has loaded, the old BatchApi.route() rule runs for the route's unit (showCardRoute: an unknown
   unit or the plain route without the all-orders permission moves to the first unit the user may open, and the
   URL follows), then selectCardFloor(unit) opens that unit's register. It runs again after a data reload and
   when the sidebar re-opens this page (BATCH_NAVIGATE_EVENT), as the old route() did. */
import React, { useEffect, useRef } from 'react';
import { BATCH_NAVIGATE_EVENT, rememberBatchRoute } from '@/lib/batch-module';
import BatchHeader from '../shell/BatchHeader';
import UnitTabs from '@/features/batch/components/plan/UnitTabs';
import { S, showCardRoute, useBatchVersion } from '@/features/batch/engine';
import { CardOrderPanel, CardPreviewPanel, CardRegisterPanel } from './CardPanels';

export default function BatchCardPage({ unit }: { unit: string | null }) {
  useBatchVersion();
  const ready = !S.loading;
  const appState = S.appState;
  const shown = useRef<{ unit: string | null; appState: unknown } | null>(null);

  useEffect(() => {
    if (!ready) return;
    const last = shown.current;
    // Skips React's second development run of the same route (the rule moves the URL and resets the page).
    if (last && last.unit === unit && last.appState === appState) return;
    shown.current = { unit, appState };
    showCardRoute(unit);
    // The sidebar's Batch Card item opens the unit used last (the old host remembered every shown route).
    rememberBatchRoute(unit ? 'card/' + unit : 'card');
  }, [unit, ready, appState]);

  useEffect(() => {
    const route = unit ? 'card/' + unit : 'card';
    const onNavigate = (event: Event) => {
      if ((event as CustomEvent<{ route?: string }>).detail?.route === route && !S.loading) showCardRoute(unit);
    };
    window.addEventListener(BATCH_NAVIGATE_EVENT, onNavigate);
    return () => window.removeEventListener(BATCH_NAVIGATE_EVENT, onNavigate);
  }, [unit]);

  const panel = (S.ui.cardsPanel as string | undefined) || 'register';
  return (
    <>
      <BatchHeader
        eyebrow="Planning & Production Info"
        title="Batch Card"
        badge="Active Register"
      >
        <UnitTabs kind="card" />
      </BatchHeader>
      <div id="batchCardView">
        <CardRegisterPanel hidden={panel !== 'register'} />
        <CardOrderPanel hidden={panel !== 'order'} />
        <CardPreviewPanel hidden={panel !== 'preview'} />
      </div>
    </>
  );
}
