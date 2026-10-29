/* Batch Plan report actions: the editable Batch Plan report and its dialogs (port of the old
   js/batch/batch-app.js openBatchPlanReport, refreshEditableReport, row editing, General Info edits, Machine
   Selection Evaluation, Tall/Big declaration and OD BP declaration; see docs/batch-module.md).

   The report body is built as data by report-view.ts (old generateBlankBatchPlanHtml) and rendered by
   components/plan/report/ReportBody.tsx; the dialogs are rendered by components/plan/report/ReportDialogs.tsx
   while their context is set (S.machineEvaluationContext, S.tallBigDeclarationContext,
   S.odDeclarationContext). Dialog inputs write into those contexts as the user types, so the old collect*()
   functions only complete what an untouched input would have given.

   UI state of this slice in S.ui (not old globals):
     reportuiView         the report body view (ReportBodyView), rebuilt by every open/refresh
     reportuiScrollReset  counter: #reportContent scrolls to the top (old scrollTop=0 on open)
     reportuiFocus        {selector, seq}: element the components focus after the next render (old .focus())
     reportuiMachineIndex colour shown by the Machine Selection Evaluation dialog
     reportuiTallBigRender / reportuiTallBigTyped  re-creates the Tall/Big inputs on render; remaining kg is
                          shown unformatted after typing, as the old input listener wrote it
     reportuiOd / reportuiOdRender  OD totals and preview columns of the last successful render */
import { GENERAL_INFO_ROWS } from '@/features/batch/constants';
import { S, notify } from '@/features/batch/store/batch-store';
import { getStoredMasterList, setMutationBusy, showSaveError, toast } from './storage';
import type { Row } from '@/features/batch/types';
import { canEditReport, generalInfoValues, getFloorBooking, hasOrderOnFloor, reportSaveHint } from './bookings';
import { colourSelectionKey, isCalculatedBatchField, machineEvaluationKey, productionSum } from './batch-calculation';
import {
  automaticTallBig,
  auxiliarySourceRows,
  bodyTallBigPools,
  collectODColours,
  collectODQuantities,
  copyReportData,
  currentReportBooking,
  deleteReportRow,
  discardReportDraft,
  editedODRows,
  ensureReportDraft,
  isODSemiBleach,
  isTallBigAccessory,
  makeODRows,
  numberODRows,
  odRows,
  odSettings,
  replaceODBodyRows,
  retainSavedReportDraft,
  saveReportRow,
  tallBigComponentPools,
  tallBigEnabled,
  tallBigSettings,
} from './report-model';
import {
  closeBatchPlanPreview,
  closeInternalChangeDialog,
  closeReconfirmRevisionDialog,
  closeTentativeQuestionnaire,
  highlightUnitTabs,
} from './plan-flow';
import { closeDyeableFilters } from './batch-reports';
import { generateBlankBatchPlanHtml, rowEditingFields } from './report-view';

export * from './report-view';

/* ---------- focus requests (the old code called element.focus(); the components do it after rendering) ---------- */
let focusSeq = 0;

/** Asks the report components to focus the first element matching `selector` after the next render. */
export function requestReportFocus(selector: string): void {
  S.ui.reportuiFocus = { selector, seq: ++focusSeq };
  notify();
}

/* ---------- open / refresh the report ---------- */
function openReport(number: string, keepMachinePopup: boolean, reviewLatest: boolean | null, resetScroll: boolean): void {
  const focus = S.ui.reportuiFocus;
  closeTallBigDeclaration(false);
  closeDyeableFilters(false);
  closeBatchPlanPreview(false);
  closeInternalChangeDialog(false);
  closeReconfirmRevisionDialog(false);
  if (!keepMachinePopup) closeMachineEvaluation();
  closeTentativeQuestionnaire(false);
  // The old report HTML was replaced right after, so a focus asked for by a closed dialog was lost.
  S.ui.reportuiFocus = focus;
  const original = getStoredMasterList().find((b) => b.number === number);
  if (!original || (S.activeFloor && !hasOrderOnFloor(number, S.activeFloor))) {
    notify();
    return;
  }
  const sameReport = S.currentViewingNumber === number && S.currentViewingFloor === S.activeFloor;
  const review = reviewLatest === null ? sameReport && S.currentReportReviewLatest : !!reviewLatest;
  if (!sameReport || review !== S.currentReportReviewLatest) discardReportDraft();
  S.currentViewingNumber = number;
  S.currentViewingFloor = S.activeFloor;
  S.currentReportReviewLatest = review;
  const booking: Row = review ? { ...getFloorBooking(original), fabric: [], batches: [], recipe: [] } : getFloorBooking(original);
  ensureReportDraft(booking, S.activeFloor);
  S.ui.reportuiView = generateBlankBatchPlanHtml(booking, S.activeFloor);
  // The toolbar buttons (Internal change, Move to Pending, Tentative, Confirm / Re-Confirm Latest Plan) and the
  // report view itself are rendered by the plan page from S.currentViewingNumber / S.currentReportReviewLatest.
  highlightUnitTabs('batch'); // the open plan's unit is the active tab, even while a search text is kept for the list
  if (resetScroll) S.ui.reportuiScrollReset = (Number(S.ui.reportuiScrollReset) || 0) + 1;
  setMutationBusy(S.mutationBusy);
}

export function openBatchPlanReport(
  number: string,
  { keepMachinePopup = false, reviewLatest = null }: { keepMachinePopup?: boolean; reviewLatest?: boolean | null } = {}
): void {
  openReport(number, keepMachinePopup, reviewLatest, true);
}

/** Rebuilds the open report (the scroll position stays, as the old code restored it). */
export function refreshEditableReport({ keepMachinePopup = false }: { keepMachinePopup?: boolean } = {}): void {
  if (!S.currentViewingNumber) return;
  openReport(S.currentViewingNumber, keepMachinePopup, null, false);
}

/* ---------- row editing ---------- */
export function startReportRowEdit(kind: string, index: number, isNew = false): void {
  if (!canEditReport() || !S.reportDraft) return;
  if (kind === 'batch' && S.currentReportBatchRowsTruncated) {
    toast('This report shows only part of the generated batches. Batch editing is unavailable until the complete plan fits the report row limit.');
    return;
  }
  if (S.reportRowEditor) {
    toast('Save or cancel the row currently being edited first.');
    return;
  }
  const auxiliary = kind === 'instruction' || kind.startsWith('component:');
  const source: Row | undefined = auxiliary ? auxiliarySourceRows(kind)[index] : kind === 'fabric' ? S.currentFabricRows[index] : S.currentBatchRows[index];
  if (!isNew && !source) return;
  const values: Row = {};
  const fields = rowEditingFields(kind);
  for (const [field] of fields.filter(([name]) => !isCalculatedBatchField(name)))
    values[field] = isNew
      ? ''
      : String(
          field.startsWith('qty:')
            ? (source?.quantities?.[field.slice(4)] ?? '')
            : field.startsWith('weight:')
              ? (source?.weights?.[field.slice(7)] ?? '')
              : (source?.[field] ?? '')
        );
  // The component tables show a Weight /Pcs input under every size (old value: the row's weight). The old
  // Save Row read every input of the edited row, so the editor holds those values from the start.
  if (kind.startsWith('component:'))
    for (const [field] of fields)
      if (field.startsWith('qty:')) {
        const weightField = 'weight:' + field.slice(4);
        if (values[weightField] === undefined) values[weightField] = isNew ? '' : String(source?.weights?.[field.slice(4)] ?? '');
      }
  if (isNew && kind === 'instruction') values.serial = String(auxiliarySourceRows(kind).length + 1);
  if (isNew && kind === 'batch' && automaticTallBig()) values.tallBig = 'No';
  if (isNew && kind === 'fabric') values.name = 'Fabric ' + (S.currentFabricRows.length + 1);
  S.reportRowEditor = { kind, index, isNew, values, error: '' };
  refreshEditableReport();
  requestReportFocus('#reportContent [data-report-row-editing] input');
}

/** Click on a row button (old delegated listener on [data-report-row-action]). */
export function handleReportRowAction(action: string, kind: string, index?: number | string): void {
  if (action === 'delete') {
    void deleteReportRow(kind, Number(index));
    return;
  }
  if (action === 'edit') startReportRowEdit(kind, Number(index));
  if (action === 'add') startReportRowEdit(kind, kind === 'fabric' ? S.currentFabricRows.length : S.currentBatchRows.length, true);
  if (action === 'save') void saveReportRow();
  if (action === 'cancel') {
    S.reportRowEditor = null;
    refreshEditableReport();
  }
}

/** Input of the edited row (old input listener on [data-row-field]). */
export function setReportRowValue(field: string, value: string): void {
  if (!S.reportRowEditor) return;
  S.reportRowEditor.values[field] = value;
  notify();
}

/* ---------- General Info ---------- */
export function editGeneralInfo(): boolean {
  if (!S.reportDraft || !canEditReport() || S.mutationBusy) return false;
  if (S.reportRowEditor) {
    toast('Save or cancel the current edit first.');
    return false;
  }
  S.reportRowEditor = {
    kind: 'general',
    values: copyReportData(generalInfoValues(getFloorBooking(currentReportBooking() as Row, S.currentViewingFloor), S.currentViewingFloor)),
  };
  refreshEditableReport();
  return true;
}

export async function saveGeneralInfo(): Promise<boolean> {
  if (S.reportRowEditor?.kind !== 'general' || !S.reportDraft || !canEditReport() || S.mutationBusy) return false;
  const before = copyReportData(S.reportDraft),
    editor = copyReportData(S.reportRowEditor),
    values: Row = {};
  // The inputs write S.reportRowEditor.values; each shows String(value ?? '') (old [data-general-field]).
  for (const fields of GENERAL_INFO_ROWS) for (const [key] of fields) values[key] = String(editor.values?.[key] ?? '').trim();
  S.reportDraft.manual.generalInfo = values;
  S.reportDraft.dirty = true;
  setMutationBusy(true);
  try {
    await retainSavedReportDraft();
    S.reportRowEditor = null;
    refreshEditableReport();
    toast('General Info saved. ' + reportSaveHint());
    return true;
  } catch (error) {
    S.reportDraft = before;
    S.reportRowEditor = editor;
    showSaveError(error);
    return false;
  } finally {
    setMutationBusy(false);
  }
}

/** Click on a General Info button (old listener on [data-general-action]). */
export function handleGeneralInfoAction(action: string): void {
  if (action === 'edit') editGeneralInfo();
  else if (action === 'save') void saveGeneralInfo();
  else {
    S.reportRowEditor = null;
    refreshEditableReport();
  }
}

/** Input of a General Info field (old input listener on [data-general-field]). */
export function setGeneralInfoValue(key: string, value: string): void {
  if (S.reportRowEditor?.kind !== 'general') return;
  S.reportRowEditor.values[key] = value;
  notify();
}

/* ---------- Machine Selection Evaluation dialog ---------- */
export function refreshMachineEvaluationPopup(shadeKey: string): void {
  const context = S.machineEvaluationContext;
  if (!context) return;
  const index = Math.max(
    0,
    S.currentReportMachineEvaluations.findIndex((group) => machineEvaluationKey(group) === shadeKey)
  );
  const group = S.currentReportMachineEvaluations[index];
  if (!group) {
    closeMachineEvaluation();
    return;
  }
  context.shadeKey = machineEvaluationKey(group);
  S.ui.reportuiMachineIndex = index;
  notify();
}

export function openMachineEvaluation(): void {
  if (S.reportRowEditor) {
    toast('Save or cancel the edited row first.');
    return;
  }
  if (!S.currentViewingNumber || !S.currentViewingFloor || !S.currentReportMachineEvaluations.length) return;
  S.machineEvaluationContext = {
    number: S.currentViewingNumber,
    floor: S.currentViewingFloor,
    shadeKey: machineEvaluationKey(S.currentReportMachineEvaluations[0]),
    status: '',
  };
  refreshMachineEvaluationPopup(S.machineEvaluationContext.shadeKey);
  if (S.machineEvaluationContext) requestReportFocus('#machineEvaluationColour');
}

export function closeMachineEvaluation(): void {
  const open = !!S.machineEvaluationContext;
  S.machineEvaluationContext = null;
  if (open) requestReportFocus('#btnMachineEvaluation');
  else notify();
}

/** Colour select of the dialog (old change listener on #machineEvaluationColour). */
export function selectMachineEvaluationColour(value: string): void {
  const index = Number(value);
  const group = S.currentReportMachineEvaluations[index];
  if (!S.machineEvaluationContext || !group) return;
  S.machineEvaluationContext.shadeKey = machineEvaluationKey(group);
  S.machineEvaluationContext.status = '';
  S.ui.reportuiMachineIndex = index;
  notify();
}

/* ---------- Tall/Big declaration dialog ---------- */
export function openBodyTallBigDeclaration(): boolean {
  if (!S.reportDraft || !canEditReport()) return false;
  if (S.reportRowEditor) {
    toast('Save or cancel the edited row first.');
    return false;
  }
  const pools: Row[] = bodyTallBigPools(S.currentBatchRows, S.currentFabricRows);
  if (!pools.length) {
    toast('No main fabric quantities are available to declare.');
    return false;
  }
  const colours = new Map<string, string>(pools.map((pool) => [pool.colourKey, pool.shade])),
    quantities: Row = copyReportData(tallBigSettings().bodyDeclarations?.colours || {});
  for (const [key] of colours) {
    quantities[key] ||= { complete: true, fabrics: {} };
    for (const pool of pools.filter((value) => value.colourKey === key)) {
      quantities[key].fabrics[pool.fabricKey] ||= { Tall: { kg: 0 }, Big: { kg: 0 } };
    }
  }
  closeMachineEvaluation();
  closeTentativeQuestionnaire(false);
  S.tallBigDeclarationContext = {
    number: S.currentViewingNumber,
    floor: S.currentViewingFloor,
    draft: S.reportDraft,
    kind: 'body',
    pools,
    colours: Array.from(colours, ([key, shade]) => ({ key, shade })),
    quantities,
    colourKey: Array.from(colours.keys())[0],
    step: 'Tall',
    reviewed: {},
    bodyRows: copyReportData(S.currentBatchRows),
    error: '',
  };
  renderTallBigDeclaration();
  requestReportFocus('#tallBigDeclarationColour');
  return true;
}

export function renderBodyTallBigDeclaration(): void {
  const context = S.tallBigDeclarationContext;
  if (!context) return;
  context.reviewed[context.colourKey] ||= {};
  context.reviewed[context.colourKey][context.step] = true;
  S.ui.reportuiTallBigRender = (Number(S.ui.reportuiTallBigRender) || 0) + 1;
  notify();
}

export function openTallBigDeclaration(kind: string): boolean {
  if (kind === 'body') return openBodyTallBigDeclaration();
  if (!S.reportDraft || !canEditReport()) return false;
  if (S.reportRowEditor) {
    toast('Save or cancel the row being edited first.');
    refreshEditableReport();
    return false;
  }
  if (!tallBigEnabled()) {
    toast('Enable Tall/Big size and select Tall or Big for a batch in Colour & Batch Info first.');
    refreshEditableReport();
    return false;
  }
  const section = S.currentComponentSections.find((value) => value.kind === kind);
  if (!section) return false;
  // Old: tallBigComponentPools(section.rows).map(({rows,...pool})=>pool)
  const pools: Row[] = copyReportData(
    section.tallBigPools ||
      (tallBigComponentPools(section.rows) as Row[]).map((value) => {
        const pool = { ...value };
        delete pool.rows;
        return pool;
      })
  );
  const colours = new Map<string, string>();
  for (const row of S.currentBatchRows)
    if (['Tall', 'Big'].includes(row.tallBig) && pools.some((pool) => pool.colourKey === colourSelectionKey(row.shade)))
      colours.set(colourSelectionKey(row.shade), row.shade);
  if (!colours.size) {
    toast('Select Tall or Big for a matching colour in Colour & Batch Info first.');
    refreshEditableReport();
    return false;
  }
  closeMachineEvaluation();
  closeTentativeQuestionnaire(false);
  const saved = tallBigSettings().declarations?.[kind],
    quantities: Row = copyReportData(saved?.colours || {});
  for (const [colourKey] of colours) {
    if (!quantities[colourKey]) quantities[colourKey] = { complete: true, fabrics: {} };
    quantities[colourKey].complete = true;
    quantities[colourKey].fabrics ||= {};
    for (const pool of pools.filter((value) => value.colourKey === colourKey)) {
      const fabric = (quantities[colourKey].fabrics[pool.fabricKey] ||= { Tall: {}, Big: {} });
      for (const type of ['Tall', 'Big']) {
        fabric[type] ||= {};
        const hasBatch = S.currentBatchRows.some((row) => colourSelectionKey(row.shade) === colourKey && row.tallBig === type);
        for (const size of Object.keys(pool.quantities)) if (!hasBatch || fabric[type][size] === undefined) fabric[type][size] = 0;
      }
    }
  }
  S.tallBigDeclarationContext = {
    number: S.currentViewingNumber,
    floor: S.currentViewingFloor,
    draft: S.reportDraft,
    kind,
    title: section.title,
    pools,
    colours: Array.from(colours, ([key, shade]) => ({ key, shade })),
    quantities,
    colourKey: Array.from(colours.keys())[0],
    step: 'Tall',
    reviewed: {},
    bodyRows: copyReportData(S.currentBatchRows),
    // Old: document.activeElement, never read (closing focuses the section's Tall/Big select).
    returnFocus: null,
    error: '',
  };
  renderTallBigDeclaration();
  requestReportFocus('#tallBigDeclarationColour');
  return true;
}

export function closeTallBigDeclaration(restoreFocus = true): void {
  const context = S.tallBigDeclarationContext;
  S.tallBigDeclarationContext = null;
  if (context && restoreFocus) {
    refreshEditableReport();
    requestReportFocus(`[data-component-tall-big="${context.kind}"]`);
  } else notify();
}

/** The dialog inputs write their value into the context as the user types. This completes the inputs the user
    did not touch, as the old read of every #tallBigDeclarationRows input did (they showed `value ?? 0`). */
export function collectTallBigDeclarationInputs(): void {
  const context = S.tallBigDeclarationContext;
  if (!context) return;
  (context.pools as Row[]).forEach((pool) => {
    if (pool.colourKey !== context.colourKey) return;
    const fabric = context.quantities[pool.colourKey].fabrics[pool.fabricKey],
      declared = (fabric[context.step] ||= {});
    const sizes = context.kind === 'body' ? ['kg'] : Object.keys(pool.quantities);
    for (const size of sizes) {
      const value = declared[size];
      if (typeof value === 'number') continue;
      const shown = String(value ?? 0);
      declared[size] = shown.trim() === '' ? 0 : Number(shown);
    }
  });
}

export function renderTallBigDeclaration(): void {
  const context = S.tallBigDeclarationContext;
  if (!context) return;
  if (context.kind === 'body') {
    renderBodyTallBigDeclaration();
    return;
  }
  context.reviewed[context.colourKey] ||= {};
  context.reviewed[context.colourKey][context.step] = true;
  S.ui.reportuiTallBigRender = (Number(S.ui.reportuiTallBigRender) || 0) + 1;
  notify();
}

/** Colour select of the dialog (old change listener on #tallBigDeclarationColour). */
export function changeTallBigDeclarationColour(value: string): void {
  collectTallBigDeclarationInputs();
  const context = S.tallBigDeclarationContext;
  if (!context) return;
  context.colourKey = value;
  context.error = '';
  renderTallBigDeclaration();
}

/** Input of a declared quantity (old input listener on #tallBigDeclarationRows). */
export function inputTallBigDeclaration(poolIndex: number, size: string, value: string): void {
  const context = S.tallBigDeclarationContext;
  if (!context) return;
  const pool = context.pools[poolIndex],
    fabric = context.quantities[pool.colourKey].fabrics[pool.fabricKey];
  (fabric[context.step] ||= {})[size] = String(value).trim() === '' ? 0 : Number(value);
  collectTallBigDeclarationInputs();
  S.ui.reportuiTallBigTyped = S.ui.reportuiTallBigRender;
  notify();
}

/** ← Tall button (old click listener on #btnTallBigPrevious). */
export function previousTallBigDeclaration(): void {
  collectTallBigDeclarationInputs();
  const context = S.tallBigDeclarationContext;
  if (!context) return;
  context.step = 'Tall';
  context.error = '';
  renderTallBigDeclaration();
}

/* ---------- OD BP declaration dialog ---------- */
export function closeODDeclaration(): void {
  S.odDeclarationContext = null;
  notify();
}

export function odContextValid(context: Row | null | undefined): boolean {
  return (
    !!context &&
    context.draft === S.reportDraft &&
    context.number === S.currentViewingNumber &&
    context.floor === S.currentViewingFloor &&
    canEditReport()
  );
}

export function openODDeclaration(kind: string): boolean {
  if (!S.reportDraft || !canEditReport() || S.mutationBusy) return false;
  if (S.reportRowEditor) {
    toast('Save or cancel the edited row first.');
    return false;
  }
  const rows: Row[] = copyReportData(odRows(kind));
  if (!rows.some((row) => isODSemiBleach(row.shade))) return false;
  const old: Row = odSettings(kind),
    base = copyReportData(old.mode === 'Need Declaration' && old.baseRows ? old.baseRows : rows.filter((row) => isODSemiBleach(row.shade)));
  const context: Row = {
    kind,
    number: S.currentViewingNumber,
    floor: S.currentViewingFloor,
    draft: S.reportDraft,
    baseRows: base,
    rows,
    count: old.count || 1,
    colours: copyReportData(old.colours || []),
    quantityEdits: {},
    preview: [],
    error: '',
  };
  S.odDeclarationContext = context;
  for (const row of rows)
    if (isODSemiBleach(row.shade) && Number.isInteger(row.odBatchIndex)) {
      context.colours[row.odBatchIndex] = row.odColour || '';
      if (kind === 'body' && old.mode === 'Need Declaration') context.quantityEdits[row.rowKey] = copyReportData(row.quantities);
    }
  S.ui.reportuiOd = null;
  renderODDeclaration();
  requestReportFocus('#odBatchCount');
  return true;
}

/** Recomputes the OD preview from the context (the No of batch select writes context.count). */
export function renderODDeclaration(): void {
  const context = S.odDeclarationContext;
  if (!context) return;
  let rows: Row[];
  try {
    rows = makeODRows(context);
    context.error = '';
  } catch (error) {
    context.error = errorMessage(error);
    context.preview = [];
    // The old preview was emptied and OK disabled; the totals above kept what they showed (none yet when the
    // first render of this dialog fails).
    S.ui.reportuiOd = { ...(S.ui.reportuiOd || {}), ok: false };
    notify();
    return;
  }
  const others = (context.rows as Row[]).filter((row) => !isODSemiBleach(row.shade));
  if (context.kind === 'body') numberODRows(rows, 'body', others);
  else numberODRows(rows, context.kind, others);
  context.preview = rows;
  const fields: { key: string; label: string; unit: string }[] =
    context.kind === 'body'
      ? S.currentFabricRows.filter((f) => !isTallBigAccessory(f) && !f.componentKind).map((f) => ({ key: f.key, label: f.name, unit: 'kg' }))
      : ((S.currentComponentSections.find((s) => s.kind === context.kind)?.sizes || []) as Row[]).map((size) => ({ key: size.key, label: size.label, unit: 'pcs' }));
  const totals = fields.map((field) => productionSum((context.baseRows as Row[]).map((row) => row.quantities?.[field.key] || 0)));
  S.ui.reportuiOd = { ok: true, kind: context.kind, fields, totals };
  S.ui.reportuiOdRender = (Number(S.ui.reportuiOdRender) || 0) + 1;
  notify();
}

/** The OD Colour inputs show String(colours[index] || '') and the old save read them all back. */
function syncODColourInputs(): void {
  const context = S.odDeclarationContext;
  if (!context) return;
  for (const row of context.preview as Row[]) context.colours[row.odBatchIndex] = String(context.colours[row.odBatchIndex] || '');
}

export async function saveODDeclaration(): Promise<boolean> {
  const context = S.odDeclarationContext;
  if (!odContextValid(context) || S.mutationBusy || !context) {
    closeODDeclaration();
    return false;
  }
  syncODColourInputs();
  collectODColours();
  collectODQuantities();
  const count = Number(context.count);
  if (!Number.isInteger(count) || count < 1 || count > 20) return false;
  context.count = count;
  const before = copyReportData(S.reportDraft);
  setMutationBusy(true);
  try {
    const draft = S.reportDraft as Row;
    const semi: Row[] = editedODRows(context);
    draft.manual.odBP ||= {};
    draft.manual.odBP[context.kind] = { mode: 'Need Declaration', count, colours: copyReportData(context.colours), baseRows: copyReportData(context.baseRows) };
    if (context.kind === 'body') replaceODBodyRows(semi);
    else {
      const others = copyReportData((odRows(context.kind) as Row[]).filter((row) => !isODSemiBleach(row.shade)));
      numberODRows(semi, context.kind, others);
      draft.manual.componentRows = { ...(draft.manual.componentRows || {}), [context.kind]: [...semi, ...others] };
    }
    draft.dirty = true;
    await retainSavedReportDraft();
    closeODDeclaration();
    refreshEditableReport();
    toast('OD BP batches saved.');
    return true;
  } catch (error) {
    S.reportDraft = before;
    context.draft = S.reportDraft;
    context.error = errorMessage(error);
    notify();
    return false;
  } finally {
    setMutationBusy(false);
  }
}

/** No of batch select (old change listener on #odBatchCount). */
export function changeODBatchCount(value: string): void {
  syncODColourInputs();
  collectODColours();
  const context = S.odDeclarationContext;
  if (context) {
    context.quantityEdits = {};
    context.count = Number(value) || context.count;
  }
  renderODDeclaration();
}

/** Input of an OD Colour (every input of that batch shows the same value). */
export function inputODColour(odBatchIndex: number, value: string): void {
  const context = S.odDeclarationContext;
  if (!context) return;
  context.colours[odBatchIndex] = value;
  collectODColours();
  notify();
}

/** Input of a batch's fabric kg; `value` is the input text. The input listener cleared the error; the change
    listener (one decimal place written back into the input) did not, so it passes clearError = false. */
export function inputODQuantity(previewIndex: number, fabricKey: string, value: string, clearError = true): void {
  const context = S.odDeclarationContext;
  if (!context) return;
  const row = context.preview[previewIndex];
  if (row && context.kind === 'body') {
    context.quantityEdits[row.rowKey] ||= {};
    context.quantityEdits[row.rowKey][fabricKey] = value;
  }
  collectODQuantities();
  if (clearError) context.error = '';
  notify();
}

function errorMessage(error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message;
  return message === undefined || message === null ? '' : String(message);
}
