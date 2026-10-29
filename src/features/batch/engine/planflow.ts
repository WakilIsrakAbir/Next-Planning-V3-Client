/* Batch engine slice "planflow" (port of the old js/batch/batch-app.js, see ../README.md).
   The Batch Plan page: register (status tabs, buyer pills, search, column filters, pagination), unit tabs,
   same-order floor jumps, booking status changes (Pending / Tentative / Confirm), the tentative
   questionnaire, the confirm checks, Internal change, the re-confirm revision choice, the full view and
   printing, and the moves between the Batch pages (switchMainView / selectFloor).
   The rules are unchanged. Where the old code wrote HTML, these functions change `S` and call `notify()`;
   the components in components/plan/ render from `S`:
     S.ui.planflowRegister    the register as built by the last renderBatchRegister() (BatchRegisterView)
     S.ui.planflowPagination  the pagination texts written by paginateRegister()
     S.ui.planflowFocus       an element to focus after a dialog closed (an element id, or the element a
                              dialog saved as its returnFocus); BatchPlanPage focuses it and clears it
     S.ui.planflowScrollReset counter: the register's scroll pane goes back to the top (old scrollTop = 0)
     S.ui.planflowLoadedState the S.appState the Batch Plan page last routed for (a reload resets the buyer
                              filter, like the old buildBuyerPills() in BatchApi.ready())
   Dialog contexts keep their old fields; the dialogs show `context.error` (old #...Error texts), and the
   tentative questionnaire keeps its inputs in `context.answers`. */
import { BatchApi } from './api';
import { BATCH_FLOORS, S, navigateTo, notify } from './state';
import {
  canChangeData,
  currentUsername,
  getStoredMasterList,
  printWithBodyClass,
  saveMasterList,
  setMutationBusy,
  showSaveError,
  toast,
} from './storage';
import {
  canEditReport,
  captureConfirmedReport,
  confirmGeneralInfoError,
  confirmedBatchRevision,
  ensureKnittingIndex,
  floorLabel,
  getFloorBookings,
  getOrderFloors,
  getReconfirmBookings,
  getReportKnittingRows,
  globalReconfirmBookings,
  globalSearchBookings,
  globalSearchTerm,
  hasOrderOnFloor,
  isConfirmedInternalDraft,
  isGlobalCardSearch,
  isGlobalSearch,
  knittingRowFloor,
  lastSaveDisplay,
  latestRevisionNo,
  makeConfirmedSnapshot,
  matchesGlobalSearch,
  normalizeBookingKey,
  revisionDisplay,
  revisionNumberFromRows,
} from './core';
import { getFlatAllowance } from './calc';
import {
  copyReportData,
  currentReportBooking,
  discardReportDraft,
  reportBookingStatus,
  sanitizeReportAssignments,
  savedReportPlan,
  tallBigSaveError,
  writeDraftToBooking,
} from './model';
import { closeMachineEvaluation, openBatchPlanReport, refreshEditableReport } from './reportui';
import { closeDailyConfirmFilters, closeDyeableFilters, dyeablePrintedAt, renderDyeableReport } from './reports';
import { confirmedCardScopes, renderCardRegister, selectCardFloor } from './cards';
import { renderSetupPanels } from './setup';
import type { Booking, Row } from './types';

/* ============================================================
   Small helpers
   ============================================================ */
const text = (value: unknown): string => String(value ?? '');

/** Results computed from the data, kept until one of their inputs changes (same object identities). */
function cachedBy<T>(slot: { key: unknown[]; value: T } | null, key: unknown[], compute: () => T): { key: unknown[]; value: T } {
  if (slot && slot.key.length === key.length && slot.key.every((value, index) => value === key[index])) return slot;
  return { key, value: compute() };
}

/** Asks the page to focus an element after a dialog closed (the old `.focus()` calls). */
function requestFocus(target: unknown): void {
  if (target) S.ui.planflowFocus = target;
}

/* ============================================================
   Batch Plan route (old BatchApi.route() for "plan", js/batch/batch-api.js)
   The open unit is the route (/batch/plan/<UNIT>); an open report adds ?order=<number>, so a reload opens it
   again. Moves made by the page itself (unit tab, floor jump, search result, Back to List) replace the URL;
   those URLs are remembered here so the page does not route them a second time when they arrive.
   ============================================================ */
// The page's own moves that have not arrived yet (a newer navigation discards an older one on its way),
// and the URL the Batch Plan page shows (null while another page is open).
const pendingPlanUrls: string[] = [];
let shownPlanUrl: string | null = null;

/** The Batch Plan URL of a unit and an open order (default: the current state). */
export function batchPlanUrl(unit: string | null = S.activeFloor, order: string | null = S.currentViewingNumber): string {
  return '/batch/plan' + (unit ? '/' + unit : '') + (order ? '?order=' + encodeURIComponent(order) : '');
}

/** The URL follows the page (old BatchApi.syncRoute('plan/' + floor)); replace navigation. */
export function syncBatchPlanRoute(): void {
  const url = batchPlanUrl();
  if (url === shownPlanUrl) {
    // Back to the URL on the screen before the page's last move arrived: that move is cancelled.
    if (pendingPlanUrls.length) {
      pendingPlanUrls.length = 0;
      BatchApi.syncRoute(url.slice('/batch/'.length));
    }
    return;
  }
  if (pendingPlanUrls[pendingPlanUrls.length - 1] === url) return;
  pendingPlanUrls.push(url);
  BatchApi.syncRoute(url.slice('/batch/'.length));
}

/** The Batch Plan page shows a new URL: true when the page itself moved there (it is then not routed
    again), false for a move from outside (sidebar, browser history, typed URL). */
export function takePendingBatchPlanUrl(url: string): boolean {
  shownPlanUrl = url;
  const index = pendingPlanUrls.lastIndexOf(url);
  if (index < 0) {
    pendingPlanUrls.length = 0;
    return false;
  }
  pendingPlanUrls.splice(0, index + 1);
  return true;
}

/* Old BatchApi.route() for the Batch Plan page. A unit that is no longer in the list (e.g. a saved page)
   opens the all-orders page for a user who may see all orders, else the first unit the user may open.
   The plain "plan" route opens the first unit the user may open when the all-orders permission is missing,
   and the URL follows. A user with neither gets the all-orders page empty (getFloorBookings).
   `order` (new) is the ?order= of the URL: that report is opened again. */
export function routeBatchPlan(sub: string | null, order: string | null = null): void {
  const floorKeys = BATCH_FLOORS.map((floor) => floor.key);
  let floor = floorKeys.includes(String(sub || '').toUpperCase()) ? String(sub).toUpperCase() : null;
  let sync = false;
  if (S.storageReady && !floor) {
    const all = BatchApi.has('menus.batchPlan.all');
    if (!all) floor = floorKeys.find((key) => BatchApi.has('menus.batchPlan.' + key.toLowerCase())) || null;
    if ((all || floor) && (sub || floor)) sync = true;
  }
  selectFloor(floor);
  if (order) openBatchPlanReport(order);
  if (sync) syncBatchPlanRoute();
}

/* ============================================================
   Unit tabs in the page heading (plan section 18)
   ============================================================ */
let floorCountCache: { key: unknown[]; value: Record<string, number> } | null = null;
let cardCountCache: { key: unknown[]; value: Record<string, number> } | null = null;

/** Order counts of the Batch Plan unit tabs (old [data-floor-count]); key '' is the All Orders tab. */
export function updateFloorMenuCounts(): Record<string, number> {
  const master = getStoredMasterList();
  floorCountCache = cachedBy(floorCountCache, [master, S.appState.datasets, BATCH_FLOORS.map((floor) => floor.key).join('|')], () => {
    const counts: Record<string, number> = Object.fromEntries(BATCH_FLOORS.map((floor) => [floor.key, 0]));
    for (const booking of master) for (const floor of getOrderFloors(booking.number)) counts[floor]++;
    // The All Orders tab (empty key) counts every order.
    counts[''] = master.length;
    return counts;
  });
  return floorCountCache.value;
}

/** Confirmed scopes per unit for the Batch Card unit tabs (old renderCardRegister filled [data-card-floor-count]). */
export function updateCardFloorCounts(): Record<string, number> {
  const master = getStoredMasterList();
  cardCountCache = cachedBy(
    cardCountCache,
    [master, S.appState.cards, S.appState.datasets, BATCH_FLOORS.map((floor) => floor.key).join('|')],
    () => {
      const allScopes = confirmedCardScopes(null) as Row[],
        counts: Record<string, number> = {};
      for (const scope of allScopes) counts[scope.floor || ''] = (counts[scope.floor || ''] || 0) + 1;
      counts[''] = allScopes.length;
      return counts;
    }
  );
  return cardCountCache.value;
}

/** Counts of the unit tabs of one page. */
export function unitTabCounts(view: string): Record<string, number> {
  return view === 'cards' || view === 'card' ? updateCardFloorCounts() : updateFloorMenuCounts();
}

/** The unit tabs (UnitTabs.tsx) are rendered from S; this only tells the screen to update them. */
export function renderUnitTabs(view: string): void {
  void view;
  notify();
}

/* The open unit is highlighted; while the all-units search is on, it is only marked lightly, because the
   list then shows every unit. The tabs compute this from S (unitTabHighlight); this tells the screen. */
export function highlightUnitTabs(view: string): void {
  void view;
  notify();
}

/** Highlight of one unit tab (old highlightUnitTabs): 'active', 'searching' or ''. */
export function unitTabHighlight(view: string, key: string | null): 'active' | 'searching' | '' {
  const card = view === 'cards' || view === 'card';
  const active = card ? S.activeCardFloor : S.activeFloor;
  if (key !== active) return '';
  // With a plan open the list is not shown, so its unit is simply the active tab.
  const register = S.ui.planflowRegister as BatchRegisterView | undefined;
  const searching = card ? isGlobalCardSearch() : !!register?.searching && !S.currentViewingNumber;
  return searching ? 'searching' : 'active';
}

/** Old unitTabs click: a unit tab opens that unit's list (Batch Plan or Batch Card) and the URL follows. */
export function selectUnitTab(view: string, floor: string | null): void {
  if (view === 'cards' || view === 'card') {
    selectCardFloor(floor);
    BatchApi.syncRoute(floor ? 'card/' + floor : 'card');
    return;
  }
  selectFloor(floor);
  syncBatchPlanRoute();
}

/* ============================================================
   Register scope note and same-order floor links
   ============================================================ */
/** Old updateFloorScopeNote: returns the note text (the old code wrote it to #floorScopeNote). */
export function updateFloorScopeNote(search: { term: string; list: Row[] } | null): string {
  if (search) {
    const orders = new Set(search.list.map((b) => normalizeBookingKey(b.number)));
    const units = new Set(search.list.map((b) => b._registerFloor || 'ALL'));
    return `Search results in all units for "${search.term}" · ${orders.size} order(s) in ${units.size} unit(s) · The eye button opens the plan of the unit named under the order. Clear the search to return to ${S.activeFloor ? floorLabel(S.activeFloor) : 'All orders'}.`;
  }
  if (S.activeFloor) {
    return (
      floorLabel(S.activeFloor) +
      ' · Items follow the Dyeing Plan unit of each colour. Confirmed plans retain their saved floor items until explicitly re-confirmed.'
    );
  }
  ensureKnittingIndex();
  let unassigned = 0;
  for (const entry of S.knittingBookingIndex.values()) for (const row of (entry as Row).rows as Row[]) if (!knittingRowFloor(row)) unassigned++;
  return (
    'All orders · Choose a unit tab above for its assigned items.' +
    (unassigned ? ` ${unassigned} item(s) have no unit or a combined unit such as EKL+DTL; set one Unit in Dyeing Plan to assign them.` : '')
  );
}

export interface FloorOrderLinksData {
  /** 'report-floor-links' in the report heading, 'order-floor-links' in the register. */
  className: string;
  /** The report heading shows "Same order on:" before the buttons. */
  showLabel: boolean;
  /** Units to jump to (keys). */
  floors: string[];
}

/** Old floorOrderLinks: the other units of the same order the user may open (null when none); the
    FloorOrderLinks component renders the buttons. */
export function floorOrderLinks(number: string, floor: string | null = S.activeFloor, report = false): FloorOrderLinksData | null {
  const floors = getOrderFloors(number);
  if (floors.length < 2) return null;
  // Only floors the user may open (Batch Plan menu permission for that floor or all orders).
  const targets = floors.filter(
    (key) => key !== floor && (BatchApi.has('menus.batchPlan.all') || BatchApi.has('menus.batchPlan.' + key.toLowerCase()))
  );
  if (!targets.length) return null;
  return { className: report ? 'report-floor-links' : 'order-floor-links', showLabel: report, floors: targets };
}

/** Old selectFloor (state only): the unit's list, page 1, an open report is closed (old switchMainView('batch')). */
export function selectFloor(floor: string | null): void {
  if (floor && !BATCH_FLOORS.some((item) => item.key === floor)) return;
  S.activeFloor = floor;
  S.registerPage = 1;
  resetMainView('batch');
  S.ui.planflowScrollReset = (Number(S.ui.planflowScrollReset) || 0) + 1;
  notify();
}

/** Old handleFloorOrderJump(event): a same-order floor button opens that order on that unit; the URL follows.
    New parameters: the button's unit and order (old data-jump-floor / data-jump-order). */
export function handleFloorOrderJump(floor: string, number: string): boolean {
  if (!BATCH_FLOORS.some((item) => item.key === floor) || !hasOrderOnFloor(number, floor)) return true;
  selectFloor(floor);
  openBatchPlanReport(number);
  syncBatchPlanRoute(); // highlight the same floor in the project sidebar (old BatchApi.syncRoute('plan/' + floor))
  return true;
}

/* ============================================================
   Register (old section 7)
   ============================================================ */
export interface BatchRegisterRow {
  number: string;
  /** Old data-booking-floor of the eye button ('ALL' = whole-order scope); undefined on the unit's own list. */
  bookingFloor?: string;
  /** Eye button title. */
  title: string;
  /** Unit name under the order number ('' = none). */
  unitName: string;
  /** Same-order floor links under the order number (not in search results). */
  floorLinks: boolean;
  date: string;
  buyer: string;
  savedBy: string;
  lastSave: string;
  lastSaveTitle: string;
  latestRevision: string;
  confirmedRevision: string;
}

export interface BatchRegisterView {
  counts: { Pending: number; Confirm: number; Tentative: number; NeedReconfirm: number };
  showReconfirm: boolean;
  showSaveAudit: boolean;
  savedByHeading: string;
  /** The all-units search was on when the register was built. */
  searching: boolean;
  scopeNote: string;
  resultCount: string;
  pageInfo: string;
  previousDisabled: boolean;
  nextDisabled: boolean;
  empty: boolean;
  rows: BatchRegisterRow[];
}

export interface BatchRegisterPagination {
  resultCount: string;
  pageInfo: string;
  previousDisabled: boolean;
  nextDisabled: boolean;
}

// Pagination operates on the filtered register, before rendering table rows.
export function paginateRegister<T>(list: T[], filters: unknown[]): T[] {
  const signature = JSON.stringify(filters);
  if (signature !== S.registerFilterSignature) {
    S.registerPage = 1;
    S.registerFilterSignature = signature;
  }
  const size = S.registerPageSize === 'All' ? Math.max(1, list.length) : Number(S.registerPageSize);
  S.registerTotalPages = Math.max(1, Math.ceil(list.length / size));
  S.registerPage = Math.max(1, Math.min(S.registerPage, S.registerTotalPages));
  const start = (S.registerPage - 1) * size;
  const end = Math.min(start + size, list.length);
  const pagination: BatchRegisterPagination = {
    resultCount: list.length ? `Showing ${start + 1}–${end} of ${list.length} orders` : 'Showing 0 orders',
    pageInfo: `Page ${S.registerPage} of ${S.registerTotalPages}`,
    previousDisabled: S.registerPage === 1,
    nextDisabled: S.registerPage === S.registerTotalPages,
  };
  S.ui.planflowPagination = pagination;
  return S.registerPageSize === 'All' ? list : list.slice(start, end);
}

/** Old #registerPageSize change listener. */
export function setRegisterPageSize(value: string): void {
  if (!['10', '20', '50', '100', 'All'].includes(value)) return;
  S.registerPageSize = value;
  S.registerPage = 1;
  renderBatchRegister();
}
/** Old #btnPreviousPage listener. */
export function previousRegisterPage(): void {
  if (S.registerPage > 1) {
    S.registerPage--;
    renderBatchRegister();
  }
}
/** Old #btnNextPage listener. */
export function nextRegisterPage(): void {
  if (S.registerPage < S.registerTotalPages) {
    S.registerPage++;
    renderBatchRegister();
  }
}

/** Old updateStatusCounts: returns the status tab counts (the old code wrote them to #count...). */
export function updateStatusCounts(): BatchRegisterView['counts'] {
  updateFloorMenuCounts();
  // While the all-units search is on, the counts are the matches in every unit.
  const term = globalSearchTerm();
  const master = term ? globalSearchBookings().filter((b) => matchesGlobalSearch(b, term)) : getFloorBookings();
  const pendingCount = master.filter((b) => (b.status || 'Pending') === 'Pending').length;
  const confirmCount = master.filter((b) => b.status === 'Confirm').length;
  const tentativeCount = master.filter((b) => b.status === 'Tentative').length;
  return {
    Pending: pendingCount,
    Confirm: confirmCount,
    Tentative: tentativeCount,
    NeedReconfirm: (term ? globalReconfirmBookings().filter((b) => matchesGlobalSearch(b, term)) : getReconfirmBookings()).length,
  };
}

/** Old renderBatchRegister: builds the register (S.ui.planflowRegister) from the current filters and
    calls notify(). The top search looks in every unit the user may open (globalSearchBookings); without
    a search text the list is the open unit's (or all orders). */
export function renderBatchRegister(): void {
  const counts = updateStatusCounts();
  const searching = isGlobalSearch();
  const showReconfirm = S.activeStatusTab === 'NeedReconfirm';
  const showSaveAudit = showReconfirm || ['Tentative', 'Confirm'].includes(S.activeStatusTab);
  const savedByHeading = S.activeStatusTab === 'Tentative' ? 'Tentative By' : 'Confirmed By';

  // Filter by Active Tab (Pending, Confirm, Tentative)
  let list: Booking[] = showReconfirm
    ? searching
      ? globalReconfirmBookings()
      : getReconfirmBookings()
    : (searching ? globalSearchBookings() : getFloorBookings()).filter((b) => (b.status || 'Pending') === S.activeStatusTab);

  // Filter by Buyer Carousel
  if (S.activeBuyerFilter !== 'ALL') list = list.filter((b) => (b.buyer || '').trim().toUpperCase() === S.activeBuyerFilter);

  // Top search (all units)
  const globalQ = globalSearchTerm();
  if (globalQ) list = list.filter((b) => matchesGlobalSearch(b, globalQ));

  // Column specific filters
  const fOrder = S.columnSearch.order.trim().toLowerCase();
  const fDate = S.columnSearch.date.trim().toLowerCase();
  const fBuyer = S.columnSearch.buyer.trim().toLowerCase();
  if (fOrder) list = list.filter((b) => (b.number || '').toLowerCase().includes(fOrder));
  if (fDate) list = list.filter((b) => (b.date || '').toLowerCase().includes(fDate));
  if (fBuyer) list = list.filter((b) => (b.buyer || '').toLowerCase().includes(fBuyer));

  const scopeNote = updateFloorScopeNote(searching ? { term: S.globalSearch.trim(), list } : null);

  const pageRows = paginateRegister(list, [searching ? 'ALL-UNITS' : S.activeFloor, S.activeStatusTab, S.activeBuyerFilter, globalQ, fOrder, fDate, fBuyer]);
  const pagination = S.ui.planflowPagination as BatchRegisterPagination;
  // The unit under the order number: every search result names its unit (All Orders for the whole-order
  // scope); the Need Re-Confirm list of all orders names the unit as before.
  const unitName = (b: Row): string =>
    searching
      ? b._registerFloor
        ? floorLabel(b._registerFloor)
        : 'All Orders'
      : showReconfirm && !S.activeFloor && b._registerFloor
        ? floorLabel(b._registerFloor)
        : '';
  const rows: BatchRegisterRow[] = list.length
    ? pageRows.map((b) => ({
        number: b.number,
        bookingFloor: showReconfirm || searching ? text(b._registerFloor || 'ALL') : undefined,
        title: 'View Batch Plan for Order ' + text(b.number) + (searching ? ' · ' + unitName(b) : ''),
        unitName: unitName(b),
        floorLinks: !searching,
        date: text(b.date || '—'),
        buyer: text(b.buyer || '—'),
        savedBy: showSaveAudit ? text((S.activeStatusTab === 'Tentative' ? b.tentativeBy : b.confirmedBy) || '—') : '',
        lastSave: showSaveAudit ? lastSaveDisplay(b.lastSaveAt) : '',
        lastSaveTitle: text(b.lastSaveAt || ''),
        latestRevision: showReconfirm ? revisionDisplay(latestRevisionNo(b.number, b._registerFloor ?? null)) : '',
        confirmedRevision: showReconfirm ? revisionDisplay(savedReportPlan(b, b._registerFloor ?? null).confirmedSnapshot?.revisionNo) : '',
      }))
    : [];

  const view: BatchRegisterView = {
    counts,
    showReconfirm,
    showSaveAudit,
    savedByHeading,
    searching,
    scopeNote,
    ...pagination,
    empty: list.length === 0,
    rows,
  };
  S.ui.planflowRegister = view;
  notify();
}

/** Old .status-btn listener. */
export function selectStatusTab(status: string): void {
  S.activeStatusTab = status;
  renderBatchRegister();
}

/** Old .buyer-btn listener. */
export function selectBuyerFilter(buyer: string): void {
  S.activeBuyerFilter = buyer;
  renderBatchRegister();
}

/** The search box text (old #globalSearchInput value; read by globalSearchTerm()). The register is built
    again only when the search runs (Enter, Search) or the list changes, as before. */
export function changeGlobalSearch(value: string): void {
  S.globalSearch = value;
}

/** Old #btnClearSearch listener. */
export function clearGlobalSearch(): void {
  S.globalSearch = '';
  renderBatchRegister();
}

/** Old #colSearchOrder / #colSearchDate / #colSearchBuyer input listeners. */
export function setColumnSearch(field: 'order' | 'date' | 'buyer', value: string): void {
  S.columnSearch = { ...S.columnSearch, [field]: value };
  renderBatchRegister();
}

/** Buyer pills built from the data (old batch-api.js buildBuyerPills; the demo had a fixed list): the
    buyers after ALL BUYERS. A data load makes ALL BUYERS active again (noteBatchPlanDataLoaded). */
let buyerPillCache: { key: unknown[]; value: string[] } | null = null;
export function buyerPillNames(): string[] {
  const master = getStoredMasterList();
  buyerPillCache = cachedBy(buyerPillCache, [master], () =>
    Array.from(new Set(master.map((b) => String(b.buyer || '').trim().toUpperCase()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  );
  return buyerPillCache.value;
}

/** The data was (re)loaded since the Batch Plan page last routed (old BatchApi.ready() rebuilt the buyer
    pills with ALL BUYERS active, then routed). Returns true when it was. */
export function noteBatchPlanDataLoaded(): boolean {
  if (S.ui.planflowLoadedState === S.appState) return false;
  S.ui.planflowLoadedState = S.appState;
  S.activeBuyerFilter = 'ALL';
  return true;
}

/** Old #batchRegisterRows eye button listener. A row of another unit (search result or the all-orders
    Need Re-Confirm list) opens that unit's plan; the unit tab and the URL follow. */
export function openRegisterBooking(bookingNo: string, bookingFloor?: string): void {
  const reviewLatest = S.activeStatusTab === 'NeedReconfirm';
  let moved = false;
  if (bookingFloor) {
    const floor = bookingFloor === 'ALL' ? null : bookingFloor;
    if (floor !== S.activeFloor) {
      selectFloor(floor);
      moved = true;
    }
  }
  openBatchPlanReport(bookingNo, { reviewLatest });
  if (moved) syncBatchPlanRoute();
}

/* ============================================================
   Internal change (confirmed edits are local drafts until the user approves them)
   ============================================================ */
export function openInternalChangeDialog(): boolean {
  if (!isConfirmedInternalDraft() || !canEditReport()) return false;
  if (S.reportRowEditor) {
    toast('Save Row or Cancel the row being edited first.');
    return false;
  }
  if (!(S.reportDraft as Row).dirty) {
    toast('No internal changes are pending.');
    return false;
  }
  closeMachineEvaluation();
  closeTentativeQuestionnaire(false);
  closeReconfirmRevisionDialog(false);
  S.ui.planflowFocus = null; // the dialog takes the focus (a later .focus() won in the old code)
  S.internalChangeContext = {
    number: S.currentViewingNumber,
    floor: S.currentViewingFloor,
    draft: S.reportDraft,
    plan: savedReportPlan(currentReportBooking() as Row, S.currentViewingFloor),
    error: '',
  };
  notify();
  return true;
}
export function closeInternalChangeDialog(restoreFocus = true): void {
  const context = S.internalChangeContext;
  S.internalChangeContext = null;
  if (restoreFocus && context) requestFocus('btnInternalChange');
  notify();
}
export function internalChangeContextMatches(context: Row | null | undefined): boolean {
  return (
    !!context &&
    context.number === S.currentViewingNumber &&
    context.floor === S.currentViewingFloor &&
    context.floor === S.activeFloor &&
    context.draft === S.reportDraft &&
    isConfirmedInternalDraft() &&
    savedReportPlan(currentReportBooking() as Row, context.floor) === context.plan
  );
}
function setContextError(context: Row, message: string): void {
  context.error = message;
  notify();
}
export async function submitInternalChange(approve: boolean): Promise<boolean> {
  const context = S.internalChangeContext;
  if (typeof approve !== 'boolean' || !canChangeData()) return false;
  if (!context || !internalChangeContextMatches(context)) {
    closeInternalChangeDialog(false);
    toast('The booking changed. Reopen it to review internal changes.');
    return false;
  }
  if (!approve) {
    S.activeStatusTab = 'Confirm';
    backToList();
    toast('Internal changes discarded. The confirmed plan is unchanged.');
    return true;
  }
  if (!canEditReport()) {
    closeInternalChangeDialog(false);
    refreshEditableReport();
    return false;
  }
  if (S.reportRowEditor) {
    setContextError(context, 'Save Row or Cancel the edited row first.');
    return false;
  }
  const generalError = confirmGeneralInfoError(currentReportBooking() as Row, context.floor);
  if (generalError) {
    setContextError(context, generalError);
    return false;
  }
  const tallBigError = tallBigSaveError(currentReportBooking() as Row, context.floor);
  if (tallBigError) {
    setContextError(context, tallBigError);
    return false;
  }
  const master = getStoredMasterList().slice(),
    index = master.findIndex((booking) => booking.number === context.number);
  if (index < 0) return false;
  setMutationBusy(true);
  try {
    const draft = S.reportDraft as Row;
    if (!draft.previewReport) draft.previewReport = captureConfirmedReport(master[index], context.floor);
    writeDraftToBooking(master, index, 'Confirm', { internalApproval: true });
    await saveMasterList(master);
    if (S.internalChangeContext === context) {
      discardReportDraft();
      openBatchPlanReport(context.number, { reviewLatest: false });
    }
    renderBatchRegister();
    toast('Internal changes approved and saved. The batch plan revision is unchanged.');
    return true;
  } catch (error) {
    showSaveError(error);
    if (S.internalChangeContext === context)
      setContextError(context, 'Could not save. The confirmed plan is unchanged and your draft is available for retry.');
    return false;
  } finally {
    setMutationBusy(false);
  }
}

/* ============================================================
   Re-confirmation saves latest reviewed data with an explicit BP revision choice
   ============================================================ */
export function openReconfirmRevisionDialog(): boolean {
  if (!S.reportDraft?.reviewLatest || !canEditReport()) return false;
  if (S.reportRowEditor) {
    toast('Save or cancel the row being edited before re-confirming.');
    return false;
  }
  const booking = currentReportBooking(),
    plan = booking && savedReportPlan(booking, S.currentViewingFloor);
  if (!booking || !plan?.confirmedSnapshot) {
    toast('This booking has no confirmed plan to re-confirm.');
    return false;
  }
  const revision = confirmedBatchRevision(booking, S.currentViewingFloor);
  if (revision !== null && (!Number.isSafeInteger(revision) || revision < 0 || revision === Number.MAX_SAFE_INTEGER)) {
    toast('The saved batch plan revision cannot be incremented.');
    return false;
  }
  closeMachineEvaluation();
  closeTentativeQuestionnaire(false);
  S.ui.planflowFocus = null;
  S.reconfirmRevisionContext = { number: booking.number, floor: S.currentViewingFloor, draft: S.reportDraft, plan, revision, error: '' };
  notify();
  return true;
}
export function closeReconfirmRevisionDialog(restoreFocus = true): void {
  const open = S.reconfirmRevisionContext;
  S.reconfirmRevisionContext = null;
  if (restoreFocus && open) requestFocus('btnMakeConfirm');
  notify();
}
export function reconfirmContextMatches(context: Row | null | undefined): boolean {
  return (
    !!context &&
    context.number === S.currentViewingNumber &&
    context.floor === S.currentViewingFloor &&
    context.floor === S.activeFloor &&
    context.draft === S.reportDraft &&
    !!S.reportDraft?.reviewLatest &&
    savedReportPlan(currentReportBooking() as Row, context.floor) === context.plan
  );
}
export async function submitReconfirmRevisionChoice(increaseRevision: boolean): Promise<boolean | undefined> {
  const context = S.reconfirmRevisionContext;
  if (typeof increaseRevision !== 'boolean' || !canChangeData()) return false;
  if (!context || !reconfirmContextMatches(context)) {
    closeReconfirmRevisionDialog(false);
    toast('The booking changed. Reopen the latest plan review.');
    return false;
  }
  const saved = await updateBookingStatus('Confirm', null, increaseRevision);
  if (!saved && S.reconfirmRevisionContext === context)
    setContextError(context, 'The plan was not saved. Your review and selected data are still available. Please try again.');
  return saved;
}

/* ============================================================
   9. CHANGE BOOKING STATUS AND SAVE IT
   ============================================================ */
export async function updateBookingStatus(
  newStatus: string,
  tentativeAnswers: Row | null = null,
  increaseRevision: boolean | null = null
): Promise<boolean | undefined> {
  if (!S.currentViewingNumber || !canEditReport() || !S.reportDraft) return false;
  if (S.reportRowEditor) {
    toast('Save or cancel the row being edited before saving the booking.');
    return;
  }
  if (isConfirmedInternalDraft() && S.reportDraft.dirty) {
    toast('Approve the edits using Internal change, or discard them before changing booking status.');
    return false;
  }
  if (S.reportDraft.reviewLatest && newStatus !== 'Confirm') {
    toast('Re-confirm this review or return to the list to keep the existing confirmed plan.');
    return false;
  }
  if (S.reportDraft.reviewLatest && newStatus === 'Confirm') {
    if (typeof increaseRevision !== 'boolean') {
      openReconfirmRevisionDialog();
      return false;
    }
    if (!reconfirmContextMatches(S.reconfirmRevisionContext)) {
      toast('Open the revision choice popup again before saving.');
      return false;
    }
    if (!increaseRevision) {
      const number = S.currentViewingNumber;
      discardReportDraft();
      openBatchPlanReport(number, { reviewLatest: false });
      renderBatchRegister();
      toast('The previously confirmed plan and revision are unchanged. Revised data remains in Need Re-Confirm List.');
      return true;
    }
  }
  if (newStatus === 'Confirm') {
    const error = confirmGeneralInfoError(currentReportBooking() as Row, S.currentViewingFloor);
    if (error) {
      toast(error);
      return false;
    }
  }
  if (['Tentative', 'Confirm'].includes(newStatus)) {
    const error = tallBigSaveError(currentReportBooking() as Row, S.currentViewingFloor);
    if (error) {
      toast(error);
      return false;
    }
  }
  if (newStatus === 'Tentative' && !tentativeAnswers) {
    openTentativeQuestionnaire();
    return false;
  }
  if (newStatus === 'Tentative' && !validTentativeAnswers(tentativeAnswers)) {
    toast('Answer each Yes/No question before saving.');
    return false;
  }
  const master = getStoredMasterList().slice(),
    index = master.findIndex((booking) => booking.number === S.currentViewingNumber);
  if (index < 0) return;
  const bookingNumber = S.currentViewingNumber,
    floor = S.currentViewingFloor,
    activeDraft = S.reportDraft;
  const previousStatus = reportBookingStatus(master[index], floor);
  const previousPlan = savedReportPlan(master[index], floor),
    previousRevision = previousPlan.confirmedSnapshot ? confirmedBatchRevision(master[index], floor) : null;
  if (newStatus !== 'Pending' && activeDraft.manual.batchRows) {
    const fabrics = activeDraft.manual.fabricRows || S.currentFabricRows;
    activeDraft.manual.batchRows = sanitizeReportAssignments(activeDraft.manual.batchRows, fabrics, floor).rows;
  }
  writeDraftToBooking(master, index, newStatus);
  const plan = savedReportPlan(master[index], floor);
  if (newStatus === 'Tentative') plan.tentativeBy = currentUsername();
  if (newStatus === 'Confirm') {
    plan.confirmedBy = currentUsername();
    if (!previousPlan.confirmedSnapshot && !plan.batchPlanCreatedAt) plan.batchPlanCreatedAt = plan.lastSaveAt;
    if (activeDraft.reviewLatest) plan.batchPlanRevisedAt = plan.lastSaveAt;
    plan.flatAllowanceSnapshot = copyReportData(getFlatAllowance());
    const rows = activeDraft.reviewLatest ? activeDraft.reviewSourceRows : getReportKnittingRows(bookingNumber, floor);
    if (activeDraft.reviewLatest && plan.confirmedSnapshot)
      plan.revisedBatch = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
    plan.confirmedSnapshot = makeConfirmedSnapshot(master[index], floor, rows);
    plan.confirmedSnapshot.reportData = captureConfirmedReport(master[index], floor);
    if (previousPlan.confirmedSnapshot)
      plan.confirmedSnapshot.revisionNo = activeDraft.reviewLatest && increaseRevision ? (previousRevision ?? 0) + 1 : previousRevision;
    if (activeDraft.reviewLatest) {
      plan.lastReconfirmation = {
        increaseRevision,
        previousRevisionNo: previousRevision,
        revisionNo: plan.confirmedSnapshot.revisionNo,
        savedAt: plan.lastSaveAt,
        savedBy: currentUsername(),
        uploadedYBRevisionNo: revisionNumberFromRows(rows),
      };
      delete plan.pmcCorrectionAt;
      delete plan.pmcCorrectionBy;
    }
  }
  if (newStatus === 'Confirm' && ['Pending', 'Tentative'].includes(previousStatus)) {
    const header = plan.confirmedSnapshot?.headerData || master[index];
    plan.confirmedAt = plan.lastSaveAt;
    plan.confirmedFromStatus = previousStatus;
    plan.confirmationHistory = [
      ...(previousPlan.confirmationHistory || []),
      {
        number: bookingNumber,
        buyer: header.buyer || '',
        unit: header.unit || '',
        revisionNo: plan.confirmedSnapshot?.revisionNo ?? 0,
        confirmedAt: plan.lastSaveAt,
        confirmedBy: plan.confirmedBy,
        fromStatus: previousStatus,
      },
    ];
  }
  if (newStatus === 'Tentative') plan.tentativeAnswers = copyReportData(tentativeAnswers);
  setMutationBusy(true);
  try {
    await saveMasterList(master);
    if (S.reportDraft === activeDraft) {
      activeDraft.dirty = false;
      if (newStatus === 'Pending') discardReportDraft();
    }
    toast(`Order ${bookingNumber}${floor ? ' · ' + floorLabel(floor) : ''} saved as ${newStatus === 'Confirm' ? 'Confirmed' : newStatus}.`);
    if (S.currentViewingNumber === bookingNumber && S.currentViewingFloor === floor && S.activeFloor === floor) {
      if (newStatus === 'Confirm') discardReportDraft();
      openBatchPlanReport(bookingNumber, { reviewLatest: false });
    }
    renderBatchRegister();
    return true;
  } catch (error) {
    showSaveError(error);
    return false;
  } finally {
    setMutationBusy(false);
  }
}

/* ============================================================
   Tentative questionnaire. Nothing is saved when opening/cancelling this review. All answers must be explicit.
   The dialog's inputs write into context.answers (changeTentativeAnswer); context.error is its message.
   ============================================================ */
// Typed copy of constants.ts TENTATIVE_ANSWER_FIELDS (not exported again: the barrel already exports the constant).
const TENTATIVE_ANSWER_FIELDS = ['labDip', 'bookingHold', 'productionConfirmed'] as const;
export function validTentativeAnswers(answers: Row | null | undefined): boolean {
  return (
    !!answers && TENTATIVE_ANSWER_FIELDS.every((field) => ['Yes', 'No'].includes(answers[field])) && typeof answers.others === 'string'
  );
}
export function openTentativeQuestionnaire(): void {
  if (!S.currentViewingNumber || !S.reportDraft || !canEditReport()) return;
  if (S.reportRowEditor) {
    toast('Save or cancel the row being edited before saving the booking.');
    return;
  }
  closeMachineEvaluation();
  const booking = currentReportBooking();
  if (!booking) return;
  const answers: Row = savedReportPlan(booking, S.currentViewingFloor).tentativeAnswers || {};
  S.ui.planflowFocus = null;
  S.tentativeQuestionnaireContext = {
    number: S.currentViewingNumber,
    floor: S.currentViewingFloor,
    // The element that had the focus (the dialog stores it when it opens).
    returnFocus: null,
    answers: {
      labDip: answers.labDip,
      bookingHold: answers.bookingHold,
      productionConfirmed: answers.productionConfirmed,
      others: answers.others || '',
    },
    error: '',
  };
  notify();
}
export function closeTentativeQuestionnaire(restoreFocus = true): void {
  const context = S.tentativeQuestionnaireContext;
  S.tentativeQuestionnaireContext = null;
  if (restoreFocus && context) requestFocus(context.returnFocus || 'btnMakeTentative');
  notify();
}
/** A questionnaire input changed (old radio buttons / #tentativeOthers). */
export function changeTentativeAnswer(field: string, value: string): void {
  const context = S.tentativeQuestionnaireContext;
  if (!context) return;
  context.answers = { ...(context.answers || {}), [field]: value };
  notify();
}
export async function saveTentativeQuestionnaire(): Promise<boolean | undefined> {
  if (!S.tentativeQuestionnaireContext || !canChangeData()) return false;
  const context = S.tentativeQuestionnaireContext;
  if (context.number !== S.currentViewingNumber || context.floor !== S.currentViewingFloor || context.floor !== S.activeFloor) {
    closeTentativeQuestionnaire(false);
    return false;
  }
  const inputs: Row = context.answers || {};
  const answers: Row = { others: text(inputs.others).trim() };
  TENTATIVE_ANSWER_FIELDS.forEach((field) => {
    answers[field] = ['Yes', 'No'].includes(inputs[field]) ? inputs[field] : '';
  });
  if (!validTentativeAnswers(answers)) {
    setContextError(context, 'Select Yes or No for each of the three questions.');
    return false;
  }
  const saved = await updateBookingStatus('Tentative', answers);
  if (!saved && S.tentativeQuestionnaireContext === context)
    setContextError(context, 'The booking was not saved. Your answers are still here. Please try again.');
  return saved;
}

/* ============================================================
   Confirm checks (Are Lapdip, Reference, and Additional Process correct?)
   ============================================================ */
export function closeConfirmChecks(): void {
  S.confirmChecksContext = null;
  requestFocus('btnMakeConfirm');
  notify();
}
export function openConfirmChecks(): boolean {
  if (!S.currentViewingNumber || !S.reportDraft || !canEditReport() || S.mutationBusy) return false;
  if (S.reportRowEditor) {
    toast('Save or cancel the row being edited before saving the booking.');
    return false;
  }
  S.ui.planflowFocus = null;
  S.confirmChecksContext = { number: S.currentViewingNumber, floor: S.currentViewingFloor, draft: S.reportDraft };
  notify();
  return true;
}
export async function proceedConfirmChecks(): Promise<boolean | undefined> {
  const context = S.confirmChecksContext;
  if (!context || S.mutationBusy) return false;
  const valid = context.number === S.currentViewingNumber && context.floor === S.currentViewingFloor && context.draft === S.reportDraft;
  closeConfirmChecks();
  if (!valid) {
    toast('The booking changed. Click Confirm again.');
    return false;
  }
  return await updateBookingStatus('Confirm');
}

/* ============================================================
   Back to the list
   ============================================================ */
export function backToList(): void {
  closeDyeableFilters(false);
  closeBatchPlanPreview(false);
  closeInternalChangeDialog(false);
  closeReconfirmRevisionDialog(false);
  closeTentativeQuestionnaire(false);
  closeMachineEvaluation();
  discardReportDraft();
  S.currentViewingNumber = null;
  S.currentViewingFloor = null;
  renderBatchRegister();
}

/* ============================================================
   Printing. The page footer (printed date, user, page numbers) is a print-only @page rule, written just
   before printing (also on the browser's own print command: BatchPlanPage listens to beforeprint).
   ============================================================ */
/** The CSS of the Batch Plan page footer (old prepareBatchPlanPrint's style text). */
export function batchPlanPrintFooterCss(): string {
  const left = 'Printed Date & Time: ' + dyeablePrintedAt(new Date().toISOString()) + ', Print by: ' + currentUsername();
  const cssText = (value: string) => JSON.stringify(value).replace(/</g, '\\3c ');
  return (
    '@media print{@page batch-plan{size:A4 landscape;margin:8mm 8mm 18mm;@bottom-left{content:' +
    cssText(left) +
    ';font:7pt Arial;vertical-align:middle;width:40%}@bottom-center{content:"This is the PMC internal ERP System Generated Report";font:7pt Arial;vertical-align:middle;width:42%}@bottom-right{content:"Page " counter(page,decimal-leading-zero) " out of " counter(pages,decimal-leading-zero);font:bold 7pt Arial;vertical-align:middle;width:18%}}}'
  );
}
/** Writes the footer style (<style id="batchPlanPrintFooter"> in <head>); print-only, like printWithBodyClass. */
export function prepareBatchPlanPrint(): void {
  if (typeof document === 'undefined') return;
  let style = document.getElementById('batchPlanPrintFooter');
  if (!style) {
    style = document.createElement('style');
    style.id = 'batchPlanPrintFooter';
    document.head.appendChild(style);
  }
  style.textContent = batchPlanPrintFooterCss();
}
export function printBatchPlan(): void {
  prepareBatchPlanPrint();
  printWithBodyClass(null);
}

/* ============================================================
   Read-only full report view. Zoom and printing never commit booking drafts.
   S.batchPlanPreviewState = {number, floor, width, scale, fit, returnFocus}. The dialog component copies
   #reportContent into its paper (old openBatchPlanPreview), measures it and applies the zoom.
   ============================================================ */
export interface BatchPlanPreviewMetrics {
  /** viewport.clientWidth / clientHeight of #batchPlanPreviewViewport */
  viewportWidth: number;
  viewportHeight: number;
  /** page.scrollHeight || page.offsetHeight of the copied page */
  pageHeight: number;
}
export function closeBatchPlanPreview(restoreFocus = true): void {
  const state = S.batchPlanPreviewState;
  S.batchPlanPreviewState = null;
  if (state && restoreFocus) requestFocus(state.returnFocus);
  notify();
}
export function setBatchPlanPreviewZoom(value: number): void {
  if (!S.batchPlanPreviewState) return;
  const state = S.batchPlanPreviewState,
    scale = Math.max(0.05, Math.min(2, Number(value) || 1));
  state.scale = scale;
  notify();
}
/** Old fitBatchPlanPreview(mode); new optional `metrics`: the viewport and page sizes the old code measured. */
export function fitBatchPlanPreview(mode: string | null = 'width', metrics?: BatchPlanPreviewMetrics): void {
  if (!S.batchPlanPreviewState) return;
  const state = S.batchPlanPreviewState;
  state.fit = mode;
  if (!metrics || !state.width) return;
  const width = (metrics.viewportWidth || 1100) - 48,
    height = (metrics.viewportHeight || 700) - 48;
  const scale = mode === 'page' ? Math.min(width / state.width, height / Math.max(metrics.pageHeight || 1, 1)) : width / state.width;
  setBatchPlanPreviewZoom(Math.min(1, scale));
}
/** Old #btnPreviewZoomOut / #btnPreviewZoomIn / #btnPreviewActualSize listeners. */
export function zoomBatchPlanPreview(step: number): void {
  if (S.batchPlanPreviewState) {
    S.batchPlanPreviewState.fit = null;
    setBatchPlanPreviewZoom(S.batchPlanPreviewState.scale + step);
  }
}
export function actualSizeBatchPlanPreview(): void {
  if (S.batchPlanPreviewState) {
    S.batchPlanPreviewState.fit = null;
    setBatchPlanPreviewZoom(1);
  }
}
export function openBatchPlanPreview(): boolean {
  if (!S.currentViewingNumber) return false;
  if (S.reportRowEditor) {
    toast('Save or cancel the row being edited before opening the full view.');
    return false;
  }
  closeMachineEvaluation();
  // width is measured by the dialog when it copies the report (Math.max(1480, widest table) + 48).
  S.ui.planflowFocus = null;
  S.batchPlanPreviewState = { number: S.currentViewingNumber, floor: S.currentViewingFloor, width: 0, scale: 1, fit: 'width', returnFocus: null };
  notify();
  return true;
}

/* ============================================================
   13. NAVIGATION
   ============================================================ */
/** The part of the old switchMainView that changes the state (no navigation). */
function resetMainView(view: string): void {
  closeDailyConfirmFilters();
  closeDyeableFilters(false);
  closeBatchPlanPreview(false);
  closeInternalChangeDialog(false);
  closeReconfirmRevisionDialog(false);
  closeTentativeQuestionnaire(false);
  closeMachineEvaluation();
  discardReportDraft();
  S.currentViewingNumber = null;
  S.currentViewingFloor = null;
  renderUnitTabs(view); // the unit tabs under the heading name the open unit
  if (view === 'reports') {
    renderDyeableReport();
    return;
  }
  if (view === 'cards') {
    renderCardRegister();
    return;
  }
  if (view === 'upload') return; // the app has its own Source File Upload page
  if (view === 'setup') renderSetupPanels();
  else renderBatchRegister();
}

function currentPathname(): string {
  return typeof window === 'undefined' ? '' : window.location.pathname;
}

/** Old switchMainView(view): closes the dialogs and the open report, and moves to the view's route:
    'batch' -> /batch/plan[/<unit>], 'cards' -> /batch/card[/<unit>], 'setup' -> /batch/setup/<panel>,
    'reports' -> /batch/report/<mode>, 'upload' -> the Source File Upload page. A unit change on the same
    page replaces the URL (old syncRoute); nothing moves when the route is already open. */
export function switchMainView(view: string): void {
  resetMainView(view);
  const current = currentPathname();
  if (view === 'batch') {
    if (current === '/batch/plan' || current.startsWith('/batch/plan/')) syncBatchPlanRoute();
    else {
      const url = batchPlanUrl();
      pendingPlanUrls.push(url);
      navigateTo(url);
    }
    return;
  }
  const path =
    view === 'reports'
      ? '/batch/report/' + S.dyeableReportMode
      : view === 'cards'
        ? '/batch/card' + (S.activeCardFloor ? '/' + S.activeCardFloor : '')
        : view === 'setup'
          ? '/batch/setup/' + S.activeSetupPanel
          : view === 'upload'
            ? '/management/upload'
            : '';
  if (!path || current === path) return;
  const sameUnitPage = view === 'cards' && (current === '/batch/card' || current.startsWith('/batch/card/'));
  navigateTo(path, sameUnitPage ? { replace: true } : undefined);
}

/** The Batch Plan page was left for another page: its report and dialogs close and the draft is dropped,
    as the old switchMainView did when another view opened. */
export function leaveBatchPlan(): void {
  pendingPlanUrls.length = 0;
  shownPlanUrl = null;
  if (
    !S.currentViewingNumber &&
    !S.reportDraft &&
    !S.batchPlanPreviewState &&
    !S.internalChangeContext &&
    !S.reconfirmRevisionContext &&
    !S.tentativeQuestionnaireContext &&
    !S.confirmChecksContext
  )
    return;
  closeBatchPlanPreview(false);
  closeInternalChangeDialog(false);
  closeReconfirmRevisionDialog(false);
  closeTentativeQuestionnaire(false);
  S.confirmChecksContext = null;
  closeMachineEvaluation();
  discardReportDraft();
  S.currentViewingNumber = null;
  S.currentViewingFloor = null;
  notify();
}
