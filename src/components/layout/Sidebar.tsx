'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Database,
  Box,
  BarChart3,
  Filter,
  Scale,
  FileSpreadsheet,
  FileCheck,
  Calculator,
  UserCog,
  ChevronDown,
  ChevronRight,
  User,
  Menu,
  LogOut,
} from 'lucide-react';
import { IUser } from '@/types/user';
import { prefetchOrderManagement } from '@/lib/planning-cache';
import { batchMenuRoute, requestBatchRoute } from '@/lib/batch-module';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onCloseMobile: () => void;
}

interface MenuItemDef {
  key: string;
  label: string;
  href: string;
  /* Permission when it is not menus.<group key>.<item key>: menus.<group>.<key>, or any permission of
     menus.<group> when key is left out (Batch Plan / Batch Card: the unit permissions are not a fixed list). */
  perm?: { group: string; key?: string };
  // Batch module route ('plan', 'card', 'setup/dyeing', ...): the href follows the unit opened last.
  batchRoute?: string;
  // The item is active for every path under this prefix (e.g. all Batch Plan unit pages).
  activePrefix?: string;
  // A collapsible sub-group (old project: Data Management › Setup, Report › Batch Report).
  children?: MenuItemDef[];
}

interface MenuGroupDef {
  key: string;
  title: string;
  icon: React.ReactNode;
  items: MenuItemDef[];
}

export const SIDEBAR_MENU_GROUPS: MenuGroupDef[] = [
  {
    key: 'dataManagement',
    title: 'Data Management',
    icon: <Database className="h-4 w-4" />,
    items: [
      { key: 'view', label: 'Source File Upload', href: '/management/upload' },
      {
        key: 'setupGroup',
        label: 'Setup',
        href: '',
        children: [
          { key: 'setup', label: 'Dropdown Master Setup', href: '/management/setup' },
          // Batch Plan module Setup pages
          { key: 'dyeingMc', label: 'Dyeing MC', href: '/batch/setup/dyeing', batchRoute: 'setup/dyeing' },
          { key: 'flatAllowance', label: 'Flat Allowance', href: '/batch/setup/flat', batchRoute: 'setup/flat' },
          { key: 'unitSetup', label: 'Unit Setup', href: '/batch/setup/unit', batchRoute: 'setup/unit' },
        ],
      },
    ],
  },
  {
    key: 'orderManagement',
    title: 'Order Management',
    icon: <Box className="h-4 w-4" />,
    items: [
      { key: 'yd', label: 'YD Plan', href: '/planning/yd' },
      { key: 'knitting', label: 'Knitting Plan', href: '/planning/knitting' },
      { key: 'dyeing', label: 'Dyeing Plan', href: '/planning/dyeing' },
      { key: 'finishing', label: 'Finishing Plan', href: '/planning/finishing' },
      { key: 'delivery', label: 'Delivery Plan', href: '/planning/delivery' },
      // Batch Plan module: the Dyeing Plan units are tabs in the heading of the Batch page, so these
      // items have no submenu; they open the unit used last.
      {
        key: 'batchPlan',
        label: 'Batch Plan',
        href: '/batch/plan',
        perm: { group: 'batchPlan' },
        batchRoute: 'plan',
        activePrefix: '/batch/plan',
      },
      {
        key: 'batchCard',
        label: 'Batch Card',
        href: '/batch/card',
        perm: { group: 'batchCard' },
        batchRoute: 'card',
        activePrefix: '/batch/card',
      },
    ],
  },
  {
    key: 'reports',
    title: 'Report',
    icon: <BarChart3 className="h-4 w-4" />,
    items: [
      { key: 'yd', label: 'Updated YD Report', href: '/reports/yd' },
      { key: 'knitting', label: 'Updated Knitting Report', href: '/reports/knitting' },
      { key: 'dyeing', label: 'Updated Dyeing Report', href: '/reports/dyeing' },
      { key: 'finishing', label: 'Updated Finishing Report', href: '/reports/finishing' },
      { key: 'delivery', label: 'Updated Delivery Report', href: '/reports/delivery' },
      { key: 'orderStatus', label: 'Order Status', href: '/reports/order-status' },
      { key: 'productInfo', label: 'Product Info', href: '/reports/product-info' },
      { key: 'planningProdInfo', label: 'Planning & Production Info', href: '/reports/planning-prod-info' },
      {
        key: 'batchReportGroup',
        label: 'Batch Report',
        href: '',
        children: [
          {
            key: 'dyeableBatch',
            label: 'Dyeable Batch',
            href: '/batch/report/detail',
            perm: { group: 'batchReport', key: 'dyeableBatch' },
            batchRoute: 'report/detail',
          },
          {
            key: 'dyeableSummary',
            label: 'Dyeable Batch Summary',
            href: '/batch/report/summary',
            perm: { group: 'batchReport', key: 'dyeableSummary' },
            batchRoute: 'report/summary',
          },
          {
            key: 'dailyConfirm',
            label: 'Daily Confirm Batch Plan',
            href: '/batch/report/daily',
            perm: { group: 'batchReport', key: 'dailyConfirm' },
            batchRoute: 'report/daily',
          },
        ],
      },
    ],
  },
  {
    key: 'planFilter',
    title: 'Plan Filter',
    icon: <Filter className="h-4 w-4" />,
    items: [
      { key: 'yd', label: 'YD Plan Filter', href: '/plan-filter/yd' },
      { key: 'knitting', label: 'Knitting Plan Filter', href: '/plan-filter/knitting' },
      { key: 'dyeing', label: 'Dyeing Plan Filter', href: '/plan-filter/dyeing' },
      { key: 'delivery', label: 'Delivery Plan Filter', href: '/plan-filter/delivery' },
      { key: 'deliveryfloor', label: 'Delivery Plan (Floor) Filter', href: '/plan-filter/deliveryfloor' },
    ],
  },
  {
    key: 'actualTracking',
    title: 'Plan Vs Actual Tracking',
    icon: <Scale className="h-4 w-4" />,
    items: [
      { key: 'yd', label: 'YD', href: '/tracking/yd' },
      { key: 'knitting', label: 'Knitting', href: '/tracking/knitting' },
      { key: 'dyeing', label: 'Dyeing', href: '/tracking/dyeing' },
      { key: 'finishing', label: 'Finishing', href: '/tracking/finishing' },
      { key: 'delivery', label: 'Delivery', href: '/tracking/delivery' },
      { key: 'deliveryfloor', label: 'Delivery (Floor)', href: '/tracking/deliveryfloor' },
    ],
  },
  {
    key: 'trackingReports',
    title: 'Tracking Report',
    icon: <FileSpreadsheet className="h-4 w-4" />,
    items: [
      { key: 'yd', label: 'YD', href: '/tracking-report/yd' },
      { key: 'knitting', label: 'Knitting', href: '/tracking-report/knitting' },
      { key: 'dyeing', label: 'Dyeing', href: '/tracking-report/dyeing' },
      { key: 'finishing', label: 'Finishing', href: '/tracking-report/finishing' },
      { key: 'delivery', label: 'Delivery', href: '/tracking-report/delivery' },
      { key: 'deliveryfloor', label: 'Delivery (Floor)', href: '/tracking-report/deliveryfloor' },
    ],
  },
  {
    key: 'planTrackingFilter',
    title: 'Plan Vs Actual Tracking Filter',
    icon: <FileCheck className="h-4 w-4" />,
    items: [
      { key: 'yd', label: 'YD Plan Tracking Filter', href: '/tracking-filter/yd' },
      { key: 'knitting', label: 'Knitting Plan Tracking Filter', href: '/tracking-filter/knitting' },
      { key: 'dyeing', label: 'Dyeing Plan Tracking Filter', href: '/tracking-filter/dyeing' },
      { key: 'delivery', label: 'Delivery Plan Tracking Filter', href: '/tracking-filter/delivery' },
      { key: 'deliveryfloor', label: 'Delivery Plan (Floor) Tracking Filter', href: '/tracking-filter/deliveryfloor' },
    ],
  },
  {
    key: 'loadCalculation',
    title: 'Load Calculation',
    icon: <Calculator className="h-4 w-4" />,
    items: [
      { key: 'detailed', label: 'Detailed Load Download', href: '/load-calc?tab=detailed' },
      { key: 'summary', label: 'Buyer-wise Load Summary', href: '/load-calc?tab=summary' },
    ],
  },
  {
    key: 'manageUsers',
    title: 'Manage Users',
    icon: <UserCog className="h-4 w-4" />,
    items: [
      { key: 'view', label: 'Manage Users', href: '/management/users' },
    ],
  },
];

export default function Sidebar({ isOpen, onToggle, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<IUser | null>(null);

  // Accordion state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    dataManagement: true,
    orderManagement: true,
    reports: false,
    planFilter: false,
    actualTracking: false,
    trackingReports: false,
    planTrackingFilter: false,
    loadCalculation: false,
    manageUsers: false,
  });

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
    // Direct menu permission
    return menu[item.perm?.key || item.key] === true;
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

  const handleItemClick = (item: MenuItemDef) => {
    handleNavClick();
    // A click on the Batch page that is already open re-opens it there (BatchModuleHost).
    if (item.batchRoute) requestBatchRoute(itemHref(item).replace(/^\/batch\//, ''));
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
          <Link href="/dashboard" onClick={handleNavClick} className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-content font-black text-sm shadow-md shadow-primary/20 shrink-0">
              EP
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-sm tracking-tight text-primary block truncate">Textile Planning Solution</span>
              <p className="text-[10px] text-base-content/60 leading-none truncate">Next Planning V3 • Epylion</p>
            </div>
          </Link>
        </div>

        {/* User Profile Bar (matching Exp index.html lines 479-488) */}
        <div className="py-2 px-3 border-b border-base-300 flex items-center justify-between bg-base-200/50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm shadow-emerald-600/20">
              {(currentUser?.username || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold block truncate text-base-content">
                {currentUser?.username || 'Loading...'}
              </span>
              <span className="text-[10px] text-base-content/60 block truncate font-medium">
                {currentUser?.role || 'Planner'}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              localStorage.removeItem('username');
              localStorage.removeItem('role');
              localStorage.removeItem('permissions');
              localStorage.removeItem('status');
              localStorage.removeItem('sessionExpiresAt');
              window.location.href = '/login';
            }}
            className="btn btn-ghost btn-circle btn-xs text-error hover:bg-error/10 shrink-0"
            title="Sign Out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar space-y-1">
          {/* Dashboard Home */}
          <Link
            href="/dashboard"
            onClick={handleNavClick}
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

            const renderLink = (item: MenuItemDef) => {
              const active = isEntryActive(item);
              return (
                <Link
                  key={item.key}
                  href={itemHref(item)}
                  onClick={() => handleItemClick(item)}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-md text-[11px] transition-all truncate border-l-[3px] ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black border-emerald-500 shadow-xs'
                      : 'border-transparent text-base-content/70 hover:text-base-content hover:bg-base-200 font-medium'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 ml-1.5 animate-pulse" />
                  )}
                </Link>
              );
            };

            return (
              <div
                key={group.key}
                className="rounded-lg overflow-hidden"
                onMouseEnter={() => {
                  if (group.key === 'orderManagement') prefetchOrderManagement();
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleSection(group.key)}
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
                      const subOpen = openSubGroups[subKey] ?? false;
                      const subActive = isEntryActive(item);
                      const allowedChildren = item.children.filter((child) => isMenuItemAllowed(group.key, child));
                      return (
                        <div key={item.key}>
                          <button
                            type="button"
                            onClick={() => toggleSubGroup(subKey)}
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
          })}
        </div>
      </aside>
    </>
  );
}
