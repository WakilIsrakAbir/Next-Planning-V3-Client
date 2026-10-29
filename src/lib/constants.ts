export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface IDepartmentConfig {
  key: string;
  name: string;
  color: string;
  saveActionKey: string;
  actualSaveKey: string;
}

export const DEPARTMENTS: Record<string, IDepartmentConfig> = {
  yd: {
    key: 'yd',
    name: 'YD Plan',
    color: '#0284c7', // Sky Blue
    saveActionKey: 'saveYD',
    actualSaveKey: 'saveActualYD',
  },
  knitting: {
    key: 'knitting',
    name: 'Knitting Plan',
    color: '#10b981', // Emerald Green
    saveActionKey: 'saveKnitting',
    actualSaveKey: 'saveActualKnitting',
  },
  dyeing: {
    key: 'dyeing',
    name: 'Dyeing Plan',
    color: '#8b5cf6', // Violet
    saveActionKey: 'saveDyeing',
    actualSaveKey: 'saveActualDyeing',
  },
  finishing: {
    key: 'finishing',
    name: 'Finishing Plan',
    color: '#f59e0b', // Amber
    saveActionKey: 'saveFinishing',
    actualSaveKey: 'saveActualFinishing',
  },
  delivery: {
    key: 'delivery',
    name: 'Delivery Plan',
    color: '#ec4899', // Pink
    saveActionKey: 'saveDelivery',
    actualSaveKey: 'saveActualDelivery',
  },
};

/* Department keys of the department routes (the sidebar's links). Each route is prerendered for its keys
   (generateStaticParams), so the pages come from the CDN and the sidebar prefetches them in full: a click
   opens the page without waiting for the server. Other keys still render on request, as before. */
export const PLAN_DEPT_KEYS = Object.keys(DEPARTMENTS); // /planning, /reports
export const TRACKING_DEPT_KEYS = [...PLAN_DEPT_KEYS, 'deliveryfloor']; // /tracking, /tracking-report
export const FILTER_DEPT_KEYS = ['yd', 'knitting', 'dyeing', 'delivery', 'deliveryfloor']; // /plan-filter, /tracking-filter

/** generateStaticParams of a /<route>/[dept] page. */
export const deptParams = (keys: string[]) => keys.map((dept) => ({ dept }));

export const STATUS_COLORS: Record<string, string> = {
  Pending: 'badge-warning',
  Tentative: 'badge-accent',
  Confirm: 'badge-success',
  Completed: 'badge-neutral',
};
