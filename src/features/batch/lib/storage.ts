/* Batch Plan module: loading and saving (port of sections 4-5 of the old js/batch/batch-app.js).
   Saves go to the backend; only changed bookings, Setup tables and cards are sent, and the screen
   changes only after the server accepted the save (the old rule). */
import { APP_SETTINGS } from '@/features/batch/constants';
import { BatchApi } from '@/features/batch/api/batch-api';
import { S, notify } from '@/features/batch/store/batch-store';
import { captureMissingConfirmedSnapshots, setBatchUnits, unsavedInheritedRemoved } from './bookings';
import type { BatchChanges, BatchCommitPayload, Booking, Row } from '@/features/batch/types';

export function currentUsername(): string {
  return String(APP_SETTINGS.currentUsername || APP_SETTINGS.uploadedBy || '').trim();
}

export function getStoredMasterList(): Booking[] {
  return S.appState.master;
}

export function getStoredDatasets(): BatchAppDatasets {
  return S.appState.datasets;
}
type BatchAppDatasets = typeof S.appState.datasets;

export function readDBState() {
  return BatchApi.loadState();
}

export async function commitChanges(changes: BatchChanges): Promise<void> {
  const payload: BatchCommitPayload = { plans: [], settings: {}, cards: [] };
  if (changes.master) {
    const previous = new Map(S.appState.master.map((booking) => [booking.number, booking]));
    for (const booking of changes.master) {
      const old = previous.get(booking.number);
      if (old !== booking && JSON.stringify(old) !== JSON.stringify(booking)) {
        payload.plans.push({ orderNo: booking.number, version: S.planVersions.get(booking.number) || 0, state: unsavedInheritedRemoved(booking) });
      }
    }
  }
  for (const key of ['setup', 'flatAllowance', 'unitSetup'] as const) {
    if (changes[key]) payload.settings[key] = { value: changes[key] as Row[], version: S.settingVersions[key] || 0 };
  }
  if (changes.cards) {
    const previous = new Map((S.appState.cards || []).map((card) => [card.id, JSON.stringify(card)]));
    payload.cards = changes.cards.filter((card) => previous.get(card.id) !== JSON.stringify(card));
  }
  if (payload.plans.length || Object.keys(payload.settings).length || payload.cards.length) {
    const result = await BatchApi.commit(payload);
    for (const [number, version] of Object.entries(result.planVersions || {})) S.planVersions.set(number, version);
    Object.assign(S.settingVersions, result.settingVersions || {});
  }
  Object.assign(S.appState, changes);
  notify();
}

export function saveMasterList(master: Booking[]): Promise<void> {
  return commitChanges({ master });
}

/** Blocks every edit while a save runs (the buttons read S.mutationBusy and S.storageReady). */
export function setMutationBusy(busy: boolean): void {
  S.mutationBusy = busy;
  notify();
}

export function canChangeData(): boolean {
  if (!S.storageReady) {
    toast('Saved data is not ready. Please wait or reopen this page.');
    return false;
  }
  if (S.mutationBusy) {
    toast('Please wait for the current save to finish.');
    return false;
  }
  return true;
}

export function showSaveError(err: unknown): void {
  const error = err as { name?: string; message?: string } | null;
  const quota = error && (error.name === 'QuotaExceededError' || /quota/i.test(error.message || ''));
  toast(
    quota
      ? 'Browser database storage is full. Free disk space and try again. Previously saved data has been kept.'
      : 'Could not save data: ' + ((error && error.message) || String(err)) + '. Previously saved data has been kept.'
  );
}

/** Loads (or reloads) everything from GET /api/batch/state. Drafts with unsaved Setup edits are kept. */
export async function initializeStorage(): Promise<void> {
  S.loading = !S.storageReady;
  setMutationBusy(true);
  let loadError: unknown = null;
  try {
    const saved = await readDBState();
    S.appState = {
      master: saved.master || [],
      files: [],
      datasets: { genInfo: saved.datasets?.genInfo || {}, knitPlan: saved.datasets?.knitPlan || {}, bpData: saved.datasets?.bpData || {} },
      setup: saved.setup || [],
      flatAllowance: saved.flatAllowance || [],
      unitSetup: saved.unitSetup || [],
      cards: saved.cards || [],
    };
    S.planVersions = new Map(Object.entries(saved.planVersions || {}));
    S.settingVersions = { ...(saved.settingVersions || {}) };
    if (Array.isArray(saved.batchUnits)) {
      setBatchUnits(saved.batchUnits);
      S.batchUnits = saved.batchUnits.slice();
    }
    S.unitSetupBuyerNames = Array.isArray(saved.buyers) ? saved.buyers : [];
    S.unitSetupUnitOptions = Array.isArray(saved.units) ? saved.units : [];
    S.unitSetupDraft = null;
    BatchApi.applyPermissions(saved.user);
    // Older confirmations without a snapshot are protected in memory (saved with the next change).
    const protectedMaster = getStoredMasterList().slice();
    if (captureMissingConfirmedSnapshots(protectedMaster)) S.appState.master = protectedMaster;
    S.storageReady = true;
    // A reload (for example after a Unit Setup save) rebuilds the Dyeing MC and Flat Allowance drafts from
    // the new data, but keeps a draft that has unsaved edits.
    if (!S.setupDirty) S.setupDraft = null;
    if (!S.flatAllowanceDirty) S.flatAllowanceDraft = null;
  } catch (err) {
    loadError = err;
    toast('Could not open saved data: ' + ((err instanceof Error && err.message) || String(err)));
  } finally {
    setMutationBusy(false);
  }
  if (loadError) BatchApi.failed(loadError);
  else BatchApi.ready();
}

/* ---------- messages (old floating #toast) ---------- */
let toastTimer: ReturnType<typeof setTimeout> | null = null;
export function toast(msg: string): void {
  S.toastMessage = msg;
  S.toastId++;
  notify();
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    S.toastMessage = '';
    notify();
  }, 6500);
}

/* ---------- Excel (the spreadsheet library is loaded on demand, as before) ---------- */
export async function ensureExcelReader(): Promise<typeof import('xlsx')> {
  return import('xlsx');
}

/* ---------- printing ----------
   Old print modes set a class on <body> (printing-batch-card, printing-dyeable-summary,
   printing-daily-confirm) that the print styles in styles/batch.css read. */
export function printWithBodyClass(className: string | null): void {
  if (className) document.body.classList.add(className);
  try {
    window.print();
  } finally {
    if (className) document.body.classList.remove(className);
  }
}
