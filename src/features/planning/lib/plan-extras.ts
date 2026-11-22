import type { Loose } from '@/features/planning/lib/order-plan-logic';

/*
 * US-11: item-wise dates kept OUTSIDE the plan rows, in OrderDate.planExtras.<dept>.<itemId> (a V2 save rebuilds every
 * plan row from a fixed key list and would delete them). The page holds them as row fields of the draft rows, so they
 * take part in dirty detection, Discard, the backup and the conflict rules like every other field, but they are never
 * part of the fabricItems payload (formatPlanPayload is unchanged): a save sends them as `plans[i].extras`.
 * No validation reads them, and Row 1 does not copy them to the rows below.
 */

/** The extra date fields of each department (only Knitting and Dyeing have them). */
export const EXTRA_FIELDS: Record<string, string[]> = {
  knitting: ['actualYarnDate'],
  dyeing: ['ldPlanDate', 'actualLdDate'],
};

export const extraFieldsOf = (dept: string): string[] => EXTRA_FIELDS[dept] || [];

export type PlanExtras = Record<string, Record<string, string>>;

/** The saved extras of a department: planData.planExtras.<dept> (an object keyed by itemId). */
export function savedExtras(planData: Loose, dept: string): PlanExtras {
  const all = planData && typeof planData === 'object' ? planData.planExtras : null;
  const map = all && typeof all === 'object' ? all[dept] : null;
  return map && typeof map === 'object' ? (map as PlanExtras) : {};
}

/**
 * The rows with the department's saved extras merged in by itemId. A row without saved extras keeps its identity
 * (an unset field reads as '' everywhere: dirty detection, inputs and the payload).
 */
export function withSavedExtras(rows: Loose[], planData: Loose, dept: string): Loose[] {
  const fields = extraFieldsOf(dept);
  if (fields.length === 0) return rows;
  const saved = savedExtras(planData, dept);
  return rows.map((row) => {
    const extra = row && row.itemId !== undefined ? saved[String(row.itemId)] : undefined;
    if (!extra || typeof extra !== 'object') return row;
    const next = { ...row };
    fields.forEach((f) => {
      if (typeof extra[f] === 'string') next[f] = extra[f];
    });
    return next;
  });
}

/** `plans[i].extras` of a save: the full map of every row's extra fields ('' for an empty one), or undefined. */
export function extrasPayload(dept: string, rows: Loose[]): PlanExtras | undefined {
  const fields = extraFieldsOf(dept);
  if (fields.length === 0) return undefined;
  const out: PlanExtras = {};
  rows.forEach((row) => {
    if (!row || row.itemId === undefined || row.itemId === null) return;
    const entry: Record<string, string> = {};
    fields.forEach((f) => {
      const v = row[f];
      entry[f] = typeof v === 'string' ? v : '';
    });
    out[String(row.itemId)] = entry;
  });
  return out;
}

const isBlankDate = (v: unknown): boolean => {
  if (v === undefined || v === null) return true;
  const s = String(v).trim();
  return s === '' || s === '-' || s === '—' || s === 'N/A' || s === 'undefined';
};

const toLocalDate = (v: unknown): Date => {
  const s = String(v).trim();
  return new Date(s.includes('T') ? s : `${s}T00:00:00`);
};

/**
 * Whole days from `earlier` to `later` in local dates (as calcPPILeadDay): a plain number, negative allowed.
 * Blank ('') when either date is missing or not a date.
 */
export function dayDiff(earlier: unknown, later: unknown): string {
  if (isBlankDate(earlier) || isBlankDate(later)) return '';
  const a = toLocalDate(earlier);
  const b = toLocalDate(later);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return '';
  return String(Math.round((b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0)) / 86400000));
}

/** Y-KS of a Knitting row: Knitting Start − Actual Yarn Date, or − Yarn Date when Actual Yarn Date is empty. */
export function yarnToKnitStart(row: Loose): string {
  const yarn = isBlankDate(row?.actualYarnDate) ? row?.yarnDate : row?.actualYarnDate;
  return dayDiff(yarn, row?.startDate);
}
