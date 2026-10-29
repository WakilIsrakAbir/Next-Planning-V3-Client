// ==========================================================
// Shared helpers for the Plan Filter and Plan Vs Actual Tracking Filter pages
// (Unit multi-select filter, ported from the legacy plan-filter.js /
// plan-vs-actual-tracking-filter.js).
// ==========================================================

import { API_BASE } from '@/lib/constants';

/** Unit tokens that are placeholders rather than real units. */
const INVALID_UNIT_TOKENS = new Set(['', '-', 'n/a', 'select', 'null', 'undefined']);

/** Units the legacy app falls back to when the dropdown master cannot be loaded. */
export const DEFAULT_MASTER_UNITS = ['EFL', 'EKL', 'Ext', 'Outside'];

/** Splits a "+"-joined value (e.g. "EFL+EKL") into trimmed, non-empty parts. */
export function splitPlusParts(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  return String(value)
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isRealUnitToken(part: string): boolean {
  return !INVALID_UNIT_TOKENS.has(part.toLowerCase());
}

/**
 * Builds the sorted, de-duplicated list of Unit options.
 * `masterUnits` are added as-is (legacy: ACTIVE dropdown-master units);
 * row values are split on "+" and placeholder tokens are dropped.
 */
export function buildUnitOptions(rowUnits: unknown[], masterUnits: string[] = []): string[] {
  const set = new Set<string>();
  masterUnits.forEach((u) => {
    const name = String(u ?? '').trim();
    if (name) set.add(name);
  });
  rowUnits.forEach((value) => {
    splitPlusParts(value).forEach((part) => {
      if (isRealUnitToken(part)) set.add(part);
    });
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Returns a predicate telling whether a row's (possibly "+"-joined) unit value
 * matches any selected unit, case-insensitively. An empty selection means
 * "All Units" and matches every row.
 */
export function createUnitMatcher(selectedUnits: string[]): (rowUnit: unknown) => boolean {
  if (selectedUnits.length === 0) return () => true;
  const wanted = new Set(selectedUnits.map((u) => u.toLowerCase()));
  return (rowUnit) => splitPlusParts(rowUnit).some((part) => wanted.has(part.toLowerCase()));
}

/** Button label for the Unit multi-select (legacy updatePfUnitLabel / refreshPvatfUnitLabel). */
export function formatUnitLabel(selectedUnits: string[]): string {
  if (selectedUnits.length === 0) return 'All Units';
  if (selectedUnits.length <= 2) return selectedUnits.join(', ');
  return `${selectedUnits.length} Units Selected`;
}

/** Tooltip / preview-meta text for the selected units. */
export function formatUnitList(selectedUnits: string[]): string {
  return selectedUnits.length ? selectedUnits.join(', ') : 'All Units';
}

interface DropdownMasterEntry {
  name?: unknown;
  status?: unknown;
}

/**
 * Loads the names of ACTIVE units from the dropdown master (`GET /api/dropdowns`).
 * Falls back to the legacy default units when the request fails.
 */
export async function fetchActiveMasterUnits(): Promise<string[]> {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/api/dropdowns`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return DEFAULT_MASTER_UNITS;
    const data = (await res.json()) as { units?: DropdownMasterEntry[] };
    const units = Array.isArray(data.units) ? data.units : [];
    return units
      .filter((u) => u && u.status === 'ACTIVE' && u.name)
      .map((u) => String(u.name).trim())
      .filter(Boolean);
  } catch {
    return DEFAULT_MASTER_UNITS;
  }
}

interface UnitSourceItem {
  itemData?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Client-side fallback that derives "+"-joined Unit and Process Name values
 * from an order's dyeing items (legacy extractPvatfUnitAndProcess).
 */
export function extractUnitAndProcess(items: unknown): { unit: string; processName: string } {
  if (!Array.isArray(items)) return { unit: '', processName: '' };

  const units: string[] = [];
  const processes: string[] = [];

  items.forEach((raw) => {
    if (!raw || typeof raw !== 'object') return;
    const it = raw as UnitSourceItem;
    const d: Record<string, unknown> = it.itemData || it;

    const u =
      d.Unit !== undefined && d.Unit !== null
        ? String(d.Unit).trim()
        : it.Unit !== undefined && it.Unit !== null
          ? String(it.Unit).trim()
          : '';
    splitPlusParts(u).forEach((part) => {
      if (isRealUnitToken(part) && !units.includes(part)) units.push(part);
    });

    const p =
      d.ProcessName || d['Process Name'] || d.Process || it.ProcessName || it['Process Name'] || '';
    splitPlusParts(String(p).trim()).forEach((part) => {
      if (isRealUnitToken(part) && !processes.includes(part)) processes.push(part);
    });
  });

  return { unit: units.join('+'), processName: processes.join('+') };
}
