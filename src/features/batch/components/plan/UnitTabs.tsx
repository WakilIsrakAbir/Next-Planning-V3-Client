'use client';

/* Unit tabs under the page heading (old #unitTabs, renderUnitTabs / highlightUnitTabs / updateFloorMenuCounts):
   All Orders (all-orders permission only) and one tab per unit the user may open, with the order counts.
   Batch Plan counts orders per unit; Batch Card counts confirmed scopes per unit. The open unit is
   highlighted; while the all-units search is on it is only marked lightly ('searching').
   Each tab is a link to /batch/<kind>[/<UNIT>]; a plain click opens the unit at once and replaces the URL
   (old unitTabs click listener), a middle click / Ctrl+click opens it in a new tab. */
import React from 'react';
import Link from 'next/link';
import { BatchApi, selectUnitTab, unitTabCounts, unitTabFloors, unitTabHighlight, useBatchVersion } from '@/features/batch/lib';
import { tabCount, unitTab } from '../ui/styles';

export default function UnitTabs({ kind }: { kind: 'plan' | 'card' }) {
  useBatchVersion();
  const card = kind === 'card',
    group = card ? 'batchCard' : 'batchPlan',
    view = card ? 'cards' : 'batch';
  const counts = unitTabCounts(view);
  const tabs: { key: string | null; label: string; title?: string }[] = [];
  if (BatchApi.has('menus.' + group + '.all')) tabs.push({ key: null, label: 'All Orders' });
  for (const floor of unitTabFloors(group)) tabs.push({ key: floor.key, label: floor.label, title: floor.label });

  return (
    <nav
      className={tabs.length ? 'mt-3 flex flex-wrap gap-1.5' : 'hidden'}
      id="unitTabs"
      aria-label={card ? 'Batch Card units' : 'Batch Plan units'}
    >
      {tabs.map((tab) => {
        const route = kind + (tab.key ? '/' + tab.key : '');
        const highlight = unitTabHighlight(view, tab.key);
        return (
          <Link
            key={route}
            href={'/batch/' + route}
            className={unitTab(highlight || 'idle')}
            title={tab.title}
            replace
            scroll={false}
            prefetch={false}
            onNavigate={(event) => {
              event.preventDefault();
              selectUnitTab(view, tab.key);
            }}
          >
            {tab.label} <span className={tabCount(highlight === 'active')}>{counts[tab.key || ''] || 0}</span>
          </Link>
        );
      })}
    </nav>
  );
}
