import type { SetStateAction } from 'react';
import { buildMergedItems, type Loose } from '@/features/planning/lib/order-plan-logic';
import { withSavedExtras } from '@/features/planning/order-page/lib/plan-extras';

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
  // US-11 split delivery routes (their page header; the data department stays 'delivery').
  deliveryfloor: { name: 'Delivery Plan (Floor)', label: 'Delivery Floor' },
  deliverylock: { name: 'Delivery Plan (Lock)', label: 'Delivery Lock' },
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
  // US-11: item-wise dates stored in planExtras (sent as `extras`, never in fabricItems; see plan-extras.ts).
  'actualYarnDate',
  'ldPlanDate',
  'actualLdDate',
];

/**
 * A department's rows as a read or a save answer shows them: today's buildMergedItems, with the US-11 extras
 * (planData.planExtras.<dept>) merged in by itemId.
 */
export function mergedRowsOf(order: Loose, planData: Loose, dept: string): Loose[] {
  return withSavedExtras(buildMergedItems(order, planData, dept), planData, dept);
}

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
  /** The route card's footer Save stores the whole department: only the delivery page's two tables (as today). */
  footerSavesDept: boolean;
}

/**
 * US-11: the Delivery Plan list is split into Floor (`/planning/deliveryfloor`) and Lock (`/planning/deliverylock`).
 * Their order pages read and save the same 'delivery' data; `/planning/delivery` keeps working as before.
 */
export const DELIVERY_SPLIT_ROUTES: Record<string, string> = { deliveryfloor: 'deliveryFloor', deliverylock: 'deliveryLock' };

/** The data department of a route ('deliveryfloor' and 'deliverylock' are 'delivery'). */
export function planDeptOf(route: string): string {
  return DELIVERY_SPLIT_ROUTES[route] ? 'delivery' : route;
}

/** The route's own section keys (plan D2): Delivery Floor then Lock on the delivery page, one of them on a split route. */
function routeSectionKeys(routeDept: string): string[] {
  if (routeDept === 'delivery') return ['deliveryFloor', 'deliveryLock'];
  if (DELIVERY_SPLIT_ROUTES[routeDept]) return [DELIVERY_SPLIT_ROUTES[routeDept]];
  return [routeDept];
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
      isRoute: routeSectionKeys(routeDept).includes(key),
      footerSavesDept: routeDept === 'delivery',
    };
  }
  const meta = deptMetaOf(key);
  return { key, dept: key, group: 'main', title: meta.name, saveLabel: `Save ${meta.label}`, hasStatus: true, isRoute: routeDept === key, footerSavesDept: false };
}

/** US-12: the pages that also show the YD section (as an added section) when the order has YD items. */
const YD_ADDED_ROUTES = ['knitting', 'dyeing', 'delivery', 'deliveryfloor', 'deliverylock'];

/**
 * Plan D2: the route department's section(s) first, then YD (US-12, see `showsSection`), Knitting, Dyeing, Delivery
 * Floor and Delivery Lock. On the Delivery Floor route only Floor is the route section (Lock is an added section), and
 * the reverse on the Lock route.
 */
export function sectionsFor(routeDept: string): SectionDef[] {
  const routeKeys = routeSectionKeys(routeDept);
  const added = YD_ADDED_ROUTES.includes(routeDept) ? ['yd'] : [];
  const rest = [...added, 'knitting', 'dyeing', 'deliveryFloor', 'deliveryLock'].filter((k) => !routeKeys.includes(k));
  return [...routeKeys, ...rest].map((k) => sectionDef(k, routeDept));
}

/** US-12: the order has YD items (the server's `deptFlags.yd.hasItems`, else the order's `ydItems`). */
export function orderHasYdItems(order: Loose | null | undefined, deptFlags: DeptFlags | null): boolean {
  const flags = deptFlags?.yd;
  if (flags) return flags.hasItems === true;
  return Array.isArray(order?.ydItems) && order.ydItems.length > 0;
}

/**
 * Whether a section is drawn. Every section is drawn, except the added YD section of an order without YD items
 * (US-12): it is not shown at all, rather than as an added section with the "no items" note.
 */
export function showsSection(def: SectionDef, order: Loose | null | undefined, deptFlags: DeptFlags | null): boolean {
  return def.key !== 'yd' || def.isRoute || orderHasYdItems(order, deptFlags);
}

export type DeptFlags = Partial<Record<string, { inLatestFile: boolean; hasItems: boolean }>>;

/** Who may change a section, and why not (plan D4 and D8). */
export interface SectionAccess {
  /** Plan D4 / D8: the page's own department as today; any other section for 'Admin' only, and only while the order
   *  is in that department's latest file. */
  editable: boolean;
  /** Tooltip of a view-only section. */
  readOnlyTitle: string | null;
  notInLatest: boolean;
  /** D8: an added section of a department without items: its Order Status and Save are off. */
  noItems: boolean;
  /** The section's draft may change and be saved (editable, and not an added section without items). Anything
   *  else is never changed by the page, counted as unsaved work or sent, whatever the DOM does. */
  canSave: boolean;
}

export function sectionAccess(def: SectionDef, canEditOthers: boolean, deptFlags: DeptFlags | null): SectionAccess {
  const flags = deptFlags?.[def.dept];
  const notInLatest = flags ? flags.inLatestFile === false : false;
  const noItems = !def.isRoute && Boolean(flags && flags.hasItems === false);
  const editable = def.isRoute || (canEditOthers && !notInLatest);
  const label = deptMetaOf(def.dept).label;
  const readOnlyTitle = editable
    ? null
    : !canEditOthers
      ? `View only: no ${label} Plan access`
      : `This order is not in the latest ${label} file, so it is not listed on the ${label} Plan page.`;
  return { editable, readOnlyTitle, notInLatest, noItems, canSave: editable && !noItems };
}

/** The departments shown on a route's page (each held once in the state). */
export function deptsFor(routeDept: string): string[] {
  const out: string[] = [];
  sectionsFor(routeDept).forEach((s) => {
    if (!out.includes(s.dept)) out.push(s.dept);
  });
  return out;
}

/**
 * What a save sends: one section (its strip Save), a whole department (the route card's footer Save: on the delivery
 * page today's single "Save Planning Schedule" stored Floor and Lock together, and still does), or Save Data.
 */
export type SaveTarget = { kind: 'section'; key: string } | { kind: 'dept'; dept: string } | { kind: 'all' };

/* ---------------- state ---------------- */

/**
 * Plan D7: a department the server refused to save because someone else changed it after this page read it (409).
 * Its sections show an alert with "Load latest" and "Save mine anyway" until the department's base fingerprint is
 * adopted again (a save, or a read that shows the unsaved work was made on what is stored now).
 */
export interface DeptConflict {
  /** The field groups of the refused save (delivery: 'floor' and/or 'lock'); their sections show the alert. */
  groups: GroupKey[];
  /** The save that was refused, sent again by "Save mine anyway". */
  target: SaveTarget;
  /**
   * Every department of the same refusal: "Save mine anyway" rebases all of them on a fresh read (see rowsOnRead).
   * It is one click, never a lasting state: until a save succeeds, every other save sends the old base (409 again).
   */
  depts: string[];
}

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
  deptFlags: DeptFlags | null;
  drafts: Record<string, DeptDraft>;
  /** The rows are on screen (from the cached detail or the first read). Until then no Order Status can change. */
  loaded: boolean;
  /** Plan D7: departments with a refused save (409), by department. */
  conflicts: Record<string, DeptConflict>;
}

export interface OrderDetailInput {
  order?: Loose;
  planData?: Loose;
  fingerprints?: Partial<Record<string, string>>;
  deptFlags?: DeptFlags;
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
    const rows = cached?.order ? mergedRowsOf(cached.order, cached.planData, dept) : [];
    drafts[dept] = cleanDraft(rows, statusOf(cached?.planData, dept), dept);
  });
  return {
    order: cached?.order || fallbackOrder,
    planData: cached?.planData || null,
    fingerprints: { ...(cached?.fingerprints || {}) },
    deptFlags: cached?.deptFlags || null,
    drafts,
    loaded: Boolean(cached?.order),
    conflicts: {},
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

/** A department's rows and Order Status as a read shows them (what is stored now). */
export interface StoredDept {
  rows: Loose[];
  status: string;
}

/** The department's rows and Order Status in a detail read (`order` and `planData` of the answer). */
export function storedDept(order: Loose, planData: Loose, dept: string): StoredDept {
  return { rows: mergedRowsOf(order || {}, planData || {}, dept), status: statusOf(planData, dept) };
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
    const rows = withFieldsFrom(draft.rows, draft.base.lock, LOCK_FIELDS);
    return { rows, status: draft.baseStatus };
  }
  const rows = withFieldsFrom(draft.rows, draft.base.floor, FLOOR_FIELDS);
  return { rows, status: draft.status };
}

/**
 * What "Save mine anyway" sends for a refused department (plan D7, refined): a save REBASED on a fresh read.
 * - The rows are the fresh read's rows (what is stored now, with every item an upload added and its stored values).
 * - The user's draft values go on top, by itemId, only for the fields the save covers: one Delivery group's fields,
 *   or every field of the section.
 * - Draft items the fresh read does not have are left out: the order no longer has them, so a reload would not show
 *   them either (buildMergedItems over the order's items).
 * - The status is the draft status when the save covers the status group (Lock, or a whole section), else the fresh
 *   read's (a Delivery Floor save keeps whatever status is stored now).
 */
export function rowsOnRead(draft: DeptDraft, dept: string, groups: GroupKey[], read: StoredDept): { rows: Loose[]; status: string } {
  const covered = groupsOf(dept).filter((g) => groups.includes(g));
  const fields = covered.flatMap((g) => groupFields(g));
  return {
    rows: withFieldsFrom(read.rows, draft.rows, fields),
    status: covered.includes(statusGroupOf(dept)) ? draft.status : read.status,
  };
}

/**
 * True when `next` is a plan saved BEFORE the one on screen (an older read must never replace newer data). An order's
 * plan (OrderDate) is never deleted, so once the plan on screen has a save time, a read without a plan or without a
 * save time is an older copy too (e.g. another server instance's cached "no plan yet").
 */
export function isOlderPlanData(next: Loose, current: Loose): boolean {
  const b = Date.parse(String(current?.updatedAt ?? ''));
  if (!Number.isFinite(b)) return false;
  const a = Date.parse(String(next?.updatedAt ?? ''));
  return !Number.isFinite(a) || a < b;
}

/** Same item ids in the same order. */
function sameItems(a: Loose[] | undefined, b: Loose[] | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((row, i) => row?.itemId === b[i]?.itemId);
}

/**
 * The itemData keys the server's fingerprint covers besides the plan fields (SERVER src/utils/plan-fingerprint.ts):
 * people change them (V2 saves Unit, Process Name and the YD quantities only inside itemData), while every other
 * itemData key is Excel data.
 */
const FINGERPRINT_ITEM_DATA_KEYS = ['Unit', 'ProcessName', 'Process Name', 'Barrier Qty.', 'Workable Qty.'];

function itemDataDiffers(rows: Loose[], base: Loose[]): boolean {
  for (let i = 0; i < rows.length; i++) {
    for (const k of FINGERPRINT_ITEM_DATA_KEYS) {
      if (norm(rows[i]?.itemData?.[k]) !== norm(base[i]?.itemData?.[k])) return true;
    }
  }
  return false;
}

/**
 * The group's baseline (what the unsaved work was made on) is what a read shows now: the same items, the same values
 * of the group's fields and of the fingerprinted itemData keys (a save sends the whole rows, so it would overwrite a
 * change there too), and for the status group the same Order Status.
 */
function baseMatchesRead(draft: DeptDraft, dept: string, group: GroupKey, merged: Loose[], status: string): boolean {
  if (group === statusGroupOf(dept) && draft.baseStatus !== status) return false;
  const base = draft.base[group];
  return sameItems(base, merged) && !rowsDiffer(merged, base, groupFields(group)) && !itemDataDiffers(merged, base as Loose[]);
}

/**
 * Every group's baseline becomes the read (`merged`); the `reload` groups also take the read's values, the other groups
 * keep their unsaved values (only used when those groups' baselines equal the read, see baseMatchesRead).
 */
function rebaseOnRead(draft: DeptDraft, dept: string, reload: GroupKey[], merged: Loose[], status: string): DeptDraft {
  let rows = merged;
  const base: Partial<Record<GroupKey, Loose[]>> = {};
  groupsOf(dept).forEach((g) => {
    base[g] = merged;
    if (!reload.includes(g)) rows = withFieldsFrom(rows, draft.rows, groupFields(g));
  });
  return { rows, status: reload.includes(statusGroupOf(dept)) ? status : draft.status, base, baseStatus: status };
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

/** A section's backed-up unsaved work (see order-page-backup.ts): the rows' values of `groups`, and the status. */
export interface RestoreInput {
  dept: string;
  groups: GroupKey[];
  rows: Loose[];
  status?: string;
}

export type OrderPageAction =
  /**
   * A detail read: every clean group (and every `drop` group, whose draft is given up) is re-merged from it; dirty
   * groups keep their drafts. The department adopts the read's fingerprint only when every group that keeps a draft
   * was made on what the read shows (its baseline equals the read); otherwise the old base stays, so a save is
   * refused instead of silently overwriting someone else's change.
   */
  | { type: 'hydrate'; data: OrderDetailInput; drop?: Array<{ dept: string; group: GroupKey }> }
  | { type: 'rows'; dept: string; update: SetStateAction<Loose[]> }
  | { type: 'status'; dept: string; update: SetStateAction<string> }
  | { type: 'discard'; dept: string; group: GroupKey }
  /**
   * A successful save: only the saved groups are re-merged from the response, and only their fingerprints adopted.
   * `order`: the order of the fresh read a "Save mine anyway" was rebased on (its rows may hold items an upload added).
   */
  | {
      type: 'saved';
      saved: Array<{ dept: string; groups: GroupKey[] }>;
      planData: Loose;
      fingerprints?: Partial<Record<string, string>>;
      order?: Loose;
    }
  /**
   * Plan D7: the server refused a save (409) for `depts`; `sent` is what that save sent. `rebased`: the departments a
   * refused "Save mine anyway" rebased (not saved either): they stay refused, together with the new ones.
   */
  | { type: 'conflict'; depts: string[]; sent: Array<{ dept: string; groups: GroupKey[] }>; target: SaveTarget; rebased?: string[] }
  /** Backed-up unsaved work put back into the drafts (the baselines stay: it shows as unsaved). */
  | { type: 'restore'; backups: RestoreInput[] };

export function orderPageReducer(state: OrderPageModel, action: OrderPageAction): OrderPageModel {
  switch (action.type) {
    case 'hydrate': {
      const { data } = action;
      if (isOlderPlanData(data.planData, state.planData)) return state;
      const order = data.order || {};
      const planData = data.planData || {};
      const fingerprints = { ...state.fingerprints };
      const conflicts = { ...state.conflicts };
      const drafts: Record<string, DeptDraft> = {};
      Object.keys(state.drafts).forEach((dept) => {
        const draft = state.drafts[dept];
        const dropped = (action.drop || []).filter((d) => d.dept === dept).map((d) => d.group);
        const reload = groupsOf(dept).filter((g) => dropped.includes(g) || !isGroupDirty(draft, dept, g));
        const keep = groupsOf(dept).filter((g) => !reload.includes(g));
        const merged = mergedRowsOf(order, planData, dept);
        const status = statusOf(planData, dept);
        const stale = keep.filter((g) => !baseMatchesRead(draft, dept, g, merged, status));
        const fp = data.fingerprints ? data.fingerprints[dept] : undefined;
        const remerged = reload.length > 0 ? remergeGroups(draft, dept, reload, merged, status) : draft;
        if (stale.length > 0) {
          // Unsaved work made on data that has changed since: keep its draft, its baseline and its old base.
          drafts[dept] = remerged;
          if (conflicts[dept]) conflicts[dept] = { ...conflicts[dept], groups: stale };
          return;
        }
        if (keep.length === 0) drafts[dept] = cleanDraft(merged, status, dept);
        else if (fp !== undefined && fp !== state.fingerprints[dept]) drafts[dept] = rebaseOnRead(draft, dept, reload, merged, status);
        else drafts[dept] = remerged;
        if (fp !== undefined) fingerprints[dept] = fp;
        delete conflicts[dept];
      });
      return { order, planData, fingerprints, deptFlags: data.deptFlags || null, drafts, loaded: true, conflicts };
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
      // A status chosen before the rows are on screen would hold back the read's rows and status (a dirty group keeps
      // its draft), so no Order Status changes until then.
      if (!draft || !state.loaded) return state;
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
      // Keep-newest: an answer older than the plan on screen (a read of a later save answered first) does not replace
      // it. The saved groups are then merged again from that newer plan, which holds this save or a later one.
      const older = isOlderPlanData(action.planData, state.planData);
      const planData = older ? state.planData : action.planData || {};
      // A rebased save ("Save mine anyway") sent the rows of a fresh read's order: the saved rows are merged over it.
      const order = !older && action.order ? action.order : state.order;
      const drafts = { ...state.drafts };
      const fingerprints = { ...state.fingerprints };
      const conflicts = { ...state.conflicts };
      action.saved.forEach(({ dept, groups }) => {
        const draft = drafts[dept];
        if (!draft) return;
        const merged = mergedRowsOf(order, planData, dept);
        const status = statusOf(planData, dept);
        // The saved groups and the clean ones are merged again; a group this save did not send keeps its unsaved work.
        const reload = groupsOf(dept).filter((g) => groups.includes(g) || !isGroupDirty(draft, dept, g));
        const stale = groupsOf(dept).filter((g) => !reload.includes(g) && !baseMatchesRead(draft, dept, g, merged, status));
        drafts[dept] = remergeGroups(draft, dept, reload, merged, status);
        if (stale.length > 0) {
          // That unsaved work was made on other values than the ones stored now (a "Save mine anyway" of the other
          // delivery group sends this group as a fresh read showed it): the old base stays, so saving the work is
          // refused instead of overwriting what is stored.
          conflicts[dept] = { groups: stale, target: { kind: 'dept', dept }, depts: [dept] };
          return;
        }
        if (action.fingerprints && action.fingerprints[dept] !== undefined) fingerprints[dept] = action.fingerprints[dept];
        // Every group that keeps a draft was made on what is stored now: nothing left to resolve.
        delete conflicts[dept];
      });
      return { ...state, order, planData, fingerprints, drafts, conflicts };
    }
    case 'conflict': {
      const conflicts = { ...state.conflicts };
      const refused = action.sent.map((s) => s.dept).filter((d) => action.depts.includes(d));
      if (refused.length === 0) return state;
      // A refused "Save mine anyway" saved nothing: the departments it rebased keep their old base and their alert, and
      // the next "Save mine anyway" rebases them again together with the newly refused ones (no endless back and forth).
      const kept = (action.rebased || []).filter((d) => !refused.includes(d) && conflicts[d]);
      const depts = [...refused, ...kept];
      action.sent.forEach(({ dept, groups }) => {
        if (refused.includes(dept)) conflicts[dept] = { groups, target: action.target, depts };
      });
      kept.forEach((d) => {
        conflicts[d] = { ...conflicts[d], target: action.target, depts };
      });
      return { ...state, conflicts };
    }
    case 'restore': {
      const drafts = { ...state.drafts };
      action.backups.forEach(({ dept, groups, rows, status }) => {
        const draft = drafts[dept];
        if (!draft) return;
        let next = draft.rows;
        groups.forEach((g) => {
          next = withFieldsFrom(next, rows, groupFields(g));
        });
        const withStatus = groups.includes(statusGroupOf(dept)) && typeof status === 'string';
        drafts[dept] = { ...draft, rows: next, status: withStatus ? (status as string) : draft.status };
      });
      return { ...state, drafts };
    }
    default:
      return state;
  }
}
