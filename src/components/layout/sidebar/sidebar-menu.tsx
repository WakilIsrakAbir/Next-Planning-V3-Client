import React from 'react';
import {
  Database,
  Box,
  BarChart3,
  Filter,
  Scale,
  FileSpreadsheet,
  FileCheck,
  Calculator,
  UserCog,
} from 'lucide-react';

/* The Sidebar menu: groups, items and the permission each item needs (rendered by Sidebar / SidebarGroup). */

export interface MenuItemDef {
  key: string;
  label: string;
  href: string;
  /* Permission when it is not menus.<group key>.<item key>: menus.<group>.<key>, or any permission of
     menus.<group> when key is left out (Batch Plan / Batch Card: the unit permissions are not a fixed list). */
  perm?: { group: string; key?: string };
  /* Used when the user's permissions have no value for the item's own key (a key added later, e.g. deliveryFloor). */
  fallbackKey?: string;
  // Batch module route ('plan', 'card', 'setup/dyeing', ...): the href follows the unit opened last.
  batchRoute?: string;
  // The item is active for every path under this prefix (e.g. all Batch Plan unit pages).
  activePrefix?: string;
  // A collapsible sub-group (old project: Data Management › Setup, Report › Batch Report).
  children?: MenuItemDef[];
}

export interface MenuGroupDef {
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
      // Database health and the backup download (permission menus.dataManagement.atlasMonitor)
      { key: 'atlasMonitor', label: 'Atlas Monitor', href: '/management/atlas-monitor' },
      // Criteria of the order page's Checkpoint & Planning Guide (permission menus.dataManagement.planCheckList)
      { key: 'planCheckList', label: 'Plan Check List', href: '/management/plan-check-list' },
      {
        key: 'setupGroup',
        label: 'Setup',
        href: '',
        children: [
          { key: 'setup', label: 'Dropdown Master Setup', href: '/management/setup/dropdowns' },
          // Batch Plan module Setup pages (BatchProvider; Batch routes setup/<panel>, batch-navigation BATCH_SETUP_PATHS)
          { key: 'dyeingMc', label: 'Dyeing MC', href: '/management/setup/dyeing-mc', batchRoute: 'setup/dyeing' },
          { key: 'flatAllowance', label: 'Flat Allowance', href: '/management/setup/flat-allowance', batchRoute: 'setup/flat' },
          { key: 'unitSetup', label: 'Unit Setup', href: '/management/setup/unit', batchRoute: 'setup/unit' },
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
      // US-11: Delivery Plan split into Floor and Lock; a user without the new keys keeps the old `delivery` one.
      { key: 'deliveryFloor', label: 'Delivery Plan (Floor)', href: '/planning/deliveryfloor', fallbackKey: 'delivery' },
      { key: 'deliveryLock', label: 'Delivery Plan (Lock)', href: '/planning/deliverylock', fallbackKey: 'delivery' },
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
      // US-12: the Delivery report split into Floor and Lock (as the US-11 Order Management menus); a user without the
      // new keys keeps the old `delivery` one. /reports/delivery keeps working.
      { key: 'deliveryFloor', label: 'Updated Delivery Plan (Floor) Report', href: '/reports/deliveryfloor', fallbackKey: 'delivery' },
      { key: 'deliveryLock', label: 'Updated Delivery Plan (Lock) Report', href: '/reports/deliverylock', fallbackKey: 'delivery' },
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

