/* Batch Card (port of js/batch/batch-app.js lines 5009-5185 and the card rule of
   the old BatchApi.route()).
   Batch cards are immutable snapshots of confirmed plans, versioned on regeneration.

   Where the old code wrote HTML, these functions keep what the components need in S and call notify():
     S.ui.cardsPanel        'register' | 'order' | 'preview'  (which of the three old panels is shown)
     S.ui.cardsRegister     CardRegisterView (renderCardRegister: counts, table rows, page info, scope label)
     S.ui.cardsOrder       CardOrderView (openCardOrder)
     S.ui.cardsPreview      CardPreviewView (openBatchCard; the card itself is drawn by components/card/BatchCardSheet,
                            the old batchCardHtml) */
import { BatchApi } from '@/features/batch/api/batch-api';
import { CONFIRMED_HEADER_FIELDS } from '@/features/batch/constants';
import { BATCH_FLOORS, S, notify } from '@/features/batch/store/batch-store';
import {
  canChangeData,
  commitChanges,
  currentUsername,
  getStoredMasterList,
  printWithBodyClass,
  setMutationBusy,
  showSaveError,
  toast,
} from './storage';
import {
  confirmedBatchRevision,
  confirmedRevisionLabel,
  floorLabel,
  getFloorBooking,
  getOrderFloors,
  getReportKnittingRows,
  hasOrderOnFloor,
  knittingSourceFingerprint,
  lastSaveDisplay,
  needsReconfirmation,
  normalizeBookingKey,
  reportFactoryName,
  revisionDisplay,
  revisionLabel,
  revisionNumberFromRows,
  sourceBooking,
  unitTabFloors,
} from './bookings';
import { bodyBatchQuantity, kgText, productionSum } from './batch-calculation';
import {
  buildComponentBatches,
  buildEditableReportTables,
  copyReportData,
  instructionRows,
  reportBookingStatus,
  savedReportPlan,
} from './report-model';
import { highlightUnitTabs } from './plan-flow';
import { closeDailyConfirmFilters, closeDyeableFilters } from './batch-reports';
import type { Row } from '@/features/batch/types';

/* ---------- view data read by components/card ---------- */

/** A Generate button (old cardGenerateButton HTML: data-card-generate / -number / -scope / -blocked). */
export interface CardGenerateAction {
  batchId: string;
  number: string;
  /** '' for an All Orders card (old data-card-scope=""). */
  scope: string;
  /** Disabled until the plan is re-confirmed (old data-card-blocked="true"). */
  blocked: boolean;
  label: string;
}

export interface CardRegisterRow {
  key: string;
  /** Pending list: "View Batches" (old data-card-order / data-card-scope). */
  order?: { number: string; scope: string };
  /** Partial list: the Generate button. */
  generate?: CardGenerateAction;
  /** Completed / Revision lists: "View / Print" (old data-card-view). */
  viewId?: string;
  cells: string[];
}

export interface CardRegisterView {
  counts: { Pending: number; Partial: number; Completed: number; Revision: number };
  headers: string[];
  rows: CardRegisterRow[];
  emptyText: string;
  pageInfo: string;
  previousDisabled: boolean;
  nextDisabled: boolean;
  scopeLabel: string;
}

export interface CardOrderView {
  title: string;
  subtitle: string;
  reconfirm: boolean;
  rows: { key: string; view?: { id: string; label: string }; generate?: CardGenerateAction; cells: string[] }[];
}

export interface CardPreviewView {
  card: Row;
  notice: string;
  /** "Generate Revised Card" (a generate button without data-card-blocked). */
  revise: CardGenerateAction | null;
  /** "Mark Superseded" (old data-card-retire). */
  retireId: string | null;
}

export interface CardScope {
  booking: Row;
  floor: string | null;
}

/** Old esc(value) without the HTML escaping (React escapes text): the displayed text of a value. */
const text = (value: unknown): string => String(value ?? '');

/* ---------- cards and their plans ---------- */

const confirmedCardCache = new WeakMap<object, Map<string | null, Row>>();

export function getBatchCards(): Row[] {
  return S.appState.cards || [];
}

export function cardKey(number: unknown, floor: string | null, batchId: unknown): string {
  return JSON.stringify([normalizeBookingKey(number), floor, batchId]);
}

export function compactCardSignature(value: unknown): string {
  const text = knittingSourceFingerprint([value as Row]);
  let a = 0x811c9dc5,
    b = 0x9e3779b9;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x85ebca6b);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

export function confirmedCardPlan(original: Row | null | undefined, floor: string | null): Row | null {
  if (!original || reportBookingStatus(original, floor) !== 'Confirm') return null;
  let cache = confirmedCardCache.get(original);
  if (!cache) {
    cache = new Map();
    confirmedCardCache.set(original, cache);
  }
  const prior = cache.get(floor);
  if (prior && prior.setup === S.appState.setup && prior.flat === S.appState.flatAllowance && prior.datasets === S.appState.datasets)
    return prior.value;
  const saved = {
    number: S.currentViewingNumber,
    floor: S.currentViewingFloor,
    review: S.currentReportReviewLatest,
    draft: S.reportDraft,
    editor: S.reportRowEditor,
    fabrics: S.currentFabricRows,
    batches: S.currentBatchRows,
    evaluations: S.currentReportMachineEvaluations,
    truncated: S.currentReportBatchRowsTruncated,
    components: S.currentComponentSections,
  };
  let value: Row;
  try {
    S.currentViewingNumber = original.number;
    S.currentViewingFloor = floor;
    S.currentReportReviewLatest = false;
    S.reportDraft = null;
    S.reportRowEditor = null;
    const booking = getFloorBooking(original, floor),
      tables = buildEditableReportTables(booking, floor),
      components: Row[] = buildComponentBatches(booking, floor, tables.rows),
      instructions = instructionRows(booking, floor),
      entries = new Map<unknown, Row>();
    const add = (id: unknown, shade: unknown, ld: unknown, reference: unknown): Row => {
      if (!entries.has(id))
        entries.set(id, { id, shade, ld: ld || '', reference: reference || '', machineLabel: '', bodyRows: [], components: [], qtyKg: 0 });
      return entries.get(id) as Row;
    };
    for (const row of tables.rows as Row[]) {
      if (!row.id) continue;
      const entry = add(row.id, row.shade, row.ld, row.reference);
      entry.bodyRows.push(copyReportData(row));
      entry.machineLabel = row.machineLabel || entry.machineLabel;
      entry.qtyKg = productionSum([entry.qtyKg, bodyBatchQuantity(row, tables.fabrics)]);
    }
    for (const section of components)
      for (const row of section.rows as Row[]) {
        const entry = add(row.id, row.shade, row.ld, row.reference);
        entry.components.push({
          kind: section.kind,
          title: section.title,
          fabricType: row.fabricType,
          quantities: copyReportData(row.quantities),
          dyeingType: section.dyeingType,
          totalPcs: row.totalPcs,
          totalKg: row.totalKg,
          weights: copyReportData(row.weights),
        });
        entry.qtyKg = row.totalKg === null ? null : entry.qtyKg === null ? null : productionSum([entry.qtyKg, row.totalKg]);
      }
    const header = Object.fromEntries(
        CONFIRMED_HEADER_FIELDS.filter((key) => booking[key] !== undefined).map((key) => [key, booking[key]])
      ),
      revisionNo =
        savedReportPlan(original, floor).confirmedSnapshot?.revisionNo ?? revisionNumberFromRows(getReportKnittingRows(original.number, floor));
    const correctionAt = savedReportPlan(original, floor).pmcCorrectionAt;
    const signature = compactCardSignature({
      header,
      revisionNo,
      fabrics: tables.fabrics,
      entries: Array.from(entries.values()),
      instructions,
      ...(correctionAt ? { pmcCorrectionAt: correctionAt } : {}),
    });
    value = copyReportData({
      number: original.number,
      floor,
      header,
      fabrics: tables.fabrics,
      instructions,
      revisionNo,
      revisionLabel: confirmedRevisionLabel(original, floor),
      signature,
      entries: Array.from(entries.values()),
      truncated: S.currentReportBatchRowsTruncated,
    });
  } finally {
    S.currentViewingNumber = saved.number;
    S.currentViewingFloor = saved.floor;
    S.currentReportReviewLatest = saved.review;
    S.reportDraft = saved.draft;
    S.reportRowEditor = saved.editor;
    S.currentFabricRows = saved.fabrics;
    S.currentBatchRows = saved.batches;
    S.currentReportMachineEvaluations = saved.evaluations;
    S.currentReportBatchRowsTruncated = saved.truncated;
    S.currentComponentSections = saved.components;
  }
  cache.set(floor, { setup: S.appState.setup, flat: S.appState.flatAllowance, datasets: S.appState.datasets, value });
  return value;
}

/* Project: units follow the Dyeing Plan and can change after cards were made. While an order's All Orders
   plan is confirmed and has active cards, its batches are not offered again under a unit, so no batch gets a
   second active card; the All Orders scope stays for those cards. */
export function hasWholeOrderCards(booking: Row): boolean {
  const cards = getBatchCards();
  if (S.wholeOrderCardsSource !== cards) {
    S.wholeOrderCardsSource = cards;
    S.wholeOrderCardOrders = new Set(
      cards.filter((card) => !card.floor && card.status !== 'superseded').map((card) => normalizeBookingKey(card.number) as string)
    );
  }
  return booking.status === 'Confirm' && S.wholeOrderCardOrders.has(normalizeBookingKey(booking.number));
}

export function confirmedCardScopes(floor: string | null = S.activeCardFloor): CardScope[] {
  const scopes: CardScope[] = [];
  for (const booking of getStoredMasterList()) {
    const wholeOrder = hasWholeOrderCards(booking);
    if (floor) {
      if (!wholeOrder && hasOrderOnFloor(booking.number, floor) && reportBookingStatus(booking, floor) === 'Confirm') scopes.push({ booking, floor });
      continue;
    }
    const floors: string[] = wholeOrder ? [] : getOrderFloors(booking.number).filter((key: string) => reportBookingStatus(booking, key) === 'Confirm');
    for (const key of floors) scopes.push({ booking, floor: key });
    if (!floors.length && booking.status === 'Confirm') scopes.push({ booking, floor: null });
  }
  return scopes;
}

export function batchCardRevisionReason(card: Row): string {
  const booking = sourceBooking(card.number);
  if (!booking || reportBookingStatus(booking, card.floor) !== 'Confirm') return 'Batch plan is not currently confirmed.';
  const revision = confirmedBatchRevision(booking, card.floor);
  if (revision !== card.revisionNo)
    return 'Confirmed batch plan revision: ' + revisionDisplay(revision) + '; card revision: ' + revisionDisplay(card.revisionNo) + '.';
  if (needsReconfirmation(booking, card.floor)) return 'Uploaded data changed. Re-confirm the batch plan first.';
  const plan = confirmedCardPlan(booking, card.floor) as Row;
  if (!plan.entries.some((entry: Row) => entry.id === card.batchId)) return 'This batch is no longer in the confirmed plan.';
  if (plan.signature !== card.planSignature) return 'The confirmed batch plan has changed.';
  return '';
}

export function cardReady(booking: Row | null | undefined, floor: string | null, plan: Row | null | undefined): boolean {
  return !!plan && !plan.truncated && !needsReconfirmation(booking as Row, floor);
}

/* ---------- route and register ---------- */

/** Opens the Batch Card list of a unit (null = All Orders). State only: the route component calls it when its
    unit changes (the old switchMainView('cards') part: the report dialogs close and the register is rendered). */
export function selectCardFloor(floor: string | null): void {
  S.activeCardFloor = BATCH_FLOORS.some((value) => value.key === floor) ? floor : null;
  S.cardPage = 1;
  closeDailyConfirmFilters();
  closeDyeableFilters(false);
  renderCardRegister();
}

/** The old BatchApi.route() rule for 'card' and 'card/<UNIT>' (run once the data has loaded, and again when the
    sidebar re-opens the same page). A unit that is no longer in the list opens All Orders for a user with the
    all-orders permission, else the first unit the user may open; the URL follows (BatchApi.syncRoute). */
export function showCardRoute(sub: string | null): void {
  const floorKeys = BATCH_FLOORS.map((floor) => floor.key);
  let floor = floorKeys.includes(String(sub || '').toUpperCase()) ? String(sub).toUpperCase() : null;
  if (S.storageReady && !floor) {
    const all = BatchApi.has('menus.batchCard.all');
    if (!all) floor = floorKeys.find((key) => BatchApi.has('menus.batchCard.' + key.toLowerCase())) || null;
    if ((all || floor) && (sub || floor)) BatchApi.syncRoute(floor ? 'card/' + floor : 'card');
  }
  selectCardFloor(floor);
}

export function renderCardRegister(): void {
  S.currentCardOrder = null;
  S.currentCardRecordId = null;
  S.ui.cardsPanel = 'register';
  // Project: like getFloorBookings, all cards are listed only for users with the all-orders Batch Card permission.
  // Plan section 18: while the search box has a text, the list covers every unit the user may open
  // (and the whole-order cards with the all-orders permission); the Floor column names the unit.
  const search = S.cardSearch.trim().toLowerCase();
  const allowed = !!S.activeCardFloor || BatchApi.has('menus.batchCard.all');
  const searchFloors = search ? new Set<string>(unitTabFloors('batchCard').map((floor: Row) => floor.key)) : null;
  const inSearchScope = (floor: string | null): boolean => (floor ? (searchFloors as Set<string>).has(floor) : BatchApi.has('menus.batchCard.all'));
  const scopes = search ? confirmedCardScopes(null).filter((scope) => inSearchScope(scope.floor)) : allowed ? confirmedCardScopes() : [];
  const records = getBatchCards().filter(
    (card) =>
      card.status !== 'superseded' &&
      (search ? inSearchScope(card.floor) : allowed && (!S.activeCardFloor || card.floor === S.activeCardFloor))
  );
  const completed = records.filter((card) => !batchCardRevisionReason(card)),
    revisions = records.filter((card) => !!batchCardRevisionReason(card)),
    partial: Row[] = [];
  for (const scope of scopes) {
    const plan = confirmedCardPlan(scope.booking, scope.floor) as Row,
      created = new Set(
        records
          .filter((card) => normalizeBookingKey(card.number) === normalizeBookingKey(scope.booking.number) && card.floor === scope.floor)
          .map((card) => card.batchId)
      );
    if (created.size && plan.entries.some((entry: Row) => created.has(entry.id)))
      for (const entry of plan.entries as Row[]) if (!created.has(entry.id)) partial.push({ ...scope, plan, entry });
  }
  const counts = { Pending: scopes.length, Partial: partial.length, Completed: completed.length, Revision: revisions.length };
  highlightUnitTabs('cards');
  // The unit tab counts (old [data-card-floor-count]) are computed by the tabs (planflow's updateCardFloorCounts).
  const status = S.activeCardStatus;
  let rows: Row[] = status === 'Pending' ? scopes : status === 'Partial' ? partial : status === 'Completed' ? completed : revisions;
  if (search)
    rows = rows.filter((row) => {
      const booking = row.booking || row.snapshot?.header || sourceBooking(row.number) || {};
      return [booking.number, booking.buyer, row.entry?.id, row.batchId].some((value) => String(value || '').toLowerCase().includes(search));
    });
  const total = rows.length,
    size = S.cardPageSize === 'All' ? Math.max(1, total) : Number(S.cardPageSize),
    pages = Math.max(1, Math.ceil(total / size));
  S.cardPage = Math.max(1, Math.min(S.cardPage, pages));
  const visible = S.cardPageSize === 'All' ? rows : rows.slice((S.cardPage - 1) * size, S.cardPage * size);
  const pageInfo = 'Page ' + S.cardPage + ' of ' + pages + ' · ' + total + ' ' + (status === 'Pending' ? 'orders' : 'batches');
  const headers =
    status === 'Pending'
      ? ['Manage', 'Order/Booking No.', 'Floor', 'Booking Date', 'Buyer', 'Confirmed By', 'Last Save', 'Cards generated']
      : status === 'Partial'
        ? ['Manage', 'Order/Booking No.', 'Floor', 'Buyer', 'Batch #', 'Color', 'Qty (kg)', 'Flat Qty (pcs)', 'Revision']
        : ['Manage', 'Order/Booking No.', 'Floor', 'Buyer', 'Batch #', 'Color', 'Generated By', 'Generated At', 'Revision', ...(status === 'Revision' ? ['Reason'] : [])];
  const viewRows: CardRegisterRow[] = visible.map((row, index) => {
    const key = status + ':' + index;
    if (status === 'Pending') {
      const booking = getFloorBooking(row.booking, row.floor),
        plan = confirmedCardPlan(row.booking, row.floor) as Row,
        created = records.filter(
          (card) =>
            normalizeBookingKey(card.number) === normalizeBookingKey(booking.number) &&
            card.floor === row.floor &&
            plan.entries.some((entry: Row) => entry.id === card.batchId)
        ).length;
      return {
        key,
        order: { number: text(booking.number), scope: text(row.floor || '') },
        cells: [
          booking.number,
          floorLabel(row.floor),
          booking.date,
          booking.buyer,
          booking.confirmedBy || '—',
          lastSaveDisplay(booking.lastSaveAt),
          created + ' / ' + plan.entries.length,
        ].map((value) => text(value || '—')),
      };
    }
    if (status === 'Partial')
      return {
        key,
        generate: cardGenerateButton(row.booking, row.floor, row.plan, row.entry),
        cells: [
          row.booking.number,
          floorLabel(row.floor),
          row.plan.header.buyer,
          row.entry.id,
          row.entry.shade,
          kgText(row.entry.qtyKg),
          (row.entry.components as Row[]).reduce(
            (sum: number, component) => sum + Object.values(component.quantities as Record<string, number>).reduce((a, b) => a + b, 0),
            0
          ),
          revisionDisplay(row.plan.revisionNo),
        ].map((value) => text(value)),
      };
    return {
      key,
      viewId: text(row.id),
      cells: [
        row.number,
        floorLabel(row.floor),
        row.snapshot.header.buyer,
        row.batchId,
        row.snapshot.entry.shade,
        row.generatedBy,
        lastSaveDisplay(row.generatedAt),
        revisionDisplay(row.revisionNo),
        ...(status === 'Revision' ? [batchCardRevisionReason(row)] : []),
      ].map((value) => text(value || '—')),
    };
  });
  const view: CardRegisterView = {
    counts,
    headers,
    rows: viewRows,
    emptyText: 'No matching ' + (status === 'Pending' ? 'confirmed orders' : 'batches') + '.',
    pageInfo,
    previousDisabled: S.cardPage <= 1,
    nextDisabled: S.cardPage >= pages,
    scopeLabel:
      (search
        ? 'Search results in all units for "' +
          S.cardSearch.trim() +
          '" · ' +
          total +
          ' ' +
          (status === 'Pending' ? 'order(s)' : 'batch(es)') +
          ' · The Floor column names the unit. Clear the search to return to ' +
          floorLabel(S.activeCardFloor) +
          '.'
        : 'Batch Card · ' + floorLabel(S.activeCardFloor)) +
      ' · Confirmed plans are read-only here. Pending shows confirmed orders; Partial lists ungenerated batches from orders with cards already generated.',
  };
  S.ui.cardsRegister = view;
  notify();
}

/** Old cardGenerateButton (returned the button's HTML): the data of the Generate button. */
export function cardGenerateButton(booking: Row, floor: string | null, plan: Row | null, entry: Row): CardGenerateAction {
  const ready = cardReady(booking, floor, plan);
  return {
    batchId: text(entry.id),
    number: text(booking.number),
    scope: text(floor || ''),
    blocked: !ready,
    label: ready ? 'Generate Card' : 'Re-confirm plan first',
  };
}

export function openCardOrder(number: string, floor: string | null): void {
  // No booking -> no plan -> return (the cast only tells TypeScript).
  const booking = sourceBooking(number) as Row,
    plan = confirmedCardPlan(booking, floor);
  if (!plan) return;
  S.currentCardOrder = { number: booking.number, floor };
  S.ui.cardsPanel = 'order';
  const rows = (plan.entries as Row[]).map((entry, index) => {
    const card = getBatchCards().find(
      (card) =>
        normalizeBookingKey(card.number) === normalizeBookingKey(booking.number) &&
        card.floor === floor &&
        card.batchId === entry.id &&
        card.status !== 'superseded'
    );
    return {
      key: String(index),
      view: card ? { id: text(card.id), label: batchCardRevisionReason(card) ? 'Revision Pending' : 'View / Print' } : undefined,
      generate: card ? undefined : cardGenerateButton(booking, floor, plan, entry),
      cells: [
        entry.id,
        entry.shade,
        entry.machineLabel || '—',
        kgText(entry.qtyKg),
        (entry.components as Row[]).reduce(
          (sum: number, component) => sum + Object.values(component.quantities as Record<string, number>).reduce((a, b) => a + b, 0),
          0
        ),
        card ? 'Generated' : 'Not generated',
      ].map((value) => text(value)),
    };
  });
  const view: CardOrderView = {
    title: 'Order / Booking No: ' + text(booking.number) + ' · ' + text(floorLabel(floor)),
    subtitle: text(plan.header.buyer) + ' · ' + text(revisionLabel(plan.revisionNo) || 'Revision not provided'),
    reconfirm: !!needsReconfirmation(booking, floor),
    rows,
  };
  S.ui.cardsOrder = view;
  notify();
}

export async function generateBatchCard(number: string, floor: string | null, batchId: string): Promise<boolean> {
  if (!canChangeData()) return false;
  if (floor && sourceBooking(number) && hasWholeOrderCards(sourceBooking(number) as Row)) {
    toast('Order ' + number + ' has batch cards from its All Orders plan. Move that plan to Pending before making unit cards.');
    return false;
  }
  // No booking -> no plan -> not ready -> return (the cast only tells TypeScript).
  const booking = sourceBooking(number) as Row,
    plan = confirmedCardPlan(booking, floor);
  if (!cardReady(booking, floor, plan)) {
    toast('Re-confirm the latest batch plan before generating this card.');
    return false;
  }
  const readyPlan = plan as Row;
  const entry = (readyPlan.entries as Row[]).find((entry) => entry.id === batchId);
  if (!entry) {
    toast('This batch is not in the confirmed plan.');
    return false;
  }
  const records: Row[] = copyReportData(getBatchCards()),
    index = records.findIndex((card) => card.id === cardKey(number, floor, batchId)),
    old = index >= 0 ? records[index] : null;
  if (old && old.status !== 'superseded' && !batchCardRevisionReason(old)) {
    openBatchCard(old.id);
    return true;
  }
  const history = old ? [...(old.history || []), Object.fromEntries(Object.entries(old).filter(([key]) => key !== 'history'))] : [];
  const used = (readyPlan.fabrics as Row[]).filter((fabric) => (entry.bodyRows as Row[]).some((row) => (row.quantities[fabric.key] || 0) > 0));
  const record: Row = {
    id: cardKey(number, floor, batchId),
    number: booking.number,
    floor,
    batchId,
    revisionNo: readyPlan.revisionNo,
    planSignature: readyPlan.signature,
    version: (old?.version || 0) + 1,
    generatedBy: currentUsername(),
    generatedAt: new Date().toISOString(),
    status: 'active',
    history,
    snapshot: copyReportData({
      factory: reportFactoryName(floor),
      header: readyPlan.header,
      revisionLabel: readyPlan.revisionLabel || revisionLabel(readyPlan.revisionNo),
      entry,
      fabrics: used,
      instructions: readyPlan.instructions,
    }),
  };
  if (index >= 0) records[index] = record;
  else records.push(record);
  setMutationBusy(true);
  try {
    await commitChanges({ cards: records });
    renderCardRegister();
    openBatchCard(record.id);
    toast(old ? 'Revised batch card generated.' : 'Batch card generated.');
    return true;
  } catch (error) {
    showSaveError(error);
    return false;
  } finally {
    setMutationBusy(false);
  }
}

export function openBatchCard(id: string): void {
  const card = getBatchCards().find((card) => card.id === id);
  if (!card) return;
  S.currentCardRecordId = id;
  S.ui.cardsPanel = 'preview';
  const reason = batchCardRevisionReason(card),
    booking = sourceBooking(card.number),
    plan = confirmedCardPlan(booking, card.floor),
    entry = plan?.entries.find((entry: Row) => entry.id === card.batchId),
    canRevise = reason && entry && cardReady(booking, card.floor, plan);
  const view: CardPreviewView = {
    card,
    notice: reason ? 'Revision Pending: ' + reason : 'Completed · Generated card is saved as a snapshot.',
    revise: canRevise ? { batchId: text(card.batchId), number: text(card.number), scope: text(card.floor || ''), blocked: false, label: 'Generate Revised Card' } : null,
    retireId: !canRevise && reason && !entry && cardReady(booking, card.floor, plan) ? text(card.id) : null, // old: canRevise ? revise : reason && !entry && ready ? retire : ''
  };
  S.ui.cardsPreview = view;
  notify();
}

export async function retireBatchCard(id: string): Promise<boolean> {
  if (!canChangeData()) return false;
  const records: Row[] = copyReportData(getBatchCards()),
    record = records.find((card) => card.id === id);
  if (!record) return false;
  const plan = confirmedCardPlan(sourceBooking(record.number), record.floor);
  if (!plan || plan.entries.some((entry: Row) => entry.id === record.batchId)) {
    toast('Only a batch removed from the latest confirmed plan can be marked superseded.');
    return false;
  }
  record.status = 'superseded';
  setMutationBusy(true);
  try {
    await commitChanges({ cards: records });
    renderCardRegister();
    toast('Previous card retained as superseded.');
    return true;
  } catch (error) {
    showSaveError(error);
    return false;
  } finally {
    setMutationBusy(false);
  }
}

/* ---------- the old listeners of #batchCardView ---------- */

/** Status tab of the register (old [data-card-status] click). */
export function setCardStatus(status: string): void {
  S.activeCardStatus = status;
  S.cardPage = 1;
  renderCardRegister();
}

/** The register's search box (old #cardSearch input). */
export function setCardSearch(value: string): void {
  S.cardSearch = value;
  S.cardPage = 1;
  renderCardRegister();
}

/** Rows per page (old #cardPageSize change). */
export function setCardPageSize(value: string): void {
  S.cardPageSize = value;
  S.cardPage = 1;
  renderCardRegister();
}

/** Previous (-1) / Next (+1) page (old #cardPrevious / #cardNext). */
export function changeCardPage(step: number): void {
  S.cardPage += step;
  renderCardRegister();
}

/** Print / Save PDF of the open card (old #btnPrintBatchCard). */
export function printBatchCard(): void {
  printWithBodyClass('printing-batch-card');
}
