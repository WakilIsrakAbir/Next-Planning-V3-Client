'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { IUser } from '@/types/user';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onCloseMobile: () => void;
}

interface MenuItemDef {
  key: string;
  label: string;
  href: string;
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
      { key: 'setup', label: 'Setup (Dropdown Master)', href: '/management/setup' },
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
      if (stored) setCurrentUser(JSON.parse(stored));
    } catch {}
  }, []);

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  /**
   * Check if a specific menu item is allowed for the logged in user
   */
  const isMenuItemAllowed = (groupKey: string, itemKey: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;

    const userMenus = (currentUser.permissions as any)?.menus;
    if (!userMenus) return false;

    // Check direct menu permission
    if (userMenus[groupKey] && userMenus[groupKey][itemKey] === true) {
      return true;
    }

    return false;
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
        {/* Brand bar with hamburger collapse toggle */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-base-300 px-4">
          <Link href="/dashboard" onClick={onCloseMobile} className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-content font-black text-sm shadow-md shadow-primary/20 shrink-0">
              EP
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-sm tracking-tight text-primary block truncate">Next Planning V3</span>
              <p className="text-[10px] text-base-content/60 leading-none truncate">Epylion Manufacturing</p>
            </div>
          </Link>

          {/* Hamburger Collapse button */}
          <button
            onClick={onToggle}
            className="btn btn-ghost btn-square btn-sm text-base-content/70 hover:text-primary shrink-0"
            title="Collapse Sidebar"
            aria-label="Collapse Sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar space-y-1">
          {/* Dashboard Home */}
          <Link
            href="/dashboard"
            onClick={onCloseMobile}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
              pathname === '/dashboard'
                ? 'bg-primary text-primary-content shadow-sm'
                : 'hover:bg-base-200 text-base-content'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard Home</span>
          </Link>

          {/* Dynamic RBAC Menu Groups */}
          {SIDEBAR_MENU_GROUPS.map((group) => {
            // Filter allowed items for this user
            const allowedItems = group.items.filter((item) =>
              isMenuItemAllowed(group.key, item.key)
            );

            // Hide entire group if user has no allowed items in this category
            if (allowedItems.length === 0) return null;

            const isExpanded = openSections[group.key] ?? false;

            return (
              <div key={group.key} className="rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection(group.key)}
                  className="flex w-full items-center justify-between px-3 py-2 text-xs font-extrabold text-base-content/80 hover:bg-base-200 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-primary">{group.icon}</span>
                    <span className="truncate">{group.title}</span>
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
                      const active = pathname === item.href.split('?')[0];

                      return (
                        <Link
                          key={item.key}
                          href={item.href}
                          onClick={onCloseMobile}
                          className={`block px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors truncate ${
                            active
                              ? 'bg-primary/10 text-primary font-bold'
                              : 'text-base-content/70 hover:text-base-content hover:bg-base-200'
                          }`}
                        >
                          {item.label}
                        </Link>
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
