'use client';

/* Unit tabs under the page heading (old #unitTabs, renderUnitTabs / highlightUnitTabs / updateFloorMenuCounts):
   All Orders (all-orders permission only) and one tab per unit the user may open, with the order counts.
   Batch Plan counts orders per unit; Batch Card counts confirmed scopes per unit. The open unit is
   highlighted; while the all-units search is on it is only marked lightly ('searching').
   Each tab is a link to /batch/<kind>[/<UNIT>]; a plain click opens the unit at once and replaces the URL
   (old unitTabs click listener), a middle click / Ctrl+click opens it in a new tab.
   variant 'list': the first row of the Batch Plan register's top part, in the plan lists' look (listUnitTab);
   'heading' (Batch Card) keeps the heading tabs. The open Batch Plan report shows no unit tabs. */
import React from 'react';
import Link from 'next/link';
import { BatchApi, selectUnitTab, unitTabCounts, unitTabFloors, unitTabHighlight, useBatchVersion } from '@/features/batch/lib';
import { listUnitCount, listUnitTab, tabCount, unitTab } from '../ui/styles';

export default function UnitTabs({ kind, variant = 'heading' }: { kind: 'plan' | 'card'; variant?: 'heading' | 'list' }) {
  useBatchVersion();
  const card = kind === 'card',
    group = card ? 'batchCard' : 'batchPlan',
    view = card ? 'cards' : 'batch';
  const list = variant === 'list';
  const counts = unitTabCounts(view);
  const tabs: { key: string | null; label: string; title?: string }[] = [];
  if (BatchApi.has('menus.' + group + '.all')) tabs.push({ key: null, label: 'All Orders' });
  for (const floor of unitTabFloors(group)) tabs.push({ key: floor.key, label: floor.label, title: floor.label });

  return (
    <nav
      className={
        !tabs.length
          ? 'hidden'
          : list
            ? 'flex flex-wrap gap-x-1 border-0 border-b border-solid border-gray-200 dark:border-[#2a3346]'
            : 'mt-3 flex flex-wrap gap-1.5'
      }
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
            className={list ? listUnitTab(highlight || 'idle') : unitTab(highlight || 'idle')}
            title={tab.title}
            replace
            scroll={false}
            prefetch={false}
            onNavigate={(event) => {
              event.preventDefault();
              selectUnitTab(view, tab.key);
            }}
          >
            {tab.label} <span className={list ? listUnitCount(highlight === 'active') : tabCount(highlight === 'active')}>{counts[tab.key || ''] || 0}</span>
          </Link>
        );
      })}
    </nav>
  );
}
