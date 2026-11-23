import { apiClient } from '@/lib/api-client';
import type { PermissionItem } from '@/features/management/users/types';

export const ALL_ORDERS_ITEM: PermissionItem = ['all', 'All Orders'];
// The demo's five floors: the Batch Plan / Batch Card unit switches until (or if never) the server lists its units.
export const STATIC_BATCH_UNIT_ITEMS: PermissionItem[] = [
  ['efl', 'EFL'],
  ['ekl', 'EKL'],
  ['ext', 'Ext'],
  ['pluvia', 'Pluvia'],
  ['outside', 'Outside'],
];
export const BATCH_UNIT_GROUP_KEYS = new Set(['batchPlan', 'batchCard']);
export const UNIT_PERMISSION_KEY = /^[a-z0-9]{1,40}$/;

/* Plan section 16.3: Batch Plan and Batch Card permissions have one switch per Dyeing Plan unit
   (Dropdown Master Setup units plus the units used in Batch Plan). A unit's key is made exactly as the
   server's unitKey (src/lib/batch/source.ts) does, in small letters: the demo's five floors keep their keys. */
export const BATCH_LEGACY_UNIT_ALIASES: Record<string, string[]> = {
  EFL: ['EFL', 'EFL Floor', 'Epyllion Fabrics Limited'],
  EKL: ['EKL', 'EKL Floor', 'Epyllion Knitex Limited'],
  EXT: ['Ext', 'Ext Floor', 'EFL-Ext', 'EFL Ext', 'Extension', 'Extension Floor'],
  PLUVIA: ['Pluvia', 'Pluvia Wash', 'Pluvia Washing'],
  OUTSIDE: [
    'Outside',
    'Outside Dyeing',
    'Outside Dyeing Floor',
    'Out Side',
    'Out Side Dyeing',
    'Outsource',
    'Outsourcing',
    'Subcontract',
    'Subcontract Dyeing',
  ],
};
const BATCH_NO_UNIT_TEXTS = new Set(['-', 'n/a', 'na', 'select', 'null', 'undefined', 'none', '0']);

function batchUnitPermissionKey(name: unknown): string {
  const text = String(name ?? '').trim();
  if (!text || text.includes('+') || BATCH_NO_UNIT_TEXTS.has(text.toLowerCase())) return '';
  const key = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!key || key === 'ALL') return '';
  for (const [floor, aliases] of Object.entries(BATCH_LEGACY_UNIT_ALIASES)) {
    if (aliases.some((alias) => alias.toUpperCase().replace(/[^A-Z0-9]/g, '') === key)) return floor.toLowerCase();
  }
  return key.slice(0, 40).toLowerCase();
}

/* The unit switches for Batch Plan / Batch Card: Dropdown Master units, then the units from
   GET /api/batch/units, then the demo's five floors (so an old tick such as pluvia can still be removed).
   null when neither list loads: the page then keeps the static five floors. */
export async function loadBatchUnitItems(): Promise<PermissionItem[] | null> {
  if (typeof window === 'undefined' || !localStorage.getItem('token')) return null;
  const units = new Map<string, string>();
  const add = (key: string, label: unknown) => {
    if (!UNIT_PERMISSION_KEY.test(key) || key === 'all' || units.has(key)) return;
    units.set(key, String(label || '').replace(/[<>&"'`]/g, '').trim() || key.toUpperCase());
  };
  const [dropdowns, batchUnits] = await Promise.allSettled([
    apiClient<{ units?: { name?: unknown }[] }>('/api/dropdowns'),
    apiClient<{ units?: { key?: unknown; label?: unknown }[] }>('/api/batch/units'),
  ]);
  if (dropdowns.status === 'fulfilled') {
    (Array.isArray(dropdowns.value?.units) ? dropdowns.value.units : []).forEach((u) =>
      add(batchUnitPermissionKey(u?.name), u?.name)
    );
  } else {
    console.warn('Dropdown units not loaded:', dropdowns.reason);
  }
  if (batchUnits.status === 'fulfilled') {
    (Array.isArray(batchUnits.value?.units) ? batchUnits.value.units : []).forEach((u) =>
      add(String(u?.key || '').toLowerCase(), u?.label)
    );
  } else {
    console.warn('Batch units not loaded:', batchUnits.reason);
  }
  if (!units.size) return null;
  STATIC_BATCH_UNIT_ITEMS.forEach(([key, label]) => add(key, label));
  return Array.from(units, ([key, label]): PermissionItem => [key, label]);
}
