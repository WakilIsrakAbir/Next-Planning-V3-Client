'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import {
  PlanCheckListError,
  loadPlanCheckList,
  planCheckListErrorText,
  usePlanCheckList,
  type PlanCheckList,
} from '@/features/management/plan-check-list/lib/plan-check-list';
import {
  GUIDE_DATE_KEYS,
  GUIDE_ROWS,
  TNA_KEYS,
  computeGuideDefaults,
  computeLead,
  guideRowsChanged,
  isIsoDay,
  toIsoDay,
  type GuideDateKey,
  type GuideDates,
  type GuideLead,
  type GuideRow,
  type PlanCheck,
  type TnaKey,
} from '@/features/planning/guide/lib/plan-guide';
import {
  PlanGuideError,
  fetchLatestGuideInputs,
  isNewerGuide,
  readPlanGuide,
  savePlanGuide,
  storeGuideInDetailCache,
  type PlanGuide,
  type PlanGuideSaveBody,
} from '@/features/planning/guide/lib/plan-guide-api';

/*
 * State of the order page's Checkpoint & Planning Guide card (SPEC D10-D13, C4).
 *
 * - Before the first save the card shows the live values: no criterion is Yes and the dates come from the order's
 *   T&A. After a save it shows the stored values, whatever the T&A or the Plan Check List say now.
 * - Every edit is a draft on top of the stored guide it started from; that guide's version is what a save sends, so
 *   a save over someone else's newer save is refused (409) instead of overwriting it.
 * - Changing a Yes/No recomputes Knit Start/End from the T&A plus the lead (replacing manual Knit edits). The lead
 *   is the largest Start days and, separately, the largest End days of the criteria that are Yes AND Active.
 * - A stored row whose T&A or Check List input changed since the save, and that now differs from what they give,
 *   shows "T&A / Check List changed since saved" with Apply (see `changedRows`). "Since the save" means against the
 *   T&A and the lead the SERVER stored with the guide: it takes them from the Order and the Plan Check List at the
 *   moment of the save. So before every save the card reads both again (save check): when they give other dates or
 *   another lead than the card computed with, nothing is sent, the card takes the latest values and asks the user to
 *   check and save again (PlanGuideError code INPUTS_CHANGED). What is stored is then always based on what was shown.
 * - The guide never changes plan rows, the Order's T&A fields or any validation (D13).
 */

/** The name of the guide's unsaved work ("Unsaved changes in: ...") and of its Save Data step. */
export const PLANNING_GUIDE_LABEL = 'Planning Guide';
/** Its source id in the shared unsaved-work guard (src/lib/unsaved-changes.ts). */
export const PLANNING_GUIDE_SOURCE_ID = 'planning-guide';

/**
 * One extra step of the order page's Save Data (SPEC C2 10a), run after the plan saves: the guide is `{key: 'guide',
 * label: 'Planning Guide', isDirty, save}`. `save` resolves when the guide is saved and rejects with an Error whose
 * message is the reason otherwise (the guide then stays unsaved). When a save of the guide is already running (Save
 * Guide), it waits for that one and then also sends the changes made since it started, so it resolves only when what
 * is shown is saved.
 */
export interface SaveExtra {
  key: string;
  label: string;
  isDirty: boolean;
  save: () => Promise<void>;
}

/** The order fields the guide reads: its General-file T&A values, from the full order details. */
export type GuideOrder = Partial<Record<TnaKey, unknown>> & { orderNo?: unknown };

export interface UsePlanningGuideOptions {
  orderNo: string;
  /** The order from the FULL detail answer (never a plan-list row); null while that answer is loading. */
  order: GuideOrder | null;
  /** The `guide` of the same detail answer: the stored guide, or null before its first save. */
  guide: PlanGuide | null | undefined;
  /** Called with the guide as the server stored it, after a save and after Reload, e.g. to keep the page's copy. */
  onGuideChange?: (guide: PlanGuide) => void;
}

/** Active: counts towards the lead when Yes. Inactive / Removed: kept only while the guide has them as Yes; never count. */
export type GuideCriterionStatus = 'active' | 'inactive' | 'removed';

export interface GuideCriterion {
  id: string;
  name: string;
  /** Lead days as they count: whole days, never negative. */
  startDays: number;
  endDays: number;
  yes: boolean;
  /** Decided against the CURRENT Plan Check List: Removed = no longer in it; Inactive = in it but switched off. */
  status: GuideCriterionStatus;
}

export interface GuideRowView {
  row: GuideRow;
  label: string;
  /** Where the row's dates come from. */
  source: string;
  startKey: GuideDateKey;
  endKey: GuideDateKey;
  /** The shown dates ('YYYY-MM-DD' or ''). */
  start: string;
  end: string;
  /** What the T&A and the current lead give now ('' for a cell that does not come from the T&A). */
  liveStart: string;
  liveEnd: string;
  /** The cells that come from the T&A (YD: Start only, its End is entered by hand; Lock: neither). */
  startFromTna: boolean;
  endFromTna: boolean;
  /** "T&A / Check List changed since saved": Apply sets the row's T&A cells to liveStart / liveEnd. */
  changed: boolean;
  /** A date taken from the T&A differs from what the T&A (plus the lead) gives, without a change since the save. */
  edited: boolean;
  /** The raw T&A text when it is not a date (the cell starts blank and is never shifted), '' otherwise. */
  rawStart: string;
  rawEnd: string;
}

/**
 * A message on the card: a refused save or reload ('error'), a save someone else's save overtook ('conflict', with
 * Reload), or a save held back because the order's T&A or the Plan Check List changed after the page loaded them
 * ('changed': the card now uses the latest values).
 */
export interface GuideNotice {
  kind: 'error' | 'conflict' | 'changed';
  text: string;
}

export interface PlanningGuide {
  /** The order's full details are loaded: the guide can be shown, edited and saved. */
  ready: boolean;
  /** The Plan Check List (null until it is loaded). */
  list: PlanCheckList | null;
  /** A failed Plan Check List load ('' otherwise, and '' once a list is loaded). */
  listError: string;
  retryingList: boolean;
  retryList: () => void;
  /** Yes/No rows: the Active criteria in Plan Check List order, then the stored Yes ones that are Inactive or Removed. */
  criteria: GuideCriterion[];
  yesIds: string[];
  dates: GuideDates;
  /** The lead for the shown Yes criteria and the current Plan Check List. */
  lead: GuideLead;
  /** E.g. "A +10/+3, B +8/+7 → largest start +10d (A), largest end +7d (B)"; '' when the lead is 0/0. */
  leadTooltip: string;
  rows: GuideRowView[];
  /** Knit Start is after Knit End: an amber warning only, saving is allowed. */
  knitStartAfterEnd: boolean;
  /** The order has no T&A value at all. */
  noTna: boolean;
  /** The newest stored guide this page knows (null before the first save). */
  stored: PlanGuide | null;
  dirty: boolean;
  saving: boolean;
  reloading: boolean;
  notice: GuideNotice | null;
  setYes: (id: string, yes: boolean) => void;
  setDate: (key: GuideDateKey, value: string) => void;
  /** Takes the dates the T&A and the current lead give now for one row (its T&A cells only). */
  applyRow: (row: GuideRow) => void;
  /** Drops the unsaved changes (the caller asks first). */
  discard: () => void;
  /**
   * Saves what is shown (also when nothing changed), after the save check (see the top of this file). Rejects with
   * PlanGuideError; the changes then stay unsaved. While a save runs, waits for it and then sends the changes made
   * since it started, if there are any.
   */
  save: () => Promise<PlanGuide>;
  /** Drops the unsaved changes and loads the latest stored guide, T&A and Plan Check List (the caller asks first). */
  reload: () => Promise<void>;
  dismissNotice: () => void;
  /** The guide's Save Data step (SPEC C2 10a). */
  extra: SaveExtra;
}

const ROW_INFO: Record<GuideRow, { label: string; source: string; tnaStart?: TnaKey; tnaEnd?: TnaKey }> = {
  yd: { label: 'YD', source: 'T&A Yarn Date (Start only)', tnaStart: 'yarnDate' },
  knit: { label: 'Knit', source: 'T&A Knitting + Check List lead', tnaStart: 'knitStart', tnaEnd: 'knitEnd' },
  dye: { label: 'Dye', source: 'T&A Dyeing', tnaStart: 'dyeStart', tnaEnd: 'dyeEnd' },
  floor: { label: 'Floor', source: 'T&A Deli. (Delivery)', tnaStart: 'deliStart', tnaEnd: 'deliEnd' },
  lock: { label: 'Lock', source: 'Manual (not in the General file)' },
};

interface GuideValues {
  yesIds: string[];
  dates: GuideDates;
}

/** Unsaved changes, on top of the stored guide they started from (null: the guide was never saved). */
interface GuideDraft extends GuideValues {
  base: PlanGuide | null;
}

/** The order's T&A as a save check or Reload read it from the server, and the page's T&A it replaces. */
interface LatestTna {
  /** `tnaText` of the page's order then: the latest T&A is used while the page still passes that T&A. */
  basis: string;
  order: GuideOrder;
}

interface GuideState {
  orderNo: string;
  /** The newest guide this card got from its own save or reload. */
  local: PlanGuide | null;
  draft: GuideDraft | null;
  /** The T&A the server had at the last save check or Reload (null: the page's T&A is used). */
  tna: LatestTna | null;
  saving: boolean;
  reloading: boolean;
  notice: GuideNotice | null;
}

/** What one render knows besides the state: the page's data. */
interface GuideInputs {
  orderNo: string;
  /** The order when its full details are loaded (and belong to this order), else null. */
  order: GuideOrder | null;
  propGuide: PlanGuide | null;
  listItems: PlanCheck[] | null;
}

/** A save that is running: what it sends, for the callers that wait for it. */
interface SaveRun {
  forOrder: string;
  sent: GuideValues;
  promise: Promise<PlanGuide>;
}

const initialState = (orderNo: string): GuideState => ({
  orderNo,
  local: null,
  draft: null,
  tna: null,
  saving: false,
  reloading: false,
  notice: null,
});

const startKey = (row: GuideRow): GuideDateKey => `${row}Start`;
const endKey = (row: GuideRow): GuideDateKey => `${row}End`;
/** The date cells that come from the order's T&A; YD End and the Lock row are entered by hand. */
const TNA_CELLS: GuideDateKey[] = GUIDE_ROWS.flatMap((row) => [
  ...(ROW_INFO[row].tnaStart ? [startKey(row)] : []),
  ...(ROW_INFO[row].tnaEnd ? [endKey(row)] : []),
]);
/** Days shown for a criterion: whole and not negative, as they count in the lead. */
const shownDays = (days: unknown): number =>
  typeof days === 'number' && Number.isFinite(days) ? Math.max(0, Math.trunc(days)) : 0;

function sameValues(a: GuideValues, b: GuideValues): boolean {
  const yesA = new Set(a.yesIds);
  const yesB = new Set(b.yesIds);
  if (yesA.size !== yesB.size) return false;
  for (const id of yesA) if (!yesB.has(id)) return false;
  return GUIDE_DATE_KEYS.every((key) => (a.dates[key] || '') === (b.dates[key] || ''));
}

/** The rows whose T&A cells differ between two sets of guide dates (cells entered by hand are not compared). */
function tnaRowsDiffer(a: GuideDates, b: GuideDates): GuideRow[] {
  return GUIDE_ROWS.filter((row) => {
    const info = ROW_INFO[row];
    return (!!info.tnaStart && a[startKey(row)] !== b[startKey(row)]) || (!!info.tnaEnd && a[endKey(row)] !== b[endKey(row)]);
  });
}

/** An order's T&A values as the server snapshots them ('' when absent), as one text to compare. */
function tnaText(order: GuideOrder): string {
  return JSON.stringify(TNA_KEYS.map((key) => (order[key] === undefined || order[key] === null ? '' : String(order[key]))));
}

/** The latest T&A, to be used while the page still passes `pageOrder`'s T&A (null without a page order). */
function latestTnaFor(pageOrder: GuideOrder | null | undefined, order: GuideOrder): LatestTna | null {
  return pageOrder ? { basis: tnaText(pageOrder), order } : null;
}

/** Yes ids without repeats, in Plan Check List order; ids the list does not have keep their order at the end. */
function orderYesIds(ids: readonly string[], list: readonly PlanCheck[] | null): string[] {
  const unique = [...new Set(ids)];
  if (!list) return unique;
  const position = new Map<string, number>();
  list.forEach((item, index) => {
    if (item && !position.has(item.id)) position.set(item.id, index);
  });
  return unique
    .map((id, index) => ({ id, index, at: position.get(id) ?? Number.MAX_SAFE_INTEGER }))
    .sort((x, y) => x.at - y.at || x.index - y.index)
    .map((entry) => entry.id);
}

/** The values a guide shows with no unsaved changes: the stored ones, or before the first save the live ones. */
function baselineOf(base: PlanGuide | null, inputs: GuideInputs): GuideValues {
  return base ? { yesIds: base.yesIds, dates: base.dates } : { yesIds: [], dates: computeGuideDefaults(inputs.order, null) };
}

function derive(state: GuideState, inputs: GuideInputs) {
  const newest = isNewerGuide(inputs.propGuide, state.local) ? inputs.propGuide : (state.local ?? inputs.propGuide);
  const draft = state.draft;
  const base = draft ? draft.base : newest;
  const shown: GuideValues = draft ? { yesIds: draft.yesIds, dates: draft.dates } : baselineOf(newest, inputs);
  const dirty = !!draft && !sameValues(draft, baselineOf(draft.base, inputs));
  // The lead counts the current Plan Check List; until it is loaded, the list the shown guide was saved with.
  const leadChecks = inputs.listItems ?? base?.checks ?? [];
  return { newest, base, shown, dirty, leadChecks };
}

function inputsChangedText(tnaChanged: boolean, listChanged: boolean): string {
  const what =
    tnaChanged && listChanged
      ? "The order's T&A dates and the Plan Check List"
      : tnaChanged
        ? "The order's T&A dates"
        : 'The Plan Check List';
  return (
    `${what} changed after this page loaded them, so the Planning Guide was not saved. ` +
    'The guide now uses the latest values: check its dates and save again.'
  );
}

/**
 * A save check found other T&A dates or another lead on the server (`order`, `list`) than the card used (`used`).
 * The card takes the latest values: cells that followed the old ones (the live dates before the first save, or what
 * a Yes/No change or Apply computed) follow the new ones; stored cells keep their value (the "changed since saved"
 * hint offers the new dates) and cells edited by hand stay as they are.
 */
function followLatestInputs(
  s: GuideState,
  used: GuideInputs,
  order: GuideOrder,
  list: PlanCheck[],
  tna: LatestTna | null,
  text: string
): GuideState {
  const now = derive(s, used);
  const oldLive = computeGuideDefaults(used.order, computeLead(now.leadChecks, now.shown.yesIds));
  const newLive = computeGuideDefaults(order, computeLead(list, now.shown.yesIds));
  const dates = { ...now.shown.dates };
  for (const key of TNA_CELLS) {
    const followedOld = dates[key] === oldLive[key] && (!now.base || dates[key] !== now.base.dates[key]);
    if (followedOld) dates[key] = newLive[key];
  }
  const values: GuideValues = { yesIds: now.shown.yesIds, dates };
  const latestInputs: GuideInputs = { ...used, order, listItems: list };
  const draft = sameValues(values, baselineOf(now.base, latestInputs)) ? null : { ...values, base: now.base };
  return { ...s, draft, tna: tna ?? s.tna, saving: false, notice: { kind: 'changed', text } };
}

function leadTooltip(checks: readonly PlanCheck[], yesIds: readonly string[], lead: GuideLead): string {
  if (lead.startDays === 0 && lead.endDays === 0) return '';
  const yes = new Set(yesIds);
  const parts = checks
    .filter((check) => !!check && check.active === true && yes.has(check.id))
    .map((check) => `${check.name} +${shownDays(check.startDays)}/+${shownDays(check.endDays)}`);
  return (
    `${parts.join(', ')} → largest start +${lead.startDays}d (${lead.startFrom.join(', ')}), ` +
    `largest end +${lead.endDays}d (${lead.endFrom.join(', ')})`
  );
}

/** The raw T&A text of a field that is not a date ('' for a date or an empty value). */
function rawTnaText(order: GuideOrder | null, key: TnaKey | undefined): string {
  if (!order || !key) return '';
  const value = order[key];
  if (value === undefined || value === null) return '';
  const raw = String(value).trim();
  return raw !== '' && toIsoDay(value) === '' ? raw : '';
}

const errorText = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

/** The server's 409 text asks to reload the page; the card's notice has its own Reload button. */
const withReloadButton = (message: string): string =>
  message.replace('Reload the page to see the latest values.', 'Click Reload to see the latest values.');

/** A failed Plan Check List read during a save, as the save's error. */
const listReadError = (err: unknown): PlanGuideError =>
  err instanceof PlanCheckListError
    ? new PlanGuideError(err.message, err.status, err.code)
    : new PlanGuideError(planCheckListErrorText(err), 0, '');

/**
 * The Checkpoint & Planning Guide of one order: what the card shows, its edits, its own dirty flag and its saves.
 * It registers "Planning Guide" with the unsaved-work guard while it has unsaved changes. Render it with a `key` of
 * the order number (PlanningGuideCard does), so another order starts from a clean state.
 */
export function usePlanningGuide({ orderNo, order, guide, onGuideChange }: UsePlanningGuideOptions): PlanningGuide {
  const { list, error: loadError } = usePlanCheckList();
  const [retryingList, setRetryingList] = useState(false);
  const [retryError, setRetryError] = useState('');
  const [rawState, setState] = useState<GuideState>(() => initialState(orderNo));
  const state = rawState.orderNo === orderNo ? rawState : initialState(orderNo);

  const propGuide = useMemo(() => {
    const read = readPlanGuide(guide);
    return read && (read.orderNo === '' || read.orderNo === orderNo) ? read : null;
  }, [guide, orderNo]);
  const orderOk =
    !!order && (order.orderNo === undefined || order.orderNo === null || String(order.orderNo).trim() === String(orderNo).trim());
  const pageOrder = orderOk ? order : null;
  // The T&A of the last save check or Reload, while the page still passes the T&A it replaced.
  const latestTna = pageOrder && state.tna && state.tna.basis === tnaText(pageOrder) ? state.tna.order : null;
  const inputs: GuideInputs = {
    orderNo,
    order: latestTna ?? pageOrder,
    propGuide,
    listItems: list ? list.items : null,
  };

  // The latest render's data, for event handlers and async results.
  const latest = useRef<{
    inputs: GuideInputs;
    state: GuideState;
    pageOrder: GuideOrder | null;
    onGuideChange?: (guide: PlanGuide) => void;
  } | null>(null);
  useLayoutEffect(() => {
    latest.current = { inputs, state, pageOrder, onGuideChange };
  });
  const inFlight = useRef<SaveRun | null>(null);
  // The guide this card saved last, as soon as the answer arrives (before the next render): a save that starts right
  // after it is based on it.
  const lastSaved = useRef<PlanGuide | null>(null);

  // A state change for the order on screen (state left from another order number starts again).
  const update = useCallback((change: (s: GuideState) => GuideState) => {
    const current = latest.current?.inputs.orderNo;
    if (current === undefined) return;
    setState((prev) => change(prev.orderNo === current ? prev : initialState(current)));
  }, []);

  // An edit of the shown values; a draft that equals its stored guide again is no longer unsaved.
  const edit = useCallback(
    (change: (values: GuideValues, inputs: GuideInputs, checks: readonly PlanCheck[]) => GuideValues) => {
      const now = latest.current?.inputs;
      if (!now || !now.order) return;
      update((s) => {
        const d = derive(s, now);
        const next = change(d.shown, now, d.leadChecks);
        const draft = sameValues(next, baselineOf(d.base, now)) ? null : { yesIds: next.yesIds, dates: next.dates, base: d.base };
        return { ...s, draft };
      });
    },
    [update]
  );

  const setYes = useCallback(
    (id: string, yes: boolean) =>
      edit((values, now) => {
        if (!now.listItems) return values;
        const others = values.yesIds.filter((other) => other !== id);
        const yesIds = orderYesIds(yes ? [...others, id] : others, now.listItems);
        // Knit follows the T&A plus the new lead, replacing manual Knit edits (D11).
        const knit = computeGuideDefaults(now.order, computeLead(now.listItems, yesIds));
        return { yesIds, dates: { ...values.dates, knitStart: knit.knitStart, knitEnd: knit.knitEnd } };
      }),
    [edit]
  );

  const setDate = useCallback(
    (key: GuideDateKey, value: string) =>
      edit((values) => ({ ...values, dates: { ...values.dates, [key]: isIsoDay(value) ? value : '' } })),
    [edit]
  );

  // Only the cells that come from the T&A: a YD End entered by hand stays.
  const applyRow = useCallback(
    (row: GuideRow) =>
      edit((values, now, checks) => {
        const live = computeGuideDefaults(now.order, computeLead(checks, values.yesIds));
        const info = ROW_INFO[row];
        const dates = { ...values.dates };
        if (info.tnaStart) dates[startKey(row)] = live[startKey(row)];
        if (info.tnaEnd) dates[endKey(row)] = live[endKey(row)];
        return { ...values, dates };
      }),
    [edit]
  );

  // A conflict stays on screen until Reload: the shown guide is still older than the stored one.
  const discard = useCallback(
    () => update((s) => ({ ...s, draft: null, notice: s.notice?.kind === 'conflict' ? s.notice : null })),
    [update]
  );

  const dismissNotice = useCallback(() => update((s) => ({ ...s, notice: null })), [update]);

  const save = useCallback(
    function saveGuide(): Promise<PlanGuide> {
      const snap = latest.current;
      if (!snap || !snap.inputs.order) {
        return Promise.reject(new PlanGuideError('The order is still loading. Try again in a moment.', 0, 'NOT_READY'));
      }
      const running = inFlight.current;
      if (running) {
        // Save Guide and Save Data while a save runs: that save counts, and the changes made since it started are
        // sent after it. When it fails, it fails for every caller (the changes stay unsaved).
        return running.promise.then((saved) => {
          const now = latest.current;
          if (!now || now.inputs.orderNo !== running.forOrder) return saved;
          return sameValues(derive(now.state, now.inputs).shown, running.sent) ? saved : saveGuide();
        });
      }

      const forOrder = snap.inputs.orderNo;
      const usedOrder = snap.inputs.order;
      const shownNow = derive(snap.state, snap.inputs);
      // Right after a save of this card the page may not have drawn it yet: base the next save on it.
      const mine = lastSaved.current;
      const base = mine && mine.orderNo === forOrder && isNewerGuide(mine, shownNow.base) ? mine : shownNow.base;
      const sentDraft = snap.state.draft;
      const sent: GuideValues = {
        yesIds: orderYesIds(shownNow.shown.yesIds, snap.inputs.listItems),
        dates: { ...shownNow.shown.dates },
      };
      const usedLead = computeLead(shownNow.leadChecks, sent.yesIds);
      update((s) => ({ ...s, saving: true, notice: null }));

      const send = async (): Promise<PlanGuide> => {
        // Save check: the server stores the T&A and the lead it has now with the guide, and the "changed since
        // saved" hints compare against them later. Send only when they give what the card computed with.
        const now = await fetchLatestGuideInputs(forOrder);
        const nowList = await loadPlanCheckList({ fresh: true }).catch((err: unknown) => {
          throw listReadError(err);
        });
        const nowLead = computeLead(nowList.items, sent.yesIds);
        const tnaChanged =
          guideRowsChanged(computeGuideDefaults(usedOrder, nowLead), computeGuideDefaults(now.order, nowLead)).length > 0;
        const listChanged = nowLead.startDays !== usedLead.startDays || nowLead.endDays !== usedLead.endDays;
        if (tnaChanged || listChanged) {
          const text = inputsChangedText(tnaChanged, listChanged);
          const page = latest.current;
          if (page && page.inputs.orderNo === forOrder) {
            const tna = latestTnaFor(page.pageOrder, now.order);
            // Compared with the inputs of the moment Save was pressed: the list read above has already replaced the
            // shared copy (and may have drawn the card again).
            update((s) => followLatestInputs(s, snap.inputs, now.order, nowList.items, tna, text));
          }
          throw new PlanGuideError(text, 0, 'INPUTS_CHANGED');
        }
        const body: PlanGuideSaveBody = { yesIds: sent.yesIds, dates: sent.dates };
        if (base) body.version = base.version;
        return savePlanGuide(forOrder, body);
      };

      const run = send().then(
        (saved) => {
          inFlight.current = null;
          if (latest.current?.inputs.orderNo !== forOrder) return saved;
          lastSaved.current = saved;
          storeGuideInDetailCache(forOrder, saved);
          update((s) => {
            const local = isNewerGuide(s.local, saved) ? s.local : saved;
            // Edits made while the save ran stay unsaved, now on top of the saved guide.
            const draft = s.draft && s.draft !== sentDraft && !sameValues(s.draft, saved) ? { ...s.draft, base: saved } : null;
            return { ...s, local, draft, saving: false };
          });
          latest.current?.onGuideChange?.(saved);
          return saved;
        },
        (err: unknown) => {
          inFlight.current = null;
          const failed =
            err instanceof PlanGuideError ? err : new PlanGuideError(errorText(err, 'Could not save the Planning Guide.'), 0, '');
          // A refusal (409) is shown with the card's Reload button (also in Save Data's message).
          const error =
            failed.code === 'CONFLICT' ? new PlanGuideError(withReloadButton(failed.message), failed.status, failed.code) : failed;
          // INPUTS_CHANGED has already put its message on the card.
          if (latest.current?.inputs.orderNo === forOrder && error.code !== 'INPUTS_CHANGED') {
            update((s) => ({
              ...s,
              saving: false,
              notice: { kind: error.code === 'CONFLICT' ? 'conflict' : 'error', text: error.message },
            }));
          }
          throw error;
        }
      );
      inFlight.current = { forOrder, sent, promise: run };
      return run;
    },
    [update]
  );

  const reload = useCallback(async (): Promise<void> => {
    const snap = latest.current;
    if (!snap) return;
    const forOrder = snap.inputs.orderNo;
    update((s) => ({ ...s, reloading: true }));
    try {
      const [now] = await Promise.all([
        fetchLatestGuideInputs(forOrder),
        loadPlanCheckList({ fresh: true }).catch(() => null),
      ]);
      const page = latest.current;
      if (!page || page.inputs.orderNo !== forOrder) return;
      const fresh = now.guide;
      if (fresh) storeGuideInDetailCache(forOrder, fresh);
      const tna = latestTnaFor(page.pageOrder, now.order);
      update((s) => ({
        ...s,
        local: isNewerGuide(s.local, fresh) ? s.local : (fresh ?? s.local),
        draft: null,
        tna: tna ?? s.tna,
        reloading: false,
        notice: null,
      }));
      if (fresh) page.onGuideChange?.(fresh);
    } catch (err) {
      if (latest.current?.inputs.orderNo !== forOrder) return;
      const text = `Could not load the latest Planning Guide: ${errorText(err, 'unknown error')}`;
      update((s) => ({ ...s, reloading: false, notice: { kind: s.notice?.kind === 'conflict' ? 'conflict' : 'error', text } }));
    }
  }, [update]);

  const retryList = useCallback(() => {
    setRetryingList(true);
    loadPlanCheckList({ fresh: true })
      .then(
        () => setRetryError(''),
        (err: unknown) => setRetryError(planCheckListErrorText(err))
      )
      .finally(() => setRetryingList(false));
  }, []);

  const saveForExtra = useCallback(async () => {
    await save();
  }, [save]);

  /* ---------- what the card shows ---------- */
  const { newest, base, shown, dirty, leadChecks } = derive(state, inputs);
  const tnaOrder = inputs.order;
  const lead = computeLead(leadChecks, shown.yesIds);
  const live = computeGuideDefaults(tnaOrder, lead);
  const differs = tnaRowsDiffer(shown.dates, live);

  // "Changed since saved": the T&A or the Check List gives a row other dates now than when the guide was saved
  // (the stored T&A and lead snapshots, with the stored Yes ids), and the shown row differs from what they give
  // now. A row the user edited by hand, with nothing changed since, gets no hint. The save check keeps the
  // snapshots equal to what the stored dates were computed from.
  let changedRows: GuideRow[] = [];
  if (inputs.listItems && tnaOrder && base) {
    const atSave = computeGuideDefaults(base.tna, base.lead);
    const nowForSaved = computeGuideDefaults(tnaOrder, computeLead(inputs.listItems, base.yesIds));
    changedRows = guideRowsChanged(atSave, nowForSaved).filter((row) => differs.includes(row));
  }
  const markers = !!inputs.listItems || !base;

  const rows: GuideRowView[] = GUIDE_ROWS.map((row) => {
    const info = ROW_INFO[row];
    const sKey = startKey(row);
    const eKey = endKey(row);
    const changed = changedRows.includes(row);
    const editedCell = (key: GuideDateKey, fromTna: TnaKey | undefined) => !!fromTna && shown.dates[key] !== live[key];
    return {
      row,
      label: info.label,
      source: info.source,
      startKey: sKey,
      endKey: eKey,
      start: shown.dates[sKey],
      end: shown.dates[eKey],
      liveStart: live[sKey],
      liveEnd: live[eKey],
      startFromTna: !!info.tnaStart,
      endFromTna: !!info.tnaEnd,
      changed,
      edited: markers && !changed && (editedCell(sKey, info.tnaStart) || editedCell(eKey, info.tnaEnd)),
      rawStart: rawTnaText(tnaOrder, info.tnaStart),
      rawEnd: rawTnaText(tnaOrder, info.tnaEnd),
    };
  });

  const criteria: GuideCriterion[] = [];
  if (inputs.listItems) {
    const yes = new Set(shown.yesIds);
    const firstById = new Map<string, PlanCheck>();
    for (const item of inputs.listItems) if (item && !firstById.has(item.id)) firstById.set(item.id, item);
    const listed = new Set<string>();
    for (const item of firstById.values()) {
      if (item.active !== true) continue;
      listed.add(item.id);
      const days = { startDays: shownDays(item.startDays), endDays: shownDays(item.endDays) };
      criteria.push({ id: item.id, name: item.name, ...days, yes: yes.has(item.id), status: 'active' });
    }
    // Stored Yes criteria that are not Active now: shown so they can be set to No; they never count.
    for (const id of new Set([...(base?.yesIds ?? []), ...shown.yesIds])) {
      if (listed.has(id)) continue;
      const inList = firstById.get(id);
      const snapshot = base?.checks.find((check) => check.id === id);
      const from = inList ?? snapshot;
      criteria.push({
        id,
        name: from?.name || id,
        startDays: shownDays(from?.startDays),
        endDays: shownDays(from?.endDays),
        yes: yes.has(id),
        status: inList ? 'inactive' : 'removed',
      });
    }
  }

  const knitStart = shown.dates.knitStart;
  const knitEnd = shown.dates.knitEnd;
  // A plain boolean (not a field of the derived values), so the memo below depends on the flag alone.
  const isDirty = dirty === true;

  // The Save Data step changes only when the dirty flag does.
  const extra = useMemo<SaveExtra>(
    () => ({ key: 'guide', label: PLANNING_GUIDE_LABEL, isDirty, save: saveForExtra }),
    [isDirty, saveForExtra]
  );

  useUnsavedChanges(PLANNING_GUIDE_SOURCE_ID, isDirty ? [PLANNING_GUIDE_LABEL] : []);

  return {
    ready: !!tnaOrder,
    list,
    listError: list ? '' : retryError || loadError,
    retryingList,
    retryList,
    criteria,
    yesIds: shown.yesIds,
    dates: shown.dates,
    lead,
    leadTooltip: leadTooltip(leadChecks, shown.yesIds, lead),
    rows,
    knitStartAfterEnd: isIsoDay(knitStart) && isIsoDay(knitEnd) && knitStart > knitEnd,
    noTna: !!tnaOrder && TNA_KEYS.every((key) => rawTnaText(tnaOrder, key) === '' && toIsoDay(tnaOrder[key]) === ''),
    stored: newest,
    dirty,
    saving: state.saving,
    reloading: state.reloading,
    notice: state.notice,
    setYes,
    setDate,
    applyRow,
    discard,
    save,
    reload,
    dismissNotice,
    extra,
  };
}
