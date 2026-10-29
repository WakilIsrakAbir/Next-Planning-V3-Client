/* Batch Plan: bookings, units, revisions and confirmed snapshots (ported from the old js/batch/batch-app.js; see docs/batch-module.md).
   Formatting helpers, booking keys, units/floors and the knitting index, floor bookings, the all-units
   search, revisions and report locking, knitting fingerprints, confirmed snapshots and Need Re-Confirm,
   General Info values and Unit Setup values.
   The rules are unchanged; the old top-level variables are `S.<name>` (store/batch-store.ts). No DOM here. */
import {
  APP_SETTINGS,
  CONFIRMED_HEADER_FIELDS,
  FLOOR_FACTORY_NAMES,
  INITIAL_UNIT_SETUP,
  KNITTING_INFO_HEADERS,
} from '@/features/batch/constants';
import { BATCH_FLOORS, DEMO_FLOOR_ALIASES, DYEABLE_FLOOR_LABELS, S, floorAliases, floorValueKey } from '@/features/batch/store/batch-store';
import { BatchApi } from '@/features/batch/api/batch-api';
import { canChangeData, getStoredDatasets, getStoredMasterList, toast } from './storage';
import { fabricQuantity, getFlatAllowance, hasPeachFinish } from './batch-calculation';
import {
  bpValue,
  buildComponentBatches,
  buildEditableReportTables,
  copyReportData,
  currentReportBooking,
  getBpRows,
  instructionRows,
  reportBookingStatus,
  reportManualState,
  savedReportPlan,
} from './report-model';
import { dyeablePrintedAt, generalPlanTimestamp } from './batch-reports';
import type { BatchFloor, BatchUnit, Booking, Row } from '@/features/batch/types';

/** A cell value of an uploaded Excel row (free-form, like the old code). */
type CellValue = Row[string];

/* ============================================================
   Messages, dates and file size formatting
   ============================================================ */
export function lastSaveDisplay(value: unknown): string {
  if (!value) return '—';
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export function formatExcelDate(val: unknown): string {
  if (!val) return '—';
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return String(val);
}

/* Additional report fields use named Excel headers (KNITTING_INFO_HEADERS), in any column position.
   Spaces, punctuation and letter case are ignored. */
export function knittingInfoHeaderKey(value: unknown): string {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}
export function knittingInfoValue(row: Row, field: string): CellValue {
  const values = new Map<string, CellValue>();
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined || String(value).trim() === '') continue;
    const normalized = knittingInfoHeaderKey(key);
    if (!values.has(normalized)) values.set(normalized, value);
  }
  for (const header of (KNITTING_INFO_HEADERS as Record<string, string[] | undefined>)[field] || []) {
    const key = knittingInfoHeaderKey(header);
    if (values.has(key)) return values.get(key);
  }
  return '';
}

export function normalizeBookingKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/^(BDS|PPS)[\s-]*/, '')
    .replace(/^-+(?=\d)/, '');
}

/* ============================================================
   Units (floors)
   The server writes each knitting row's floor from the Dyeing Plan unit of its colour into
   _fabricColumns.floor. Unknown/blank values stay in the parent Batch Plan register until a unit is set.
   ============================================================ */
export function normalizeFloor(value: unknown): string | null {
  return floorAliases.get(floorValueKey(value)) || null;
}
/* The floor list is the list of Dyeing Plan units that the server sends ([{key, label}], e.g. EFL, EKL, Ext,
   DTL). The demo's five floors keep their keys and old spellings (DEMO_FLOOR_ALIASES). BATCH_FLOORS,
   floorAliases and DYEABLE_FLOOR_LABELS (store/batch-store.ts) are changed in place. */
export function setBatchUnits(units: ReadonlyArray<Partial<BatchUnit> | null | undefined>): void {
  BATCH_FLOORS.length = 0;
  for (const unit of units) {
    const key = String((unit && unit.key) || '').trim();
    if (!/^[A-Z0-9]{1,40}$/.test(key) || BATCH_FLOORS.some((floor) => floor.key === key)) continue;
    // Unit names come from Dropdown Master or the Dyeing file; HTML characters are dropped before display.
    const label = String(unit?.label || key).replace(/[<>&"'`]/g, '').trim() || key;
    BATCH_FLOORS.push({ key, label, aliases: [label, key, ...(DEMO_FLOOR_ALIASES[key] || [])] });
  }
  floorAliases.clear();
  for (const [key, aliases] of Object.entries(DEMO_FLOOR_ALIASES)) for (const alias of aliases) floorAliases.set(floorValueKey(alias), key);
  for (const floor of BATCH_FLOORS) for (const alias of floor.aliases) floorAliases.set(floorValueKey(alias), floor.key);
  for (const key of Object.keys(DYEABLE_FLOOR_LABELS)) delete DYEABLE_FLOOR_LABELS[key];
  for (const floor of BATCH_FLOORS) DYEABLE_FLOOR_LABELS[floor.key] = floor.label;
}
// A unit key that is not in the current list shows its own name, not 'All Floors'.
export function floorLabel(key: string | null | undefined): string {
  return BATCH_FLOORS.find((floor) => floor.key === key)?.label || (key ? DEMO_FLOOR_ALIASES[key]?.[0] || key : 'All Floors');
}
export function knittingRowFloor(row: Row): string | null {
  return normalizeFloor(row._fabricColumns?.floor);
}

/* ============================================================
   Knitting index and floor bookings
   Rebuilt only after a new Knitting Plan dataset is saved. Register pagination, counts and report lookups
   reuse this index even for large uploaded files.
   ============================================================ */
interface KnittingIndexEntry {
  rows: Row[];
  floors: Map<string, Row[]>;
}

export function ensureKnittingIndex(): void {
  const plan = getStoredDatasets().knitPlan || {};
  if (S.indexedKnittingPlan === plan) return;
  S.indexedKnittingPlan = plan;
  S.knittingBookingIndex = new Map();
  for (const [number, rows] of Object.entries(plan)) {
    const key = normalizeBookingKey(number);
    if (!S.knittingBookingIndex.has(key)) S.knittingBookingIndex.set(key, { rows: [], floors: new Map() });
    const entry = S.knittingBookingIndex.get(key) as KnittingIndexEntry;
    for (const row of rows) {
      entry.rows.push(row);
      const floor = knittingRowFloor(row);
      if (!floor) continue;
      if (!entry.floors.has(floor)) entry.floors.set(floor, []);
      (entry.floors.get(floor) as Row[]).push(row);
    }
  }
}
export function getKnittingRows(orderNo: unknown, floor: string | null = null): Row[] {
  ensureKnittingIndex();
  const entry = S.knittingBookingIndex.get(normalizeBookingKey(orderNo)) as KnittingIndexEntry | undefined;
  return entry ? (floor ? entry.floors.get(floor) || [] : entry.rows) : [];
}
export function sourceBooking(number: unknown): Booking | undefined {
  const master = getStoredMasterList();
  if (S.indexedSourceMaster !== master) {
    S.indexedSourceMaster = master;
    S.sourceBookingIndex = new Map(master.map((booking) => [normalizeBookingKey(booking.number), booking]));
  }
  return S.sourceBookingIndex.get(normalizeBookingKey(number)) as Booking | undefined;
}
export function hasOrderOnFloor(number: string, floor: string | null): boolean {
  if (getKnittingRows(number, floor).length) return true;
  const booking = sourceBooking(number);
  const plan = booking?.floorPlans?.[floor as string];
  return plan?.status === 'Confirm' && !!plan.confirmedSnapshot?.sourceRows?.length;
}
export function getOrderFloors(number: string): string[] {
  return BATCH_FLOORS.filter((floor) => hasOrderOnFloor(number, floor.key)).map((floor) => floor.key);
}
export function reviewingLatest(number: string | null | undefined, floor: string | null | undefined): boolean {
  return S.currentReportReviewLatest && S.currentViewingNumber === number && S.currentViewingFloor === floor;
}
export function getReportKnittingRows(number: string, floor: string | null = null): Row[] {
  const capture = S.confirmedCaptureContext;
  if (capture?.booking.number === number && (capture as Row).floor === floor) {
    const snapshot = savedReportPlan((capture as Row).booking, floor).confirmedSnapshot;
    if (snapshot) return snapshot.sourceRows;
  }
  if (reviewingLatest(number, floor)) {
    const draft = S.reportDraft;
    return draft?.number === number && (draft as Row).floor === floor && (draft as Row).reviewLatest
      ? (draft as Row).reviewSourceRows
      : getKnittingRows(number, floor);
  }
  const booking = sourceBooking(number);
  const plan = booking && savedReportPlan(booking, floor);
  return plan && reportBookingStatus(booking as Booking, floor) === 'Confirm' && plan.confirmedSnapshot
    ? plan.confirmedSnapshot.sourceRows
    : getKnittingRows(number, floor);
}
export function treatmentInfo(items: Row[]): { brush: string; peach: string; heatset: string } {
  return {
    brush: items.some((item) => /\bbrush(?:ing|ed)?\b/i.test(String(item._fabricColumns?.brush || ''))) ? 'Brush' : '',
    peach: items.some((item) => hasPeachFinish(item._fabricColumns?.peach)) ? 'Peach' : '',
    heatset: items.some((item) =>
      /\bset\b|\bheat\s*set\b|\blycra\s*2\s*[x×]\s*2\s*rib\b/i.test(String(item._fabricColumns?.heatset || ''))
    )
      ? 'Heatset'
      : '',
  };
}
export function getFloorBooking(booking: Row, floor: string | null = S.activeFloor): Booking {
  const local: Row = floor ? booking.floorPlans?.[floor] || {} : booking;
  const status = local.status || booking.status || 'Pending';
  const frozen = status === 'Confirm' && !reviewingLatest(booking.number, floor) ? local.confirmedSnapshot?.headerData || {} : {};
  if (!floor) return { ...booking, ...frozen, ...generalInfoOverrides(booking, floor), status } as Booking;
  return {
    ...booking,
    ...frozen,
    status,
    batchDate: local.batchDate || '',
    revisedBatch: local.revisedBatch || '',
    tentativeBy: local.tentativeBy || '',
    confirmedBy: local.confirmedBy || '',
    lastSaveAt: local.lastSaveAt || '',
    batches: local.batches || [],
    recipe: local.recipe || [],
    ...treatmentInfo(getReportKnittingRows(booking.number, floor)),
    ...generalInfoOverrides(booking, floor),
  } as Booking;
}
export function getFloorBookings(floor: string | null = S.activeFloor): Booking[] {
  // The all-orders list is for users with the all-orders permission; a unit-only user who lands there
  // (a unit no longer in use) sees it empty.
  if (!floor && !BatchApi.has('menus.batchPlan.all')) return [];
  return getStoredMasterList()
    .filter((booking) => !floor || hasOrderOnFloor(booking.number, floor))
    .map((booking) => getFloorBooking(booking, floor));
}

/* ---------- unit tabs in the page heading and the all-units search ---------- */
// The units the user may open on one page (menus.<group>.<unit> or the all-orders permission).
export function unitTabFloors(group: string): BatchFloor[] {
  const all = BatchApi.has('menus.' + group + '.all');
  return BATCH_FLOORS.filter((floor) => all || BatchApi.has('menus.' + group + '.' + floor.key.toLowerCase()));
}
/** Text of the register search box (old #globalSearchInput), trimmed and lower-cased. */
export function globalSearchTerm(): string {
  return S.globalSearch.trim().toLowerCase();
}
export function isGlobalSearch(): boolean {
  return !!globalSearchTerm();
}
/** The Batch Card search box (old #cardSearch) has text. */
export function isGlobalCardSearch(): boolean {
  return !!S.cardSearch.trim();
}
export function matchesGlobalSearch(booking: Row, term: string): boolean {
  return (booking.number || '').toLowerCase().includes(term) || (booking.buyer || '').toLowerCase().includes(term);
}
/* The all-units search list: one row per (order, unit) for every unit the user may open, like the Need
   Re-Confirm list (_registerFloor names the unit; the eye button opens that unit's plan). The all-orders
   scope (_registerFloor null) is added only for an order whose whole-order plan is Tentative or Confirm, or
   that has no unit at all, so unit-less orders stay findable without listing every order twice. */
export function globalSearchBookings(): Booking[] {
  const floors = unitTabFloors('batchPlan').map((floor) => floor.key);
  const all = BatchApi.has('menus.batchPlan.all');
  const rows: Booking[] = [];
  for (const booking of getStoredMasterList()) {
    const onFloors = getOrderFloors(booking.number);
    for (const floor of floors) if (onFloors.includes(floor)) rows.push({ ...getFloorBooking(booking, floor), _registerFloor: floor });
    if (all && (['Tentative', 'Confirm'].includes(booking.status as string) || !onFloors.length))
      rows.push({ ...getFloorBooking(booking, null), _registerFloor: null });
  }
  return rows;
}
// Need Re-Confirm rows of every unit the user may open (the all-orders list's rule, limited to those units).
export function globalReconfirmBookings(): Booking[] {
  const floors = unitTabFloors('batchPlan').map((floor) => floor.key);
  const all = BatchApi.has('menus.batchPlan.all');
  const rows: Booking[] = [];
  for (const booking of getStoredMasterList()) {
    if (all && needsReconfirmation(booking, null)) {
      rows.push({ ...getFloorBooking(booking, null), _registerFloor: null });
      continue;
    }
    for (const floor of floors) if (needsReconfirmation(booking, floor)) rows.push({ ...getFloorBooking(booking, floor), _registerFloor: floor });
  }
  return rows;
}

/* ============================================================
   Revisions and report locking
   Factory headings are selected from the active Batch Plan unit; units without a custom heading keep the
   original company name.
   ============================================================ */
export function reportFactoryName(floor: string | null | undefined): string {
  return (FLOOR_FACTORY_NAMES as Record<string, string | undefined>)[floor as string] || APP_SETTINGS.companyName;
}
// Named revision headers work in any Excel column. Missing values remain unknown.
export function revisionNumberFromRows(rows: Row[]): number | null {
  let revision: number | null = null;
  for (const row of rows)
    for (const [key, value] of Object.entries(row)) {
      if (key.replace(/[^a-z0-9]/gi, '').toLowerCase() !== 'ybrevisedno') continue;
      const text = String(value ?? '').trim();
      if (!/^\d+(?:\.0+)?$/.test(text)) continue;
      const number = Number(text);
      if (Number.isSafeInteger(number) && number >= 0) revision = Math.max(revision ?? 0, number);
    }
  return revision;
}
export function revisionLabel(revision: number | null | undefined): string {
  if (revision === null || revision === undefined) return '';
  if (!revision) return 'Main Batch Plan';
  const lastTwo = revision % 100,
    suffix = lastTwo >= 11 && lastTwo <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[revision % 10] || 'th';
  return revision + suffix + ' Revised Batch Plan';
}
export function batchPlanRevision(number: string, floor: string | null): string {
  const booking = sourceBooking(number);
  return booking && savedReportPlan(booking, floor).confirmedSnapshot
    ? confirmedRevisionLabel(booking, floor)
    : revisionLabel(revisionNumberFromRows(getReportKnittingRows(number, floor)));
}
// A confirmed BP revision belongs to the plan, independently of source YB revisions.
export function confirmedBatchRevision(booking: Row, floor: string | null): number | null {
  const snapshot = savedReportPlan(booking, floor).confirmedSnapshot;
  return snapshot && Object.prototype.hasOwnProperty.call(snapshot, 'revisionNo')
    ? snapshot.revisionNo
    : revisionNumberFromRows(getReportKnittingRows(booking.number, floor));
}
export function pmcCorrectionDate(value: unknown): string {
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) return '';
  const timeZone = APP_SETTINGS.correctionTimeZone || 'Asia/Dhaka';
  const time = date.toLocaleTimeString('en-US', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const day = date.toLocaleDateString('en-GB', { timeZone, day: '2-digit', month: 'short', year: 'numeric' });
  return time + ', ' + day;
}
export function confirmedRevisionLabel(booking: Row, floor: string | null): string {
  const plan = savedReportPlan(booking, floor),
    label = revisionLabel(confirmedBatchRevision(booking, floor)),
    date = plan.pmcCorrectionAt && pmcCorrectionDate(plan.pmcCorrectionAt);
  return label + (date ? ' (Correction from PMC, Correction date: ' + date + ' )' : '');
}
const confirmedReportLockCache = new WeakMap<object, { datasets: unknown; floors: Map<string | null, boolean> }>();
export function confirmedReportLocked(
  booking: Row | null | undefined = currentReportBooking(),
  floor: string | null = S.currentViewingFloor
): boolean {
  if (!booking || reviewingLatest(booking.number, floor)) return false;
  const source: Row = sourceBooking(booking.number) || booking,
    datasets = getStoredDatasets();
  let cached = confirmedReportLockCache.get(source);
  if (!cached || cached.datasets !== datasets) {
    cached = { datasets, floors: new Map() };
    confirmedReportLockCache.set(source, cached);
  }
  if (!cached.floors.has(floor)) cached.floors.set(floor, needsReconfirmation(source, floor));
  return cached.floors.get(floor) as boolean;
}
export function canEditReport(): boolean {
  if (!canChangeData()) return false;
  if (confirmedReportLocked()) {
    toast('This confirmed plan is read-only. Open it from Need Re-Confirm List to review and save the latest data.');
    return false;
  }
  return true;
}
// Confirmed edits are local drafts until the user approves Internal change.
export function isConfirmedInternalDraft(): boolean {
  const booking = currentReportBooking();
  return !!booking && !!S.reportDraft && !S.reportDraft.reviewLatest && reportBookingStatus(booking, S.currentViewingFloor) === 'Confirm';
}
export function reportSaveHint(): string {
  return isConfirmedInternalDraft()
    ? 'Click Internal change to approve.'
    : S.reportDraft?.reviewLatest
      ? 'Re-confirm the latest plan to retain it.'
      : 'Save as Tentative or Confirmed to retain it.';
}
export function latestRevisionNo(number: string, floor: string | null): number | null {
  const rows = getKnittingRows(number, floor);
  return revisionNumberFromRows(rows.length ? rows : getKnittingRows(number));
}
export function revisionDisplay(revision: unknown): string {
  return revision === null || revision === undefined ? '—' : String(revision);
}

/* ============================================================
   Knitting fingerprints
   Compare content independently of Excel row/column order, including duplicate items.
   ============================================================ */
export function knittingSourceFingerprint(rows: Row[]): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      const record = value as Row;
      return Object.fromEntries(
        Object.keys(record)
          .sort()
          .filter((key) => record[key] !== null && record[key] !== undefined && String(record[key]).trim() !== '')
          .map((key) => [key, canonical(record[key])])
      );
    }
    return String(value ?? '').trim();
  };
  return JSON.stringify(rows.map((row) => JSON.stringify(canonical(row))).sort());
}
// Production is live progress, not a change to the approved planning content.
export function knittingProductionValue(row: Row): CellValue {
  const entry = Object.entries(row).find(([header]) => knittingInfoHeaderKey(header) === 'knitprod');
  return entry?.[1] ?? '';
}
export function knittingPlanFingerprint(rows: Row[]): string {
  return knittingSourceFingerprint(
    rows.map((row) => Object.fromEntries(Object.entries(row).filter(([header]) => knittingInfoHeaderKey(header) !== 'knitprod')))
  );
}
export function latestSourceFingerprint(number: string, floor: string | null): string {
  const dataset = getStoredDatasets().knitPlan;
  if (S.comparedKnittingDataset !== dataset) {
    S.comparedKnittingDataset = dataset;
    S.latestSourceFingerprints = new Map();
  }
  const key = JSON.stringify([normalizeBookingKey(number), floor]);
  if (!S.latestSourceFingerprints.has(key)) S.latestSourceFingerprints.set(key, knittingPlanFingerprint(getKnittingRows(number, floor)));
  return S.latestSourceFingerprints.get(key) as string;
}

/* ============================================================
   Confirmed snapshots
   Confirmed output is immutable until an explicit PMC save or Yes re-confirm. Source snapshots alone are
   insufficient: later rules or Setup edits must not recalculate previously approved quantities, component
   weights or machines.
   ============================================================ */
export function frozenConfirmedReport(booking: Row | null | undefined, floor: string | null): Row | null {
  if (!booking || S.rebuildingConfirmedReport || reviewingLatest(booking.number, floor) || reportBookingStatus(booking, floor) !== 'Confirm')
    return null;
  const draft = S.reportDraft;
  if (
    draft?.number === booking.number &&
    (draft as Row).floor === floor &&
    (draft as Row).dirty &&
    (draft as Row).previewReport &&
    !confirmedReportLocked(booking, floor)
  )
    return (draft as Row).previewReport;
  return savedReportPlan(booking, floor).confirmedSnapshot?.reportData || null;
}
export function captureConfirmedReport(booking: Row, floor: string | null, { useDraft = true }: { useDraft?: boolean } = {}): Row {
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
    capture: S.confirmedCaptureContext,
    rebuilding: S.rebuildingConfirmedReport,
  };
  try {
    const draft = S.reportDraft;
    const activeDraft = useDraft && draft?.number === booking.number && (draft as Row).floor === floor ? draft : null;
    S.currentViewingNumber = booking.number;
    S.currentViewingFloor = floor;
    S.currentReportReviewLatest = !!activeDraft?.reviewLatest;
    // Read saved manual data for migrations; active corrections keep their draft.
    if (!activeDraft) {
      S.reportDraft = null;
      S.reportDraft = { number: booking.number, floor, reviewLatest: false, manual: copyReportData(reportManualState(booking, floor)), dirty: false };
    }
    S.confirmedCaptureContext = { booking, floor, preserveSavedValues: !useDraft };
    S.rebuildingConfirmedReport = true;
    S.reportRowEditor = null;
    const view = getFloorBooking(booking, floor),
      tables = buildEditableReportTables(view, floor),
      components = buildComponentBatches(view, floor, tables.rows),
      instructions = instructionRows(view, floor);
    const savedRows = !useDraft && savedReportPlan(booking, floor).reportOverrides?.batchRows;
    if (Array.isArray(savedRows)) {
      const computed = new Map(tables.rows.map((row: Row) => [row.rowKey || row.id, row]));
      tables.rows = savedRows.map((row: Row) => ({ ...copyReportData(computed.get(row.rowKey || row.id) || {}), ...copyReportData(row) }));
    }
    return copyReportData({
      schemaVersion: 1,
      fabrics: tables.fabrics,
      rows: tables.rows,
      warnings: tables.warnings,
      evaluations: S.currentReportMachineEvaluations,
      components,
      instructions,
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
    S.confirmedCaptureContext = saved.capture;
    S.rebuildingConfirmedReport = saved.rebuilding;
  }
}
export function confirmedBpSnapshotRows(snapshot: Row): Row[] {
  const rows: Row[] = snapshot.bpSourceRows || [];
  if (snapshot.schemaVersion >= 2) return rows;
  // Older confirmations pre-date per-piece weights. Recover their weight only
  // from their own frozen RequiredQtyKgs/RequiredQtyPCs, never a revised upload.
  return rows.map((row) => {
    if (String(bpValue(row, 'weight')).trim() !== '') return row;
    const pcs = fabricQuantity(bpValue(row, 'quantity')),
      kg = fabricQuantity(bpValue(row, 'quantityKg'));
    // (pcs !== null) only satisfies TypeScript: null > 0 is false, as before.
    return pcs !== null && pcs > 0 && kg !== null && kg >= 0 ? { ...row, 'Weight /Pcs': kg / pcs } : row;
  });
}

export function makeConfirmedSnapshot(booking: Row, floor: string | null, rows: Row[] = getKnittingRows(booking.number, floor)): Row {
  const plan = savedReportPlan(booking, floor);
  const header: Row = {
    ...booking,
    ...(floor
      ? {
          batchDate: plan.batchDate || '',
          revisedBatch: plan.revisedBatch || '',
          batches: plan.batches || [],
          recipe: plan.recipe || [],
          ...treatmentInfo(rows),
        }
      : {}),
  };
  Object.assign(header, generalInfoOverrides(booking, floor));
  const draft = S.reportDraft;
  if (draft?.number === booking.number && (draft as Row).floor === floor) header.unit = unitForBuyer(header.buyer) || header.unit || '';
  const bpRows =
    draft?.number === booking.number && (draft as Row).floor === floor && (draft as Row).reviewLatest
      ? (draft as Row).reviewBpRows
      : getBpRows(
          booking.number,
          floor,
          rows,
          (plan.reportOverrides?.batchRows || []).map((row: Row) => row.shade)
        );
  return {
    schemaVersion: 2,
    sourceRows: copyReportData(rows),
    sourceFingerprint: knittingPlanFingerprint(rows),
    revisionNo: revisionNumberFromRows(rows),
    bpSourceRows: copyReportData(bpRows),
    bpSourceFingerprint: knittingSourceFingerprint(bpRows),
    headerData: copyReportData(Object.fromEntries(CONFIRMED_HEADER_FIELDS.filter((key) => header[key] !== undefined).map((key) => [key, header[key]]))),
  };
}
// Protect older saved confirmations before the next import replaces live source data.
/* Unit records that captureMissingConfirmedSnapshots makes from a whole-order confirmation, mapped to the
   record the server had for that unit (undefined when none). Such a record is saved with the order's next
   change only when this user may change that unit's confirmed plan (the server's rule: that unit's
   permission and Internal change); otherwise the server keeps its own record and this page keeps the made
   one in memory, so a user without that unit can still save the order. */
const inheritedFloorPlans = new WeakMap<object, Row | undefined>();
export function unsavedInheritedRemoved(booking: Booking): Booking {
  const plans = booking.floorPlans;
  if (!plans) return booking;
  let kept: Record<string, Row> | null = null;
  for (const [floor, plan] of Object.entries(plans)) {
    if (!inheritedFloorPlans.has(plan)) continue;
    if (
      (BatchApi.has('menus.batchPlan.all') || BatchApi.has('menus.batchPlan.' + floor.toLowerCase())) &&
      BatchApi.has('actions.batchInternalChange')
    )
      continue;
    kept = kept || { ...plans };
    const original = inheritedFloorPlans.get(plan);
    if (original === undefined) delete kept[floor];
    else kept[floor] = original;
  }
  return kept ? { ...booking, floorPlans: kept } : booking;
}
export function captureMissingConfirmedSnapshots(master: Booking[]): boolean {
  let changed = false;
  for (let index = 0; index < master.length; index++) {
    let booking: Booking = master[index];
    for (const floor of [null, ...BATCH_FLOORS.map((value) => value.key)]) {
      const old = savedReportPlan(booking, floor);
      if (reportBookingStatus(booking, floor) !== 'Confirm' || (floor && !old.status && !getKnittingRows(booking.number, floor).length)) continue;
      const needsBp = old.confirmedSnapshot && old.confirmedSnapshot.bpSourceRows === undefined;
      if (old.confirmedSnapshot?.reportData && old.confirmedBy !== undefined && !needsBp && old.flatAllowanceSnapshot !== undefined) continue;
      const plan: Row = {
        ...old,
        status: 'Confirm',
        flatAllowanceSnapshot: old.flatAllowanceSnapshot || copyReportData(getFlatAllowance()),
        confirmedBy: old.confirmedBy || old.tentativeBy || (!old.status ? booking.confirmedBy || booking.tentativeBy : '') || '',
        confirmedSnapshot: old.confirmedSnapshot
          ? { ...old.confirmedSnapshot, ...(needsBp ? { bpSourceRows: [], bpSourceFingerprint: knittingSourceFingerprint([]) } : {}) }
          : makeConfirmedSnapshot(booking, floor),
      };
      if (floor && !old.status) inheritedFloorPlans.set(plan, booking.floorPlans?.[floor]);
      booking = (floor ? { ...booking, floorPlans: { ...(booking.floorPlans || {}), [floor]: plan } } : { ...booking, ...plan }) as Booking;
      if (!plan.confirmedSnapshot.reportData)
        plan.confirmedSnapshot = { ...plan.confirmedSnapshot, reportData: captureConfirmedReport(booking, floor, { useDraft: false }) };
      // The root spread above holds the earlier snapshot reference; publish the
      // finished snapshot after capture for both root and floor confirmations.
      booking = (floor ? { ...booking, floorPlans: { ...(booking.floorPlans || {}), [floor]: plan } } : { ...booking, ...plan }) as Booking;
      changed = true;
    }
    master[index] = booking;
  }
  return changed;
}

/* ============================================================
   Need Re-Confirm
   ============================================================ */
export function needsReconfirmation(booking: Row, floor: string | null): boolean {
  const plan = savedReportPlan(booking, floor),
    snapshot = plan.confirmedSnapshot;
  return (
    reportBookingStatus(booking, floor) === 'Confirm' &&
    !!snapshot &&
    (knittingPlanFingerprint(snapshot.sourceRows) !== latestSourceFingerprint(booking.number, floor) ||
      (snapshot.bpSourceRows !== undefined && snapshot.bpSourceFingerprint !== knittingSourceFingerprint(getBpRows(booking.number, floor))))
  );
}
export function getReconfirmBookings(): Booking[] {
  if (S.activeFloor) {
    const activeFloor = S.activeFloor;
    return getFloorBookings()
      .filter((booking) => needsReconfirmation(booking, activeFloor))
      .map((booking) => ({ ...booking, _registerFloor: activeFloor }));
  }
  if (!BatchApi.has('menus.batchPlan.all')) return [];
  const rows: Booking[] = [];
  for (const booking of getStoredMasterList()) {
    if (needsReconfirmation(booking, null)) rows.push({ ...getFloorBooking(booking, null), _registerFloor: null });
    // A whole-order confirmation already represents all its floors in this list.
    else
      for (const floor of BATCH_FLOORS.map((value) => value.key))
        if (needsReconfirmation(booking, floor)) rows.push({ ...getFloorBooking(booking, floor), _registerFloor: floor });
  }
  return rows;
}

/* ============================================================
   General Info values (GENERAL_INFO_ROWS in constants.ts)
   ============================================================ */
export function generalInfoOverrides(booking: Row, floor: string | null): Row {
  return reportManualState(booking, floor).generalInfo || {};
}
export function generalInfoValues(booking: Row, floor: string | null): Row {
  const overrides = generalInfoOverrides(booking, floor);
  // The old object literal named displayConfirmedBy, batchDate and revisedBatch twice (TypeScript does not
  // allow that). The later values win and the keys keep the place of the first ones, as before.
  const values: Row = {
    ...booking,
    displayNumber: booking.displayNumber || booking.number,
    displayConfirmedBy: booking.displayConfirmedBy ?? savedReportPlan(currentReportBooking() || booking, floor).confirmedBy ?? '',
    batchDate: generalPlanTimestamp(booking, floor),
    revisedBatch: generalPlanTimestamp(booking, floor, true),
    ...overrides,
  };
  values.displayConfirmedBy = overrides.displayConfirmedBy || savedReportPlan(currentReportBooking() || booking, floor).confirmedBy || booking.confirmedBy || '';
  values.batchDate = overrides.batchDate || generalPlanTimestamp(booking, floor);
  values.revisedBatch = overrides.revisedBatch || generalPlanTimestamp(booking, floor, true);
  return values;
}
export function generalDateDay(value: unknown): string {
  const text = String(value || '').trim();
  if (!text || text === '—') return '';
  let year: string | number, month: string | number, day: string | number, match: RegExpMatchArray | null;
  if ((match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:\b|T)/))) {
    [, year, month, day] = match;
  } else if ((match = text.match(/^(\d{1,2})[\s/-]([A-Za-z]{3,9}|\d{1,2})[\s,/-]+(\d{2}|\d{4})(?:\b|\s)/))) {
    day = match[1];
    month = /^\d+$/.test(match[2])
      ? match[2]
      : ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(match[2].slice(0, 3).toLowerCase()) + 1;
    year = Number(match[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
  } else return '';
  year = Number(year);
  month = Number(month);
  day = Number(day);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}
export function confirmGeneralInfoError(booking: Row, floor: string | null): string {
  const values = generalInfoValues(getFloorBooking(booking, floor), floor);
  if (String(values.dyeingPlan || '').trim().toLowerCase() !== 'confirm') return 'Dyeing Plan must be “Confirm” before confirming the batch plan.';
  const start = generalDateDay(values.dyeStart);
  if (!start) return 'Enter a valid Dyeing Start date in General Info before confirming.';
  const batch = values.batchDate && values.batchDate !== '—' ? values.batchDate : dyeablePrintedAt(new Date().toISOString()),
    revised =
      values.revisedBatch && values.revisedBatch !== '—'
        ? values.revisedBatch
        : S.reportDraft?.reviewLatest
          ? dyeablePrintedAt(new Date().toISOString())
          : '';
  for (const [label, value] of [
    ['Batch Plan Date', batch],
    ['Revised Batch Plan Date', revised],
  ])
    if (value) {
      const day = generalDateDay(value);
      if (!day) return 'Enter a valid ' + label + ' in General Info.';
      if (day >= start) return label + ' must be earlier than Dyeing Start date. The same date is not allowed.';
    }
  return '';
}

/* ============================================================
   Unit Setup values
   Unit Setup lists one row per buyer: every buyer in the uploaded orders plus every buyer that already has
   a Unit Setup row. The default unit is chosen from the ACTIVE units of Dropdown Master Setup; a saved unit
   that is no longer active stays selectable. Rows keep the demo shape {id,buyer,unit,hidden}.
   ============================================================ */
export function getUnitSetup(): Row[] {
  return S.appState.unitSetup || INITIAL_UNIT_SETUP;
}
export function unitBuyerKey(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}
export function unitForBuyer(buyer: unknown): string {
  return getUnitSetup().find((row) => !row.hidden && unitBuyerKey(row.buyer) === unitBuyerKey(buyer))?.unit || '';
}
/* The Unit Setup rows: the buyers of the latest uploaded files (GET /api/batch/state `buyers`). Saved defaults of
   buyers that are not in those files stay saved (Save Changes keeps them), so such a buyer gets its unit back
   when a later upload has it again; they are not listed. */
export function unitSetupBuyerList(): { key: string; buyer: string }[] {
  const rows = new Map<string, { key: string; buyer: string }>();
  for (const name of S.unitSetupBuyerNames) {
    const key = unitBuyerKey(name);
    if (key && !rows.has(key)) rows.set(key, { key, buyer: String(name).trim() });
  }
  return [...rows.values()].sort((a, b) => a.buyer.localeCompare(b.buyer));
}
export function unitSetupValue(key: string): string {
  return S.unitSetupDraft && S.unitSetupDraft.has(key) ? (S.unitSetupDraft.get(key) as string) : unitForBuyer(key);
}
/** One `<option>` of a Unit Setup unit select. */
export interface UnitSetupOption {
  value: string;
  label: string;
  /** The old `selected` attribute (case-insensitive match with the current unit). */
  selected: boolean;
}
/** The options of a Unit Setup unit select (the old function returned them as `<option>` HTML). The select
    shows the option with `selected`, or the first one ('— No default —') when none has it. */
export function unitSetupOptions(current: string): UnitSetupOption[] {
  const active = S.unitSetupUnitOptions.filter((unit) => unit.status === 'ACTIVE').map((unit) => unit.name);
  const names = current && !active.some((name) => name.toLowerCase() === current.toLowerCase()) ? [current, ...active] : active;
  return [
    { value: '', label: '— No default —', selected: false },
    ...names.map((name) => ({
      value: name,
      label: name + (active.includes(name) ? '' : ' (inactive)'),
      selected: !!current && name.toLowerCase() === current.toLowerCase(),
    })),
  ];
}
