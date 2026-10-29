/* Batch Plan module state.
   The old page kept its state in top-level `let` variables of js/batch/batch-app.js. They all live here,
   on one object `S` with the same names (old `reportDraft` is now `S.reportDraft`), so the engine rules
   read exactly as before. The state is module-level: it survives moves between the Batch routes and
   back, like the old page did inside its iframe.

   React: engine code calls `notify()` after it changes anything the screen shows; components call
   `useBatchVersion()` to re-render on every change. */
import { useSyncExternalStore } from 'react';
import { DYEABLE_ALL } from '@/features/batch/constants';
import type { BatchAppState, BatchFloor, BatchUnit, BatchUser, Row } from '@/features/batch/types';

const ALL_FILTERS = (): Row => ({ knit: DYEABLE_ALL, labdip: DYEABLE_ALL, buyer: DYEABLE_ALL, floor: DYEABLE_ALL, machine: DYEABLE_ALL });

export interface BatchState {
  // ---- data (GET /api/batch/state) and saving ----
  storageReady: boolean;
  mutationBusy: boolean;
  appState: BatchAppState;
  planVersions: Map<string, number>;
  settingVersions: Record<string, number>;
  user: BatchUser | null;
  /** Units of the heading tabs, [{key, label}] (also kept in BATCH_FLOORS). */
  batchUnits: BatchUnit[];
  // ---- loading screen and messages (old body.batch-loading, #batchLoadError, #toast, #viewBadge) ----
  loading: boolean;
  loadingText: string;
  loadError: string;
  loadSummary: string;
  toastMessage: string;
  toastId: number;
  // ---- Setup pages ----
  activeSetupPanel: 'dyeing' | 'flat' | 'unit';
  flatAllowanceDraft: Row[] | null;
  flatAllowanceDirty: boolean;
  setupDraft: Row[] | null;
  setupDirty: boolean;
  unitSetupBuyerNames: string[];
  unitSetupUnitOptions: { name: string; status: string }[];
  unitSetupDraft: Map<string, string> | null;
  constructionChoiceSource: unknown;
  constructionBpSource: unknown;
  constructionChoiceCache: string[];
  fabricPickerState: Row | null;
  // ---- Batch Plan register ----
  activeStatusTab: string;
  activeBuyerFilter: string;
  /** Text of the register's search box (old #globalSearchInput; globalSearchTerm() reads it). */
  globalSearch: string;
  /** Column filters of the register (old #colSearchOrder, #colSearchDate, #colSearchBuyer). */
  columnSearch: { order: string; date: string; buyer: string };
  activeFloor: string | null;
  /** Rows per register page: 'auto' (as many rows as fit in the table area, see registerAutoRows), '10', '20', '50', '100' or 'All'. */
  registerPageSize: string;
  /** Rows that fit in the register's table area (measured by the register component; null until measured). */
  registerAutoRows: number | null;
  registerPage: number;
  registerTotalPages: number;
  registerFilterSignature: string;
  // ---- Batch Plan report ----
  currentViewingNumber: string | null;
  currentViewingFloor: string | null;
  currentReportReviewLatest: boolean;
  reportDraft: Row | null;
  reportRowEditor: Row | null;
  currentFabricRows: Row[];
  currentBatchRows: Row[];
  currentReportBatchRowsTruncated: boolean;
  currentComponentSections: Row[];
  currentReportMachineEvaluations: Row[];
  machineEvaluationContext: Row | null;
  internalChangeContext: Row | null;
  reconfirmRevisionContext: Row | null;
  tallBigDeclarationContext: Row | null;
  odDeclarationContext: Row | null;
  tentativeQuestionnaireContext: Row | null;
  confirmChecksContext: Row | null;
  batchPlanPreviewState: Row | null;
  confirmedCaptureContext: Row | null;
  rebuildingConfirmedReport: boolean;
  // ---- indexes and caches rebuilt from the data ----
  indexedKnittingPlan: unknown;
  knittingBookingIndex: Map<string, Row>;
  indexedSourceMaster: unknown;
  sourceBookingIndex: Map<string, Row>;
  comparedKnittingDataset: unknown;
  latestSourceFingerprints: Map<string, string>;
  indexedBpData: unknown;
  bpBookingIndex: Map<string, Row[]>;
  // ---- Batch Card ----
  activeCardFloor: string | null;
  /** Text of the Batch Card search box (old #cardSearch). */
  cardSearch: string;
  activeCardStatus: string;
  cardPage: number;
  cardPageSize: string;
  currentCardOrder: Row | null;
  currentCardRecordId: string | null;
  wholeOrderCardsSource: unknown;
  wholeOrderCardOrders: Set<string>;
  // ---- Batch Reports ----
  dyeableReportResult: Row | null;
  dyeableFilterContext: Row | null;
  dyeableExportBusy: boolean;
  dyeableReportMode: 'detail' | 'summary' | 'daily';
  dyeableSummaryResult: Row | null;
  dyeableReportFilters: Row;
  dyeableSummaryFilters: Row;
  dailyConfirmResult: Row | null;
  /** Extra per-feature state that is not one of the old globals (owned and documented by each feature). */
  ui: Row;
}

export const S: BatchState = {
  storageReady: false,
  mutationBusy: false,
  appState: { master: [], files: [], datasets: { genInfo: {}, knitPlan: {} }, setup: [], flatAllowance: [], unitSetup: [], cards: [] },
  planVersions: new Map(),
  settingVersions: {},
  user: null,
  batchUnits: [],
  loading: true,
  loadingText: 'Connecting to the server…',
  loadError: '',
  loadSummary: '',
  toastMessage: '',
  toastId: 0,
  activeSetupPanel: 'dyeing',
  flatAllowanceDraft: null,
  flatAllowanceDirty: false,
  setupDraft: null,
  setupDirty: false,
  unitSetupBuyerNames: [],
  unitSetupUnitOptions: [],
  unitSetupDraft: null,
  constructionChoiceSource: null,
  constructionBpSource: null,
  constructionChoiceCache: [],
  fabricPickerState: null,
  activeStatusTab: 'Pending',
  activeBuyerFilter: 'ALL',
  globalSearch: '',
  columnSearch: { order: '', date: '', buyer: '' },
  activeFloor: null,
  registerPageSize: 'auto',
  registerAutoRows: null,
  registerPage: 1,
  registerTotalPages: 1,
  registerFilterSignature: '',
  currentViewingNumber: null,
  currentViewingFloor: null,
  currentReportReviewLatest: false,
  reportDraft: null,
  reportRowEditor: null,
  currentFabricRows: [],
  currentBatchRows: [],
  currentReportBatchRowsTruncated: false,
  currentComponentSections: [],
  currentReportMachineEvaluations: [],
  machineEvaluationContext: null,
  internalChangeContext: null,
  reconfirmRevisionContext: null,
  tallBigDeclarationContext: null,
  odDeclarationContext: null,
  tentativeQuestionnaireContext: null,
  confirmChecksContext: null,
  batchPlanPreviewState: null,
  confirmedCaptureContext: null,
  rebuildingConfirmedReport: false,
  indexedKnittingPlan: null,
  knittingBookingIndex: new Map(),
  indexedSourceMaster: null,
  sourceBookingIndex: new Map(),
  comparedKnittingDataset: null,
  latestSourceFingerprints: new Map(),
  indexedBpData: null,
  bpBookingIndex: new Map(),
  activeCardFloor: null,
  cardSearch: '',
  activeCardStatus: 'Pending',
  cardPage: 1,
  cardPageSize: '10',
  currentCardOrder: null,
  currentCardRecordId: null,
  wholeOrderCardsSource: null,
  wholeOrderCardOrders: new Set(),
  dyeableReportResult: null,
  dyeableFilterContext: null,
  dyeableExportBusy: false,
  dyeableReportMode: 'detail',
  dyeableSummaryResult: null,
  dyeableReportFilters: ALL_FILTERS(),
  dyeableSummaryFilters: ALL_FILTERS(),
  dailyConfirmResult: null,
  ui: {},
};

/* ---------- units (old BATCH_FLOORS and the lookups built from it; changed in place by setBatchUnits) ---------- */
export const BATCH_FLOORS: BatchFloor[] = [
  { key: 'EFL', label: 'EFL Floor', aliases: ['EFL', 'EFL Floor', 'Epyllion Fabrics Limited'] },
  { key: 'EKL', label: 'EKL Floor', aliases: ['EKL', 'EKL Floor', 'Epyllion Knitex Limited'] },
  { key: 'EXT', label: 'Ext Floor', aliases: ['Ext', 'Ext Floor', 'EFL-Ext', 'EFL Ext', 'Extension', 'Extension Floor'] },
  { key: 'PLUVIA', label: 'Pluvia Wash', aliases: ['Pluvia', 'Pluvia Wash', 'Pluvia Washing'] },
  {
    key: 'OUTSIDE',
    label: 'Outside Dyeing',
    aliases: ['Outside', 'Outside Dyeing', 'Outside Dyeing Floor', 'Out Side', 'Out Side Dyeing', 'Outsource', 'Outsourcing', 'Subcontract', 'Subcontract Dyeing'],
  },
];
export const floorValueKey = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
export const floorAliases = new Map<string, string>(
  BATCH_FLOORS.flatMap((floor) => floor.aliases.map((alias) => [floorValueKey(alias), floor.key] as [string, string]))
);
/* The demo's five floors keep their keys and old spellings, so Dyeing MC rows such as 'EFL-EXT' and plans
   saved before still read as before. */
export const DEMO_FLOOR_ALIASES: Record<string, string[]> = Object.fromEntries(
  BATCH_FLOORS.map((floor) => [floor.key, floor.aliases.slice()])
);
export const DYEABLE_FLOOR_LABELS: Record<string, string> = { EFL: 'EFL', EKL: 'EKL', EXT: 'Ext', PLUVIA: 'Pluvia', OUTSIDE: 'Outside' };

/* ---------- change notification for React ---------- */
let version = 0;
const listeners = new Set<() => void>();

/** Tells the screen that the state changed (the old code re-rendered its HTML at these points). */
export function notify(): void {
  version++;
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getVersion(): number {
  return version;
}

/** Re-renders the calling component whenever the Batch state changes; returns the change counter. */
export function useBatchVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

/* ---------- navigation bridge: engine code moves between the Batch routes ----------
   BatchProvider registers the Next router here. `navigateTo('/batch/plan/EFL')` changes the route;
   `replace` keeps the browser history clean when the page itself corrects the route. */
type Navigator = (path: string, options?: { replace?: boolean }) => void;
let navigator: Navigator | null = null;

export function setBatchNavigator(next: Navigator | null): void {
  navigator = next;
}

export function navigateTo(path: string, options?: { replace?: boolean }): void {
  if (navigator) navigator(path, options);
  else if (typeof window !== 'undefined') window.location.assign(path);
}
