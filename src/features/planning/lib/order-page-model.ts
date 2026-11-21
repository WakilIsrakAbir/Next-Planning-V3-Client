import type { SetStateAction } from 'react';
import { buildMergedItems, type Loose } from '@/features/planning/lib/order-plan-logic';

/*
 * State of the universal order page (one page shows several departments' plans of one order).
 *
 * - Each department has ONE draft rows array and a draft Order Status. Delivery is shown as two sections over the same
 *   rows (Floor and Lock), so its rows carry two field groups with separate baselines.
 * - A baseline is what the department looked like after the last load or save (the merged rows), per field group.
 *   A group is dirty when its fields (and, for the status group, the status) differ from its baseline.
 * - `planData` is the SAVED plan of the order (last load or save). Every cross-department check reads it, never the
 *   other sections' drafts.
 */

export const PLAN_DEPTS = ['yd', 'knitting', 'dyeing', 'finishing', 'delivery'] as const;
export type PlanDept = (typeof PLAN_DEPTS)[number];

export type GroupKey = 'main' | 'floor' | 'lock';

export const DEPT_META: Record<string, { name: string; label: string }> = {
  knitting: { name: 'Knitting Plan', label: 'Knitting' },
  dyeing: { name: 'Dyeing Plan', label: 'Dyeing' },
  finishing: { name: 'Finishing Plan', label: 'Finishing' },
  delivery: { name: 'Delivery Plan', label: 'Delivery' },
  yd: { name: 'YD Plan', label: 'YD' },
};

export function deptMetaOf(dept: string): { name: string; label: string } {
  return DEPT_META[dept] || { name: dept.toUpperCase(), label: dept };
}

/** Delivery Floor fields and Delivery Lock fields (the Lock group also owns the delivery Order Status). */
export const FLOOR_FIELDS = ['floorStartDate', 'floorEndDate', 'floorPlanType'];
export const LOCK_FIELDS = ['startDate', 'endDate', 'planType', 'limitation', 'remarks'];
/** Every field the order page edits (the fields of a non-delivery department's single group). */
export const MAIN_FIELDS = [
  'yarnDate',
  'startDate',
  'endDate',
  'planType',
  'limitation',
  'remarks',
  'unit',
  'processName',
  'floorStartDate',
  'floorEndDate',
  'floorPlanType',
  'yarnOkDate',
  'matchingOptionDate',
  'barrierQty',
  'workableQty',
];

export function groupsOf(dept: string): GroupKey[] {
  return dept === 'delivery' ? ['floor', 'lock'] : ['main'];
}

export function groupFields(group: GroupKey): string[] {
  return group === 'floor' ? FLOOR_FIELDS : group === 'lock' ? LOCK_FIELDS : MAIN_FIELDS;
}

/** The group that owns the department's Order Status. */
export function statusGroupOf(dept: string): GroupKey {
  return dept === 'delivery' ? 'lock' : 'main';
}

/* ---------------- sections ---------------- */

export interface SectionDef {
  /** 'yd' | 'knitting' | 'dyeing' | 'finishing' | 'deliveryFloor' | 'deliveryLock' (or an unknown route department). */
  key: string;
  dept: string;
  group: GroupKey;
  /** Strip title, e.g. "Dyeing Plan" or "Delivery Plan (Floor)". */
  title: string;
  /** Unsaved-work label, e.g. "Dyeing Plan" or "Delivery Plan (Lock)". */
  saveLabel: string;
  /** The section has the department's Order Status select (delivery: Lock only). */
  hasStatus: boolean;
  /** Delivery only: the columns this table shows. */
  columns?: 'floor' | 'lock';
  /** Opened from this department's page (`/planning/<dept>/<orderNo>`). */
  isRoute: boolean;
}

function sectionDef(key: string, routeDept: string): SectionDef {
  if (key === 'deliveryFloor' || key === 'deliveryLock') {
    const floor = key === 'deliveryFloor';
    return {
      key,
      dept: 'delivery',
      group: floor ? 'floor' : 'lock',
      title: floor ? 'Delivery Plan (Floor)' : 'Delivery Plan (Lock)',
      saveLabel: floor ? 'Save Floor' : 'Save Lock',
      hasStatus: !floor,
      columns: floor ? 'floor' : 'lock',
      isRoute: routeDept === 'delivery',
    };
  }
  const meta = deptMetaOf(key);
  return { key, dept: key, group: 'main', title: meta.name, saveLabel: `Save ${meta.label}`, hasStatus: true, isRoute: routeDept === key };
}

/** Plan D2: the route department's section(s) first, then Knitting, Dyeing, Delivery Floor and Delivery Lock. */
export function sectionsFor(routeDept: string): SectionDef[] {
  const routeKeys = routeDept === 'delivery' ? ['deliveryFloor', 'deliveryLock'] : [routeDept];
  const rest = ['knitting', 'dyeing', 'deliveryFloor', 'deliveryLock'].filter((k) => !routeKeys.includes(k));
  return [...routeKeys, ...rest].map((k) => sectionDef(k, routeDept));
}

/** The departments shown on a route's page (each held once in the state). */
export function deptsFor(routeDept: string): string[] {
  const out: string[] = [];
  sectionsFor(routeDept).forEach((s) => {
    if (!out.includes(s.dept)) out.push(s.dept);
  });
  return out;
}

/* ---------------- state ---------------- */

export interface DeptDraft {
  rows: Loose[];
  status: string;
  /** Baseline rows of each field group (index-aligned with `rows`). */
  base: Partial<Record<GroupKey, Loose[]>>;
  /** Baseline of the Order Status (owned by the status group). */
  baseStatus: string;
}

export interface OrderPageModel {
  order: Loose;
  /** The saved plan (last load or save). */
  planData: Loose;
  /** Base fingerprint per department: sent with the next save of that department. */
  fingerprints: Partial<Record<string, string>>;
  deptFlags: Partial<Record<string, { inLatestFile: boolean; hasItems: boolean }>> | null;
  drafts: Record<string, DeptDraft>;
}

export interface OrderDetailInput {
  order?: Loose;
  planData?: Loose;
  fingerprints?: Partial<Record<string, string>>;
  deptFlags?: Partial<Record<string, { inLatestFile: boolean; hasItems: boolean }>>;
}

const statusOf = (planData: Loose, dept: string): string => (planData && planData[`${dept}Status`]) || 'On Process';

function cleanDraft(rows: Loose[], status: string, dept: string): DeptDraft {
  const base: Partial<Record<GroupKey, Loose[]>> = {};
  groupsOf(dept).forEach((g) => {
    base[g] = rows;
  });
  return { rows, status, base, baseStatus: status };
}

/**
 * First state: from the cached detail when there is one (rows of every department at once), else the list header
 * (no rows until the request answers), as the page always did.
 */
export function initOrderPageModel(depts: string[], cached: OrderDetailInput | null, fallbackOrder: Loose): OrderPageModel {
  const drafts: Record<string, DeptDraft> = {};
  depts.forEach((dept) => {
    const rows = cached?.order ? buildMergedItems(cached.order, cached.planData, dept) : [];
    drafts[dept] = cleanDraft(rows, statusOf(cached?.planData, dept), dept);
  });
  return {
    order: cached?.order || fallbackOrder,
    planData: cached?.planData || null,
    fingerprints: { ...(cached?.fingerprints || {}) },
    deptFlags: cached?.deptFlags || null,
    drafts,
  };
}

const norm = (v: Loose): string => (v === undefined || v === null ? '' : String(v));

function rowsDiffer(rows: Loose[], base: Loose[] | undefined, fields: string[]): boolean {
  if (rows === base) return false;
  if (!base || rows.length !== base.length) return true;
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i];
    const b = base[i];
    if (a === b) continue;
    for (const f of fields) {
      if (norm(a?.[f]) !== norm(b?.[f])) return true;
    }
  }
  return false;
}

export function isGroupDirty(draft: DeptDraft, dept: string, group: GroupKey): boolean {
  if (group === statusGroupOf(dept) && draft.status !== draft.baseStatus) return true;
  return rowsDiffer(draft.rows, draft.base[group], groupFields(group));
}

export function dirtyGroups(draft: DeptDraft, dept: string): GroupKey[] {
  return groupsOf(dept).filter((g) => isGroupDirty(draft, dept, g));
}

/** The row of `source` for `row` (same index when the item ids match, else found by item id). */
function sourceRow(source: Loose[] | undefined, row: Loose, index: number): Loose | undefined {
  if (!source) return undefined;
  const same = source[index];
  if (same && same.itemId === row?.itemId) return same;
  return source.find((r) => r && r.itemId === row?.itemId);
}

/** `rows` with `fields` taken from the matching rows of `source` (rows without a match keep their values). */
export function withFieldsFrom(rows: Loose[], source: Loose[] | undefined, fields: string[]): Loose[] {
  return rows.map((row, i) => {
    const src = sourceRow(source, row, i);
    if (!src) return row;
    const next = { ...row };
    fields.forEach((f) => {
      next[f] = src[f];
    });
    return next;
  });
}

/**
 * What a save of these groups sends (plan D3): saving one delivery group sends that group's fields from the draft and
 * the other group's fields from its baseline; the status is the draft status when the status group is saved, else
 * the baseline status.
 */
export function rowsForSave(draft: DeptDraft, dept: string, groups: GroupKey[]): { rows: Loose[]; status: string } {
  if (dept !== 'delivery' || (groups.includes('floor') && groups.includes('lock'))) {
    return { rows: draft.rows, status: draft.status };
  }
  if (groups.includes('floor')) {
    return { rows: withFieldsFrom(draft.rows, draft.base.lock, LOCK_FIELDS), status: draft.baseStatus };
  }
  return { rows: withFieldsFrom(draft.rows, draft.base.floor, FLOOR_FIELDS), status: draft.status };
}

/** True when `next` is a plan saved BEFORE the one on screen (an older read must never replace newer data). */
export function isOlderPlanData(next: Loose, current: Loose): boolean {
  const a = Date.parse(String(next?.updatedAt ?? ''));
  const b = Date.parse(String(current?.updatedAt ?? ''));
  return Number.isFinite(a) && Number.isFinite(b) && a < b;
}

/**
 * Re-merges `groups` of a department from `merged` (rows built from a newer saved plan); the other groups keep their
 * drafts and baselines.
 */
function remergeGroups(draft: DeptDraft, dept: string, groups: GroupKey[], merged: Loose[], status: string): DeptDraft {
  const all = groupsOf(dept);
  if (all.every((g) => groups.includes(g))) return cleanDraft(merged, status, dept);
  let rows = merged;
  const base = { ...draft.base };
  all.forEach((g) => {
    if (groups.includes(g)) base[g] = merged;
    else rows = withFieldsFrom(rows, draft.rows, groupFields(g));
  });
  const statusSaved = groups.includes(statusGroupOf(dept));
  return {
    rows,
    status: statusSaved ? status : draft.status,
    base,
    baseStatus: statusSaved ? status : draft.baseStatus,
  };
}

export type OrderPageAction =
  /** A detail read: every clean group is re-merged from it; dirty groups keep their drafts and old bases. */
  | { type: 'hydrate'; data: OrderDetailInput }
  | { type: 'rows'; dept: string; update: SetStateAction<Loose[]> }
  | { type: 'status'; dept: string; update: SetStateAction<string> }
  | { type: 'discard'; dept: string; group: GroupKey }
  /** A successful save: only the saved groups are re-merged from the response, and only their fingerprints adopted. */
  | {
      type: 'saved';
      saved: Array<{ dept: string; groups: GroupKey[] }>;
      planData: Loose;
      fingerprints?: Partial<Record<string, string>>;
    };

export function orderPageReducer(state: OrderPageModel, action: OrderPageAction): OrderPageModel {
  switch (action.type) {
    case 'hydrate': {
      const { data } = action;
      if (isOlderPlanData(data.planData, state.planData)) return state;
      const order = data.order || {};
      const planData = data.planData || {};
      const fingerprints = { ...state.fingerprints };
      const drafts: Record<string, DeptDraft> = {};
      Object.keys(state.drafts).forEach((dept) => {
        const draft = state.drafts[dept];
        const clean = groupsOf(dept).filter((g) => !isGroupDirty(draft, dept, g));
        if (clean.length === 0) {
          drafts[dept] = draft;
          return;
        }
        drafts[dept] = remergeGroups(draft, dept, clean, buildMergedItems(order, planData, dept), statusOf(planData, dept));
        if (clean.length === groupsOf(dept).length && data.fingerprints && data.fingerprints[dept] !== undefined) {
          fingerprints[dept] = data.fingerprints[dept];
        }
      });
      return { order, planData, fingerprints, deptFlags: data.deptFlags || null, drafts };
    }
    case 'rows': {
      const draft = state.drafts[action.dept];
      if (!draft) return state;
      const rows = typeof action.update === 'function' ? action.update(draft.rows) : action.update;
      if (rows === draft.rows) return state;
      return { ...state, drafts: { ...state.drafts, [action.dept]: { ...draft, rows } } };
    }
    case 'status': {
      const draft = state.drafts[action.dept];
      if (!draft) return state;
      const status = typeof action.update === 'function' ? action.update(draft.status) : action.update;
      if (status === draft.status) return state;
      return { ...state, drafts: { ...state.drafts, [action.dept]: { ...draft, status } } };
    }
    case 'discard': {
      const draft = state.drafts[action.dept];
      if (!draft) return state;
      const { dept, group } = action;
      const rows = group === 'main' ? draft.base.main || draft.rows : withFieldsFrom(draft.rows, draft.base[group], groupFields(group));
      const status = group === statusGroupOf(dept) ? draft.baseStatus : draft.status;
      return { ...state, drafts: { ...state.drafts, [dept]: { ...draft, rows, status } } };
    }
    case 'saved': {
      const planData = action.planData || {};
      const drafts = { ...state.drafts };
      const fingerprints = { ...state.fingerprints };
      action.saved.forEach(({ dept, groups }) => {
        const draft = drafts[dept];
        if (!draft) return;
        drafts[dept] = remergeGroups(draft, dept, groups, buildMergedItems(state.order, planData, dept), statusOf(planData, dept));
        if (action.fingerprints && action.fingerprints[dept] !== undefined) fingerprints[dept] = action.fingerprints[dept];
      });
      return { ...state, planData, fingerprints, drafts };
    }
    default:
      return state;
  }
}
