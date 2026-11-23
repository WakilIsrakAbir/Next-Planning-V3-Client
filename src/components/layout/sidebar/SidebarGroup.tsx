'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { prefetchOrderManagement } from '@/features/planning/lib/planning-cache';
import type { MenuGroupDef, MenuItemDef } from './sidebar-menu';
import SidebarLink from './SidebarLink';

/** What a group needs from the Sidebar to draw its links (active state, permissions, hrefs, clicks). */
export interface SidebarNav {
  isEntryActive: (item: MenuItemDef) => boolean;
  isMenuItemAllowed: (groupKey: string, item: MenuItemDef) => boolean;
  itemHref: (item: MenuItemDef) => string;
  onItemClick: (item: MenuItemDef) => void;
  openSubGroups: Record<string, boolean>;
  onToggleSubGroup: (key: string) => void;
}

interface SidebarGroupProps {
  group: MenuGroupDef;
  allowedItems: MenuItemDef[];
  isExpanded: boolean;
  hasActiveChild: boolean;
  onToggle: () => void;
  nav: SidebarNav;
}

/** A collapsible menu group (Data Management, Order Management, ...) with its allowed items. */
export default function SidebarGroup({ group, allowedItems, isExpanded, hasActiveChild, onToggle, nav }: SidebarGroupProps) {
  const renderLink = (item: MenuItemDef) => (
    <SidebarLink key={item.key} item={item} href={nav.itemHref(item)} active={nav.isEntryActive(item)} onItemClick={nav.onItemClick} />
  );

  return (
    <div
      className="rounded-lg overflow-hidden"
      onMouseEnter={() => {
        if (group.key === 'orderManagement') prefetchOrderManagement();
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between px-3 py-2 text-xs font-extrabold rounded-lg transition-colors ${
          hasActiveChild
            ? 'bg-base-200/80 text-primary dark:text-emerald-400'
            : 'text-base-content/80 hover:bg-base-200'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={hasActiveChild ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'}>
            {group.icon}
          </span>
          <span className={`truncate ${hasActiveChild ? 'font-black text-emerald-700 dark:text-emerald-300' : ''}`}>
            {group.title}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 opacity-60 shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="pl-4 pr-1 py-1 space-y-0.5 border-l-2 border-base-300 ml-4 my-1">
          {allowedItems.map((item) => {
            if (!item.children) return renderLink(item);

            // Sub-group: Data Management › Setup, Report › Batch Report
            const subKey = group.key + '.' + item.key;
            const subOpen = nav.openSubGroups[subKey] ?? false;
            const subActive = nav.isEntryActive(item);
            const allowedChildren = item.children.filter((child) => nav.isMenuItemAllowed(group.key, child));
            return (
              <div key={item.key}>
                <button
                  type="button"
                  onClick={() => nav.onToggleSubGroup(subKey)}
                  className={`flex w-full items-center justify-between px-3 py-1.5 rounded-md text-[11px] transition-all border-l-[3px] border-transparent hover:bg-base-200 ${
                    subActive ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-base-content/70 hover:text-base-content font-medium'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {subOpen ? (
                    <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 opacity-60 shrink-0" />
                  )}
                </button>
                {subOpen && (
                  <div className="pl-3 py-0.5 space-y-0.5 border-l-2 border-base-300 ml-3 my-0.5">
                    {allowedChildren.map((child) => renderLink(child))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
