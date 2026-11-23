'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';
import { IUser } from '@/types/user';
import { batchMenuRoute, batchRouteFromPath, requestBatchRoute } from '@/features/batch/lib/batch-navigation';
import { guardedLinkHandlers } from '@/lib/unsaved-changes';
import { SIDEBAR_MENU_GROUPS, type MenuItemDef } from './sidebar-menu';
import SidebarGroup, { type SidebarNav } from './SidebarGroup';
import SidebarProfile from './SidebarProfile';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onCloseMobile: () => void;
}

export default function Sidebar({ isOpen, onToggle, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<IUser | null>(null);

  // Open menu groups: all closed at first; the group of the open page opens by itself (effect below).
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      } else {
        const username = localStorage.getItem('username');
        const role = localStorage.getItem('role');
        if (username) {
          setCurrentUser({
            username,
            role: (role || 'Admin') as any,
            status: (localStorage.getItem('status') || 'active') as any,
            permissions: JSON.parse(localStorage.getItem('permissions') || '{}'),
          } as any);
        }
      }
    } catch {}
  }, []);

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  /**
   * Only close mobile drawer when clicking a navigation link on mobile screen widths (< 1024px)
   */
  const handleNavClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onCloseMobile();
    }
  };

  /**
   * Check if a specific menu item is allowed for the logged in user.
   * A sub-group is shown when at least one of its items is allowed.
   */
  const isMenuItemAllowed = (groupKey: string, item: MenuItemDef): boolean => {
    if (!currentUser) return false;
    if (item.children) return item.children.some((child) => isMenuItemAllowed(groupKey, child));
    if (currentUser.role === 'Admin') return true;

    const userMenus = (currentUser.permissions as any)?.menus;
    if (!userMenus) return false;

    const menu = userMenus[item.perm?.group || groupKey];
    if (!menu) return false;
    // Any permission of the group (Batch Plan / Batch Card: All Orders or any unit).
    if (item.perm && item.perm.key === undefined) {
      return Object.values(menu).some((value) => value === true);
    }
    // Direct menu permission (a key the user's permissions do not have yet falls back to fallbackKey)
    const own = menu[item.perm?.key || item.key];
    if (own === undefined && item.fallbackKey) return menu[item.fallbackKey] === true;
    return own === true;
  };

  // Batch Plan / Batch Card open the unit used last (kept in this browser), as in the old project.
  // The sidebar renders only on the client (after the session check), so localStorage is readable here.
  const batchHrefs: Record<string, string> = useMemo(
    () => ({ plan: '/batch/' + batchMenuRoute('plan'), card: '/batch/' + batchMenuRoute('card') }),
    // The last unit changes while the user moves between Batch pages, and permissions with the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname, currentUser]
  );

  const itemHref = (item: MenuItemDef): string =>
    item.batchRoute === 'plan' || item.batchRoute === 'card' ? batchHrefs[item.batchRoute] : item.href;

  /* Every link leaves the open page. With unsaved work (src/lib/unsaved-changes.ts) it asks first, and its click
     side effects (handleNavClick, handleItemClick) run only after the user agrees; with nothing unsaved a click
     works exactly as before. */
  const handleItemClick = (item: MenuItemDef) => {
    handleNavClick();
    // A click on the Batch page that is already open re-opens it there (BatchModuleHost).
    if (item.batchRoute) requestBatchRoute(batchRouteFromPath(itemHref(item)));
  };

  const isEntryActive = (item: MenuItemDef): boolean => {
    if (item.children) return item.children.some((child) => isEntryActive(child));
    if (item.activePrefix) return pathname === item.activePrefix || pathname.startsWith(item.activePrefix + '/');
    return isItemActive(item.href);
  };

  // Collapsible sub-groups (Data Management › Setup, Report › Batch Report)
  const [openSubGroups, setOpenSubGroups] = useState<Record<string, boolean>>({});
  const toggleSubGroup = (key: string) => {
    setOpenSubGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isItemActive = (href: string): boolean => {
    if (!href) return false;
    const [path, queryStr] = href.split('?');
    if (path === '/dashboard') return pathname === '/dashboard';

    // Matches exact path or child subroutes (e.g. /planning/yd/272213 matches /planning/yd)
    const matchesPath = pathname === path || pathname.startsWith(path + '/');
    if (!matchesPath) return false;

    if (queryStr && typeof window !== 'undefined') {
      const targetTab = new URLSearchParams(queryStr).get('tab');
      const currentTab = new URLSearchParams(window.location.search).get('tab');
      if (targetTab && currentTab) {
        return targetTab === currentTab;
      }
    }

    return true;
  };

  // Automatically expand the section that contains the active route on pathname change
  useEffect(() => {
    for (const group of SIDEBAR_MENU_GROUPS) {
      const hasActive = group.items.some((item) => isEntryActive(item));
      if (hasActive) {
        setOpenSections((prev) => ({ ...prev, [group.key]: true }));
        const activeSub = group.items.find((item) => item.children && isEntryActive(item));
        if (activeSub) setOpenSubGroups((prev) => ({ ...prev, [group.key + '.' + activeSub.key]: true }));
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const nav: SidebarNav = {
    isEntryActive,
    isMenuItemAllowed,
    itemHref,
    onItemClick: handleItemClick,
    openSubGroups,
    onToggleSubGroup: toggleSubGroup,
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex h-full w-[280px] shrink-0 flex-col border-r border-base-300 bg-base-100 transition-all duration-300 ease-in-out lg:static ${
          isOpen
            ? 'translate-x-0 lg:ml-0'
            : '-translate-x-full lg:-ml-[280px]'
        }`}
      >
        {/* Brand bar (Clean, matching Exp index.html lines 472-477) */}
        <div className="flex h-16 shrink-0 items-center border-b border-base-300 px-4">
          <Link href="/dashboard" {...guardedLinkHandlers(handleNavClick)} className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-content font-black text-sm shadow-md shadow-primary/20 shrink-0">
              TP
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-sm tracking-tight text-primary block truncate">Textile Planning Solution</span>
              <p className="text-[10px] text-base-content/60 leading-none truncate">Next Planning V3</p>
            </div>
          </Link>
        </div>

        {/* User Profile Bar (matching Exp index.html lines 479-488) */}
        <SidebarProfile currentUser={currentUser} />

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar space-y-1">
          {/* Dashboard Home */}
          <Link
            href="/dashboard"
            {...guardedLinkHandlers(handleNavClick)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all border-l-[3px] ${
              pathname === '/dashboard'
                ? 'bg-primary text-primary-content border-primary shadow-sm'
                : 'border-transparent hover:bg-base-200 text-base-content'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard Home</span>
          </Link>

          {/* Dynamic RBAC Menu Groups */}
          {SIDEBAR_MENU_GROUPS.map((group) => {
            // Filter allowed items for this user
            const allowedItems = group.items.filter((item) =>
              isMenuItemAllowed(group.key, item)
            );

            // Hide entire group if user has no allowed items in this category
            if (allowedItems.length === 0) return null;

            const isExpanded = openSections[group.key] ?? false;
            const hasActiveChild = allowedItems.some((item) => isEntryActive(item));


            return (
              <SidebarGroup
                key={group.key}
                group={group}
                allowedItems={allowedItems}
                isExpanded={isExpanded}
                hasActiveChild={hasActiveChild}
                onToggle={() => toggleSection(group.key)}
                nav={nav}
              />
            );
          })}
        </div>
      </aside>
    </>
  );
}
