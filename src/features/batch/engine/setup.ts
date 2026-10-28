/* Batch engine slice "setup": the Setup pages (Dyeing MC with the Not Possible Fabric picker, Flat Allowance,
   Unit Setup). Port of js/batch/batch-app.js lines 183-209 (Flat Allowance), 1750-1975 (machine setup and
   fabric picker) and 5552-5582 (Unit Setup).

   Every table edits a draft (S.setupDraft, S.flatAllowanceDraft, S.unitSetupDraft) until Save Changes
   succeeds, as before. Where the old code wrote HTML the functions below change S and call notify();
   components/setup/* render from S. The old delegated input/click listeners are the exported
   change..., insert... and save... functions that the components call from their React handlers.

   UI state that is not one of the old globals:
   - S.fabricPickerState keeps the old fields {rowIndex, machineId, selected, limits, choices} plus the dialog
     contents the old code wrote into the DOM: title, migration, search, error, visible, selectAll*, countText.
   - S.ui.setupSaveStatus: text of #setupSaveStatus ('Saved' | 'Unsaved changes' | 'Saving…').
   - S.ui.setupUnitSearch: text of #unitSetupSearch. */
import { MACHINE_SETUP_FIELDS } from './constants';
import { BatchApi } from './api';
import { S, notify } from './state';
import { canChangeData, commitChanges, setMutationBusy, showSaveError, toast } from './storage';
import {
  constructionKey,
  fabricQuantity,
  fabricRestrictionText,
  getFabricConstructionChoices,
  getFlatAllowance,
  getMachineSetup,
  machineFabricRestrictions,
  parseAllowanceLoss,
  parseAllowanceRange,
} from './calc';
import { getUnitSetup, unitBuyerKey, unitForBuyer, unitSetupBuyerList, unitSetupValue } from './core';
import { copyReportData } from './model';
import type { Row } from './types';

export type SetupPanel = 'dyeing' | 'flat' | 'unit';

/** The Not Possible Fabric dialog context (old fabricPickerState plus what the old dialog DOM held). */
export interface FabricPickerState extends Row {
  rowIndex: number;
  machineId: unknown;
  /** constructionKey -> fabric name of the checked (blocked) fabrics. */
  selected: Map<string, string>;
  /** constructionKey -> GSM limit text. */
  limits: Map<string, string>;
  choices: string[];
  /** Old #fabricPickerTitle. */
  title: string;
  /** Old #fabricPickerMigration ('' = hidden). */
  migration: string;
  /** Old #fabricPickerSearch value. */
  search: string;
  /** Old #fabricPickerError. */
  error: string;
  /** Choices matching the search (old #fabricPickerChoices rows). */
  visible: string[];
  /** Old #fabricPickerSelectAll checked / indeterminate / disabled. */
  selectAllChecked: boolean;
  selectAllIndeterminate: boolean;
  selectAllDisabled: boolean;
  /** Old #fabricPickerCount. */
  countText: string;
}

function picker(): FabricPickerState | null {
  return S.fabricPickerState as FabricPickerState | null;
}

/* ============================================================
   Panels (old lines 183-196)
   ============================================================ */

export function renderFlatAllowance(): void {
  if (S.flatAllowanceDraft === null) S.flatAllowanceDraft = copyReportData(getFlatAllowance()) as Row[];
  notify();
}

/** State only: the route /batch/setup/<panel> shows the panel (the old switchMainView('setup') is the route change;
    call planflow's switchMainView('setup') after this to move there from another page). */
export function selectSetupPanel(panel: string): void {
  S.activeSetupPanel = panel === 'unit' ? 'unit' : panel === 'flat' ? 'flat' : 'dyeing';
  renderSetupPanels();
}

export function renderSetupPanels(): void {
  if (S.activeSetupPanel === 'unit') renderUnitSetup();
  else if (S.activeSetupPanel === 'flat') renderFlatAllowance();
  else renderMachineSetup();
}

/* ---------- Flat Allowance edits (old listeners, lines 197-207) ---------- */

/** Old #flatAllowanceRows input listener. */
export function changeFlatAllowanceField(index: number, field: string, value: string): void {
  if (S.mutationBusy) return;
  if (S.flatAllowanceDraft === null) S.flatAllowanceDraft = copyReportData(getFlatAllowance()) as Row[];
  const rule = S.flatAllowanceDraft[index];
  if (!rule) return;
  rule[field] = value;
  S.flatAllowanceDirty = true;
  notify();
}

/** Old #btnInsertAllowance click. */
export function insertFlatAllowanceRow(): void {
  if (!canChangeData()) return;
  if (S.flatAllowanceDraft === null) S.flatAllowanceDraft = copyReportData(getFlatAllowance()) as Row[];
  S.flatAllowanceDraft.push({ id: 'allowance_' + Date.now(), dyeingType: 'All', flatType: 'All', range: '', loss: '' });
  S.flatAllowanceDirty = true;
  renderFlatAllowance();
}

/** Old #btnSaveAllowance click. */
export async function saveFlatAllowance(): Promise<void> {
  if (!canChangeData()) return;
  const rules: Row[] = copyReportData(S.flatAllowanceDraft || getFlatAllowance());
  for (let index = 0; index < rules.length; index++) {
    const rule = rules[index];
    if (
      !['all', 'solid', 'yd'].includes(String(rule.dyeingType).trim().toLowerCase()) ||
      !['all', 'collar', 'cuff', 'hem', 'placket'].includes(String(rule.flatType).trim().toLowerCase()) ||
      !parseAllowanceRange(rule.range) ||
      !parseAllowanceLoss(rule.loss)
    ) {
      toast('Check Flat Allowance row ' + (index + 1) + ': use a valid type, quantity range and percentage or +pcs.');
      return;
    }
  }
  setMutationBusy(true);
  try {
    await commitChanges({ flatAllowance: rules });
    S.flatAllowanceDraft = copyReportData(rules);
    S.flatAllowanceDirty = false;
    renderFlatAllowance();
    toast('Flat Allowance saved.');
  } catch (error) {
    showSaveError(error);
  } finally {
    setMutationBusy(false);
  }
}

/* ============================================================
   Dyeing MC (old lines 1750-1811)
   ============================================================ */

/** Old #setupSaveStatus text and colour: the component shows S.ui.setupSaveStatus, coloured by S.setupDirty. */
export function updateSetupSaveStatus(): void {
  S.ui.setupSaveStatus = S.setupDirty ? 'Unsaved changes' : 'Saved';
  notify();
}

export function renderMachineSetup(): void {
  if (S.setupDraft === null) S.setupDraft = getMachineSetup().map((row: Row) => ({ ...row })) as Row[];
  updateSetupSaveStatus();
}

/** Old #machineSetupRows input listener. */
export function changeMachineSetupField(rowIndex: number, field: string, value: string): void {
  if (!S.storageReady || S.mutationBusy) return;
  if (!S.setupDraft?.[rowIndex] || !MACHINE_SETUP_FIELDS.some(([key]) => key === field)) return;
  S.setupDraft[rowIndex][field] = value;
  S.setupDirty = true;
  updateSetupSaveStatus();
}

/** Old #btnInsertMachine click. Returns true when a row was added (the component then scrolls to it and
    focuses its first input, as the old listener did). */
export function insertMachineSetupRow(): boolean {
  if (!canChangeData()) return false;
  if (S.setupDraft === null) S.setupDraft = getMachineSetup().map((row: Row) => ({ ...row })) as Row[];
  const row: Row = { id: 'machine_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) };
  for (const [field] of MACHINE_SETUP_FIELDS) row[field] = '';
  S.setupDraft.push(row);
  S.setupDirty = true;
  renderMachineSetup();
  return true;
}

export async function saveMachineSetup(): Promise<void> {
  if (!canChangeData()) return;
  if (!S.setupDirty) {
    toast('No setup changes to save.');
    return;
  }
  const setup = (S.setupDraft as Row[]).map((row) => ({ ...row }));
  setMutationBusy(true);
  S.ui.setupSaveStatus = 'Saving…';
  notify();
  try {
    await commitChanges({ setup });
    S.setupDirty = false;
    updateSetupSaveStatus();
    toast('Machine setup saved successfully.');
  } catch (error) {
    showSaveError(error);
    updateSetupSaveStatus();
  } finally {
    setMutationBusy(false);
  }
}

/* ============================================================
   Not Possible Fabric picker (old lines 1879-1975)
   ============================================================ */

/** The Not Possible Fabric cell button of a machine row. The old function returned the button HTML; this returns
    what the button shows: its text, title, aria-label and disabled flag. */
export function fabricPickerButton(row: Row, index: number): { label: string; title: string; ariaLabel: string; disabled: boolean } {
  const rules = machineFabricRestrictions(row).filter((rule: Row) => rule.blocked || rule.gsmGreaterThan),
    text: string = rules.map(fabricRestrictionText).join('; ');
  return {
    label: text || 'Select fabrics / GSM…',
    title: text || 'Select excluded fabrics and per-fabric GSM limits',
    ariaLabel: 'Not Possible Fabric for row ' + (index + 1),
    disabled: S.mutationBusy || !S.storageReady,
  };
}

export function openFabricPicker(rowIndex: number): void {
  if (!canChangeData() || !S.setupDraft?.[rowIndex]) return;
  const machine = S.setupDraft[rowIndex],
    rules: Row[] = machineFabricRestrictions(machine);
  const selected = new Map<string, string>(rules.filter((rule) => rule.blocked).map((rule) => [constructionKey(rule.fabric), rule.fabric]));
  const limits = new Map<string, string>(rules.map((rule) => [constructionKey(rule.fabric), rule.gsmGreaterThan]));
  const choices = new Map<string, string>(getFabricConstructionChoices().map((value: string) => [constructionKey(value), value]));
  for (const rule of rules) if (!choices.has(constructionKey(rule.fabric))) choices.set(constructionKey(rule.fabric), rule.fabric);
  const legacy =
    String(machine.notPossibleGsm ?? '').trim() ||
    (machine.notPossibleFabricRules || []).some((rule: Row) => !rule.fabric && String(rule.gsmGreaterThan ?? '').trim());
  const state: FabricPickerState = {
    rowIndex,
    machineId: machine.id,
    selected,
    limits,
    choices: Array.from(choices.values()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    title: 'Not Possible Fabric · ' + (machine.mcBrand || 'Machine') + '-' + (machine.mcNo || rowIndex + 1),
    search: '',
    error: '',
    migration: legacy
      ? 'The previous shared GSM limit is shown on each existing fabric row. You can change or clear each fabric’s limit independently.'
      : '',
    visible: [],
    selectAllChecked: false,
    selectAllIndeterminate: false,
    selectAllDisabled: true,
    countText: '0 selected',
  };
  S.fabricPickerState = state;
  // The dialog component focuses the search box when it opens.
  renderFabricPickerChoices();
}

export function visibleFabricPickerChoices(): string[] {
  const search = constructionKey(picker()?.search ?? '');
  return (picker()?.choices || []).filter((value) => constructionKey(value).includes(search));
}

export function updateFabricPickerCount(): void {
  const state = picker();
  if (!state) return;
  const visible = visibleFabricPickerChoices(),
    checked = visible.filter((value) => state.selected.has(constructionKey(value))).length;
  state.selectAllChecked = !!visible.length && checked === visible.length;
  state.selectAllIndeterminate = checked > 0 && checked < visible.length;
  state.selectAllDisabled = !visible.length;
  const limits = Array.from(state.limits.values()).filter((value) => String(value).trim()).length;
  state.countText = state.selected.size + ' fabrics blocked · ' + limits + ' GSM limits';
  notify();
}

/** Recomputes the listed choices (S.fabricPickerState.visible) from the search text, then the counts. */
export function renderFabricPickerChoices(): void {
  const state = picker();
  if (!state) return;
  state.visible = visibleFabricPickerChoices();
  updateFabricPickerCount();
}

/** Closes the dialog; the dialog component gives the focus back to the row's Not Possible Fabric button. */
export function closeFabricPicker(): void {
  S.fabricPickerState = null;
  notify();
}

export function applyFabricPicker(): void {
  const state = picker();
  if (!state || !canChangeData()) return;
  const { rowIndex, machineId, selected, limits, choices } = state;
  if (S.setupDraft?.[rowIndex]?.id !== machineId) {
    closeFabricPicker();
    return;
  }
  const draft = S.setupDraft as Row[];
  const rules = choices
    .map((fabric) => ({
      fabric,
      blocked: selected.has(constructionKey(fabric)),
      gsmGreaterThan: String(limits.get(constructionKey(fabric)) || '')
        .trim()
        .replace(/^>\s*/, ''),
    }))
    .filter((rule) => rule.blocked || rule.gsmGreaterThan);
  const invalid = rules.find((rule) => {
    if (!rule.gsmGreaterThan) return false;
    const limit: number | null = fabricQuantity(rule.gsmGreaterThan);
    return limit === null || limit < 0;
  });
  if (invalid) {
    state.error = 'Enter a valid non-negative GSM limit for ' + invalid.fabric + ', or leave it blank for no GSM restriction.';
    notify();
    return;
  }
  const row: Row = {
    ...draft[rowIndex],
    notPossibleFabricRules: rules,
    notPossibleFabric: rules.filter((rule) => rule.blocked).map((rule) => rule.fabric),
    notPossibleGsm: '',
  };
  // An old unscoped value cannot be mapped before any fabric catalog exists.
  // Retain its source until an upload supplies fabric names for this picker.
  if (!choices.length) row.notPossibleGsm = draft[rowIndex].notPossibleGsm || '';
  draft[rowIndex] = row;
  S.setupDirty = true;
  renderMachineSetup();
  closeFabricPicker();
}

/** Old #fabricPickerSearch input listener. */
export function changeFabricPickerSearch(value: string): void {
  const state = picker();
  if (!state) return;
  state.search = value;
  renderFabricPickerChoices();
}

/** Old #fabricPickerChoices change listener (a fabric checkbox). */
export function changeFabricPickerChoice(value: string, checked: boolean): void {
  const state = picker();
  if (!state) return;
  const key = constructionKey(value);
  if (checked) state.selected.set(key, value);
  else state.selected.delete(key);
  state.error = '';
  updateFabricPickerCount();
}

/** Old #fabricPickerChoices input listener (a fabric's GSM limit). */
export function changeFabricPickerLimit(value: string, limit: string): void {
  const state = picker();
  if (!state) return;
  state.limits.set(constructionKey(value), limit);
  state.error = '';
  updateFabricPickerCount();
}

/** Old #fabricPickerSelectAll change listener. */
export function changeFabricPickerSelectAll(checked: boolean): void {
  const state = picker();
  if (!state) return;
  for (const value of visibleFabricPickerChoices()) {
    const key = constructionKey(value);
    if (checked) state.selected.set(key, value);
    else state.selected.delete(key);
  }
  renderFabricPickerChoices();
}

/* ============================================================
   Unit Setup (old lines 5547-5582)
   ============================================================ */

/** What the old renderUnitSetup wrote: the rows matching the search box (S.ui.setupUnitSearch), the status line
    and whether the selects are locked (each select's options come from core's unitSetupOptions(row.value)). */
export function unitSetupTableView(): { rows: { key: string; buyer: string; value: string }[]; status: string; locked: boolean } {
  const query = unitBuyerKey(String(S.ui.setupUnitSearch ?? '')),
    list: { key: string; buyer: string }[] = unitSetupBuyerList(),
    locked = S.mutationBusy || !S.storageReady || !BatchApi.has('menus.dataManagement.unitSetup');
  const rows = list
    .filter((row) => !query || unitBuyerKey(row.buyer + ' ' + unitSetupValue(row.key)).includes(query))
    .map((row) => ({ key: row.key, buyer: row.buyer, value: String(unitSetupValue(row.key) ?? '') }));
  const status =
    list.length +
    ' buyers · ' +
    list.filter((row) => unitSetupValue(row.key)).length +
    ' with a default unit' +
    (S.unitSetupDraft?.size ? ' · Unsaved changes' : ' · Saved');
  return { rows, status, locked };
}

export function renderUnitSetup(): void {
  notify();
}

/** Old #unitSetupSearch input listener. */
export function changeUnitSetupSearch(value: string): void {
  S.ui.setupUnitSearch = value;
  renderUnitSetup();
}

export function changeUnitSetupDefault(key: string, unit: string): void {
  if (!S.unitSetupDraft) S.unitSetupDraft = new Map();
  if (unit === unitForBuyer(key)) S.unitSetupDraft.delete(key);
  else S.unitSetupDraft.set(key, unit);
  renderUnitSetup();
}

export async function saveUnitSetup(): Promise<boolean> {
  if (!canChangeData()) return false;
  if (!S.unitSetupDraft?.size) {
    toast('No Unit Setup changes to save.');
    return false;
  }
  const names = new Map<string, string>(unitSetupBuyerList().map((row: { key: string; buyer: string }) => [row.key, row.buyer]));
  let rows: Row[] = copyReportData(getUnitSetup());
  for (const [key, unit] of S.unitSetupDraft) {
    const index = rows.findIndex((row) => unitBuyerKey(row.buyer) === key);
    if (!unit) {
      rows = rows.filter((row) => unitBuyerKey(row.buyer) !== key);
      continue;
    }
    if (index < 0) {
      rows.push({ id: 'unit_' + Date.now() + '_' + Math.random().toString(36).slice(2), buyer: names.get(key) || key, unit, hidden: false });
      continue;
    }
    rows[index] = { ...rows[index], unit, hidden: false };
    rows = rows.filter((row, position) => position === index || unitBuyerKey(row.buyer) !== key);
  }
  // Plan section 16.3: Unit Setup no longer decides units, so nothing else has to be reloaded after a save.
  setMutationBusy(true);
  try {
    await commitChanges({ unitSetup: rows });
    S.unitSetupDraft = null;
    renderUnitSetup();
    toast('Unit Setup saved.');
    return true;
  } catch (error) {
    showSaveError(error);
    return false;
  } finally {
    setMutationBusy(false);
  }
}
