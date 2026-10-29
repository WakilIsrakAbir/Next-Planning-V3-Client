/* Batch Plan report model: the editable report draft, manual edits and dyeing modes (ported from the old js/batch/batch-app.js).
   The editable Batch Plan report's data: the report draft and its manual edits (fabric, batch, instruction
   and component rows), Dyeing Mode, and writing the draft into the booking's saved floor plan.
   Tall/Big is in report-tall-big.ts, BP rows and components in report-components.ts, OD BP in report-od.ts;
   this file re-exports them, so other slices import everything from './report-model'.

   The rules and the saved plan fields are unchanged (the old page reads the same records). The old
   top-level variables are `S.<name>` (store/batch-store.ts). No DOM here: the editing row's inputs keep
   `S.reportRowEditor.values` up to date, and the screen re-renders after notify() / refreshEditableReport(). */
import { BATCH_CALCULATION } from '@/features/batch/constants';
import { S, notify } from '@/features/batch/store/batch-store';
import { currentUsername, getStoredMasterList, saveMasterList, setMutationBusy, showSaveError, toast } from './storage';
import {
  GenericMachineSelection,
  addDyeingGroupQuantity,
  availableComponentKinds,
  batchMass,
  bodyBatchQuantity,
  colourSelectionKey,
  componentColourSummary,
  componentMassIndex,
  createDyeingBatches,
  dyeingBatchGroupKey,
  erpMachineConfigurations,
  evaluateCombinedMachines,
  extractDeduplicatedFabrics,
  fabricPeachForColour,
  fabricQuantity,
  firstUploadedValue,
  generateColourBatches,
  getFlatAllowance,
  getMachineSetup,
  hasPeachFinish,
  isCalculatedBatchField,
  machineAllowsFabrics,
  machineEvaluationKey,
  machineFabricsWithComponents,
  machineFloorsForMenu,
  machineNozzles,
  orderDyeingModeBatches,
  productionSum,
  rowFabricKey,
} from './batch-calculation';
import {
  canEditReport,
  captureConfirmedReport,
  confirmGeneralInfoError,
  confirmedReportLocked,
  frozenConfirmedReport,
  getFloorBooking,
  getKnittingRows,
  getReportKnittingRows,
  normalizeBookingKey,
  normalizeFloor,
  reportSaveHint,
} from './bookings';
import { closeODDeclaration, closeTallBigDeclaration, refreshEditableReport } from './report-actions';
import {
  automaticTallBig,
  preserveTallBigBatchEdits,
  syncBodyTallBigQuantities,
  syncTallBigManualComponentRows,
  tallBigEnabled,
  tallBigSaveError,
  tallBigSettings,
} from './report-tall-big';
import { bpValue, buildComponentBatches, componentKinds, componentSize, getBpRows, getReportBpRows } from './report-components';
import { odColumn } from './report-od';
import type { Row } from '@/features/batch/types';

export * from './report-tall-big';
export * from './report-components';
export * from './report-od';

type Floor = string | null;

/* ---------- Manual report drafts ----------
   Pending edits stay in memory until the booking is saved as Tentative/Confirm. Saved bookings retain
   their approved snapshots. */
export function copyReportData<T>(value: T): T {
  return structuredClone(value);
}
export function savedReportPlan(booking: Row, floor: Floor | undefined): Row {
  return floor ? booking.floorPlans?.[floor] || {} : booking;
}
export function reportBookingStatus(booking: Row, floor: Floor | undefined): string {
  return savedReportPlan(booking, floor).status || booking.status || 'Pending';
}
export function emptyReportManual(): Row {
  return {
    generalInfo: {},
    odBP: {},
    machineSelections: {},
    fabricRows: null,
    batchRows: null,
    componentTypes: {},
    componentSeparate: {},
    fabricSeparate: {},
    componentRows: {},
    tallBig: { enabled: false, declarations: {} },
    instructions: null,
  };
}
export function reportManualState(booking: Row, floor: Floor): Row {
  const draft = S.reportDraft;
  if (draft?.number === booking.number && (draft as Row).floor === floor) return (draft as Row).manual;
  if (!['Tentative', 'Confirm'].includes(reportBookingStatus(booking, floor))) return emptyReportManual();
  const plan = savedReportPlan(booking, floor);
  return {
    generalInfo: plan.reportOverrides?.generalInfo || {},
    odBP: plan.reportOverrides?.odBP || {},
    machineSelections: plan.machineSelections || {},
    fabricRows: plan.reportOverrides?.fabricRows || null,
    batchRows: plan.reportOverrides?.batchRows || null,
    componentTypes: plan.componentDyeingTypes || {},
    componentSeparate: plan.componentSeparate || {},
    fabricSeparate: plan.fabricDyeingSeparate || {},
    componentRows: plan.reportOverrides?.componentRows || {},
    tallBig: plan.tallBigSettings || { enabled: false, declarations: {} },
    instructions: plan.reportOverrides?.instructions ?? null,
  };
}
export function ensureReportDraft(booking: Row, floor: Floor): void {
  const draft = S.reportDraft;
  if (draft?.number === booking.number && (draft as Row).floor === floor && (draft as Row).reviewLatest === S.currentReportReviewLatest) return;
  const manual = copyReportData(S.currentReportReviewLatest ? emptyReportManual() : reportManualState(booking, floor));
  S.reportDraft = {
    number: booking.number,
    floor,
    manual,
    dirty: false,
    reviewLatest: S.currentReportReviewLatest,
    reviewSourceRows: S.currentReportReviewLatest ? copyReportData(getKnittingRows(booking.number, floor)) : null,
    reviewBpRows: S.currentReportReviewLatest ? copyReportData(getBpRows(booking.number, floor)) : null,
  };
  S.reportRowEditor = null;
}
export function discardReportDraft(): void {
  closeTallBigDeclaration(false);
  closeODDeclaration();
  S.currentReportReviewLatest = false;
  S.reportDraft = null;
  S.reportRowEditor = null;
  S.currentFabricRows = [];
  S.currentBatchRows = [];
  S.currentReportBatchRowsTruncated = false;
  notify();
}
export function currentReportBooking(): Row | undefined {
  return S.confirmedCaptureContext?.booking || getStoredMasterList().find((booking) => booking.number === S.currentViewingNumber);
}
export function reportFabricSlots(fabrics: Row[] = S.currentFabricRows): Row[] {
  return fabrics.map((fabric, index) => ({ ...fabric, name: 'Fabric ' + (index + 1) }));
}
export function autoBatchRow(batch: Row, fabrics: Row[]): Row {
  return {
    rowKey: 'auto:' + batch.id,
    id: batch.id,
    shade: batch.shade,
    ld: batch.ld,
    reference: batch.reference,
    dyeingGroup: batch.dyeingGroup,
    peachFinish: batch.peachFinish,
    componentAnchor: batch.componentAnchor,
    selectionKey: batch.selectionKey,
    quantities: Object.fromEntries(fabrics.map((fabric, index) => [fabric.key, batch.quantities[index] || 0])),
    loading: batch.loading,
    nozzle: String(batch.nozzle ?? ''),
    machineLabel: batch.machine?.label || '',
    machineId: batch.machine?.id ?? null,
    manual: false,
    manualNumber: false,
  };
}
export function usedColourFabrics(rows: Row[], fabrics: Row[], shade: unknown): Row[] {
  const key = colourSelectionKey(shade),
    slots = reportFabricSlots(fabrics);
  return slots.filter((fabric) => rows.some((row) => colourSelectionKey(row.shade) === key && (fabricQuantity(row.quantities?.[fabric.key]) || 0) > 0));
}
export function findReportRowMachine(row: Row, floor: Floor): Row | null {
  const label = String(row.machineLabel || '').trim();
  if (!label) return null;
  const candidates: Row[] = getMachineSetup().filter(
    (machine: Row) =>
      machineFloorsForMenu(floor).includes(normalizeFloor(machine.floor) as string) &&
      String(machine.mcType).trim().toUpperCase() === 'BULK' &&
      (String(machine.mcBrand ?? '').trim() + '-' + String(machine.mcNo ?? '').trim()).toLowerCase() === label.toLowerCase()
  );
  return candidates.find((machine) => String(machine.id) === String(row.machineId)) || (candidates.length === 1 ? candidates[0] : null);
}

type AssignmentContext = { massIndex: ReturnType<typeof componentMassIndex>; used: Map<string, Row[]> };

export function reportBatchAssignmentError(row: Row, rows: Row[], fabrics: Row[], floor: Floor, context: AssignmentContext | null = null): string {
  if (!String(row.machineLabel || '').trim()) return '';
  const machine = findReportRowMachine(row, floor);
  if (!machine) return 'Choose a unique Bulk machine from this floor’s Machine Selection Evaluation.';
  if (machine.available === false || machine.eligible === false) return 'This machine is unavailable for production.';
  const used: Row[] =
    context?.used.get(String(row.id)) ||
    machineFabricsWithComponents(
      usedColourFabrics([row], fabrics, row.shade).filter((fabric) => !fabric.componentKind),
      currentReportBooking()!,
      floor,
      row.shade,
      rows,
      [row]
    );
  if (used.some((fabric) => !String(fabric.type).trim())) return 'Complete Fabric Info for every used fabric before assigning a machine.';
  if (!machineAllowsFabrics(machine, used)) return 'This machine is restricted for this colour’s fabric or GSM in Setup.';
  const mass: Row = batchMass(row, context?.massIndex || buildComponentBatches(currentReportBooking(), floor, rows));
  if (mass.totalKg === null) return 'Supply BP Data Weight /Pcs for all together components before assigning a machine.';
  const quantity = mass.totalKg;
  if (!(quantity > 0)) return 'Enter a positive fabric quantity before assigning a machine.';
  const config: Row | undefined = erpMachineConfigurations(row.shade, floor, used).find((value: Row) => String(value.id) === String(machine.id));
  if (!config) return 'This machine is not in the permitted floor pool.';
  try {
    const evaluated = GenericMachineSelection.selectMachine({
      totalQuantityKg: quantity,
      machines: [config],
      maximumLoadingPercent: BATCH_CALCULATION.defaultMaximumLoadingPercent,
    });
    if (evaluated.selected.batches !== 1) return 'This row exceeds the machine’s permitted loading. Reduce its quantities or use Load MC to split the colour.';
    row.loading = String(Number(((quantity / config.capacityKg) * 100).toFixed(2))) + '%';
    row.nozzle = String(machineNozzles(config.capacityKg));
  } catch (error) {
    if (!(error instanceof GenericMachineSelection.MachineSelectionError)) throw error;
    return error.evaluations[0]?.remarks || error.message;
  }
  return '';
}
export function sanitizeReportAssignments(rows: Row[], fabrics: Row[], floor: Floor): { rows: Row[]; warnings: string[] } {
  const safe = copyReportData(rows),
    warnings: string[] = [];
  const sections = buildComponentBatches(currentReportBooking(), floor, safe),
    used = new Map<string, Set<Row>>(),
    byKey = new Map<unknown, Row>(fabrics.map((fabric) => [fabric.key, fabric]));
  for (const row of safe) {
    const key = String(row.id);
    if (!used.has(key)) used.set(key, new Set());
    for (const [fabricKey, qty] of Object.entries(row.quantities || {}))
      if ((qty as number) > 0 && byKey.has(fabricKey) && !byKey.get(fabricKey)!.componentKind) used.get(key)!.add(byKey.get(fabricKey)!);
  }
  for (const section of sections)
    for (const row of section.rows) {
      const key = String(row.id);
      if (!row.separate && used.has(key) && row.totalPcs > 0) used.get(key)!.add({ type: row.fabricType, gsm: '', componentKind: section.kind });
    }
  const context: AssignmentContext = {
    massIndex: componentMassIndex(sections),
    used: new Map(Array.from(used, ([key, items]) => [key, Array.from(items)] as [string, Row[]])),
  };
  for (const row of safe) {
    const error = reportBatchAssignmentError(row, safe, fabrics, floor, context);
    if (!error) {
      row.assignmentError = '';
      continue;
    }
    warnings.push((row.id || row.shade || 'Batch') + ': ' + error + ' Machine assignment cleared.');
    row.machineLabel = '';
    row.machineId = null;
    row.loading = '';
    row.nozzle = '';
    row.assignmentError = error;
  }
  return { rows: safe, warnings };
}
export function evaluateManualBatchRows(rows: Row[], fabrics: Row[], booking: Row, floor: Floor): Row[] {
  const colours = new Map<string, Row>(),
    result: Row[] = [];
  for (const row of rows) {
    if (!String(row.shade || '').trim()) continue;
    const key = row.selectionKey || (row.dyeingGroup ? dyeingBatchGroupKey(row.shade, row.dyeingGroup) : colourSelectionKey(row.shade));
    if (!colours.has(key))
      colours.set(key, {
        shade: row.shade,
        dyeingGroup: row.dyeingGroup,
        componentAnchor: row.componentAnchor,
        selectionKey: key,
        groupLabel:
          (automaticTallBig(booking, floor) ? (row.tallBig === 'No' ? 'Regular' : row.tallBig) + ' · ' : '') +
          (row.dyeingGroup === 'peach' ? 'Peach' : row.dyeingGroup?.startsWith('separate:') ? 'Separate fabric' : row.dyeingGroup ? 'Non-peach' : ''),
        rows: [],
        quantities: {},
      });
    const group = colours.get(key)!;
    group.rows.push(row);
    for (const [fabricKey, value] of Object.entries(row.quantities || {}))
      group.quantities[fabricKey] = (group.quantities[fabricKey] || 0) + (fabricQuantity(value) || 0);
  }
  for (const group of colours.values()) {
    const sections = buildComponentBatches(booking, floor, rows),
      massIndex = componentMassIndex(sections),
      masses: Row[] = group.rows.map((row: Row) => batchMass(row, massIndex));
    const total = productionSum(masses.map((mass) => mass.totalKg ?? mass.bodyKg));
    if (!(total > 0) || !floor) continue;
    const used: Row[] = machineFabricsWithComponents(
      usedColourFabrics(group.rows, fabrics, group.shade).filter((fabric) => !fabric.componentKind),
      booking,
      floor,
      group.shade,
      rows,
      group.rows
    );
    const machines: Row[] = erpMachineConfigurations(group.shade, floor, used);
    if (masses.some((mass) => mass.totalKg === null)) machines.forEach((machine) => machine.rejectionReasons.push('BP Data Weight /Pcs is missing for together components.'));
    if (used.some((fabric) => !String(fabric.type).trim())) machines.forEach((machine) => machine.rejectionReasons.push('Fabric Info is missing for a used fabric.'));
    try {
      const evaluated = evaluateCombinedMachines({
        totalQuantityKg: total,
        bodyQuantityKg: productionSum(group.rows.map((row: Row) => bodyBatchQuantity(row, fabrics))),
        machines,
        booking,
        floor,
        shade: group.shade,
        bodyRows: rows,
        dyeingGroup: group.dyeingGroup,
        componentAnchor: group.componentAnchor,
      });
      const assigned: Row[] = group.rows.filter((row: Row) => row.machineLabel);
      const ids = new Set(assigned.map((row) => String(row.machineId)));
      const positive: Row[] = group.rows.filter((row: Row, index: number) => masses[index].totalKg > 0);
      evaluated.evaluations.forEach((row: Row) => {
        row.applied = assigned.length === positive.length && ids.size === 1 && ids.has(String(row.id));
        row.appliedBy = 'manual';
      });
      result.push({ ...group, rows: evaluated.evaluations, error: '', sourceRows: copyReportData(group.rows), totalQuantityKg: total });
    } catch (error) {
      if (!(error instanceof GenericMachineSelection.MachineSelectionError)) throw error;
      result.push({ ...group, rows: error.evaluations, error: error.message, sourceRows: copyReportData(group.rows), totalQuantityKg: total });
    }
  }
  return result;
}
/** Builds the report's fabric and batch rows (manual rows when saved, otherwise the automatic batches) and
    keeps them in S.currentFabricRows / S.currentBatchRows / S.currentReportMachineEvaluations /
    S.currentReportBatchRowsTruncated, as the old function did. */
export function buildEditableReportTables(booking: Row, floor: Floor): { fabrics: Row[]; rows: Row[]; warnings: string[] } {
  const frozen = frozenConfirmedReport(booking, floor);
  if (frozen) {
    S.currentFabricRows = copyReportData(frozen.fabrics);
    S.currentBatchRows = copyReportData(frozen.rows);
    S.currentReportMachineEvaluations = copyReportData(frozen.evaluations || []);
    S.currentReportBatchRowsTruncated = !!frozen.truncated;
    return { fabrics: S.currentFabricRows, rows: S.currentBatchRows, warnings: copyReportData(frozen.warnings || []) };
  }
  const manual = reportManualState(booking, floor);
  const automaticFabrics: Row[] = extractDeduplicatedFabrics(booking.number, booking, floor);
  const fabrics: Row[] = copyReportData(manual.fabricRows || automaticFabrics);
  // Older saved edits gain the new columns from their own source version.
  // Explicit manual values, including blanks, always take precedence.
  if (manual.fabricRows) {
    const sourceByKey = new Map<unknown, Row>(automaticFabrics.map((fabric) => [fabric.key, fabric]));
    for (const fabric of fabrics)
      for (const field of ['composition', 'greigeQty', 'ld', 'reference']) {
        if (fabric[field] === undefined) fabric[field] = sourceByKey.get(fabric.key)?.[field] ?? '';
      }
  }
  S.currentFabricRows = fabrics;
  let rows: Row[],
    warnings: string[] = [],
    evaluations: Row[] = [];
  S.currentReportBatchRowsTruncated = false;
  if (manual.batchRows) {
    const sanitized = sanitizeReportAssignments(manual.batchRows, fabrics, floor);
    rows = sanitized.rows;
    warnings = sanitized.warnings;
    evaluations = evaluateManualBatchRows(rows, fabrics, booking, floor);
  } else {
    const automatic = generateColourBatches(booking, fabrics, floor);
    rows = automatic.batches.map((batch: Row) => autoBatchRow(batch, fabrics));
    warnings = automatic.warnings;
    S.currentReportBatchRowsTruncated = automatic.evaluations.some((group: Row) =>
      group.rows.some((row: Row) => row.applied && row.batches > BATCH_CALCULATION.maxRenderedBatches)
    );
    evaluations = automatic.evaluations.map((group: Row) => {
      const sourceRows = rows.filter((row) => machineEvaluationKey(row) === machineEvaluationKey(group));
      const quantities: Row = {};
      for (const row of sourceRows) for (const [key, qty] of Object.entries(row.quantities)) quantities[key] = (quantities[key] || 0) + qty;
      return { ...group, sourceRows: copyReportData(sourceRows), quantities, totalQuantityKg: group.totalQuantityKg ?? productionSum(Object.values(quantities)) };
    });
    if (!rows.length && booking.batches?.length && booking.status !== 'Pending')
      rows = booking.batches.map((batch: Row, index: number) => ({
        rowKey: 'legacy:' + index,
        id: batch.id,
        shade: batch.shade,
        ld: batch.ld,
        reference: batch.reference || '',
        quantities: Object.fromEntries(reportFabricSlots(fabrics).map((f, i) => [f.key, fabricQuantity(batch.fabrics?.[i]) || 0])),
        loading: batch.loading || '',
        nozzle: String(batch.nozzle ?? ''),
        machineLabel: batch.machine || '',
        machineId: null,
        manual: false,
        manualNumber: false,
      }));
  }
  if (!manual.batchRows && !getReportKnittingRows(booking.number, floor).length && rows.length) {
    const safe = sanitizeReportAssignments(rows, fabrics, floor);
    rows = safe.rows;
    warnings.push(...safe.warnings);
    evaluations = evaluateManualBatchRows(rows, fabrics, booking, floor);
  }
  S.currentFabricRows = fabrics;
  S.currentBatchRows = rows;
  S.currentReportMachineEvaluations = evaluations;
  const components = buildComponentBatches(booking, floor, rows),
    massIndex = componentMassIndex(components);
  for (const row of rows) Object.assign(row, batchMass(row, massIndex));
  // Source/manual component changes cannot leave an overloaded machine assigned.
  if (!manual.batchRows) {
    const safe = sanitizeReportAssignments(rows, fabrics, floor);
    rows = safe.rows;
    warnings.push(...safe.warnings);
    S.currentBatchRows = rows;
    evaluations.forEach((group) =>
      group.rows.forEach((config: Row) => {
        if (config.applied && !rows.some((row) => machineEvaluationKey(row) === machineEvaluationKey(group) && String(row.machineId) === String(config.id)))
          config.applied = false;
      })
    );
  }
  return { fabrics, rows, warnings };
}

/* ---------- Saving the draft ---------- */
export function writeDraftToBooking(
  master: Row[],
  index: number,
  newStatus?: string | null,
  { internalApproval = false }: { internalApproval?: boolean } = {}
): void {
  const draft = S.reportDraft!;
  const floor = draft.floor,
    old = savedReportPlan(master[index], floor);
  if (confirmedReportLocked(master[index], floor))
    throw new Error('This confirmed plan is read-only until the latest data is reviewed from Need Re-Confirm List');
  if (reportBookingStatus(master[index], floor) === 'Confirm' && draft.dirty && !draft.reviewLatest && !internalApproval)
    throw new Error('Approve staged edits using Internal change before saving this confirmed booking');
  if (newStatus === 'Confirm') {
    const error = confirmGeneralInfoError(master[index], floor);
    if (error) throw new Error(error);
  }
  if (['Tentative', 'Confirm'].includes(newStatus as string)) {
    const error = tallBigSaveError(master[index], floor);
    if (error) throw new Error(error);
  }
  const plan: Row = { ...old, ...(newStatus ? { status: newStatus } : {}) };
  plan.lastSaveAt = new Date().toISOString();
  if (old.confirmedSnapshot && !draft.reviewLatest && (draft.dirty || newStatus !== reportBookingStatus(master[index], floor))) {
    plan.pmcCorrectionAt = plan.lastSaveAt;
    plan.pmcCorrectionBy = currentUsername();
  }
  if (newStatus === 'Pending') {
    delete plan.machineSelections;
    delete plan.reportOverrides;
    delete plan.componentDyeingTypes;
    delete plan.componentSeparate;
    delete plan.fabricDyeingSeparate;
    delete plan.tallBigSettings;
  } else {
    plan.machineSelections = copyReportData(draft.manual.machineSelections);
    plan.componentDyeingTypes = copyReportData(draft.manual.componentTypes || {});
    plan.componentSeparate = copyReportData(draft.manual.componentSeparate || {});
    plan.fabricDyeingSeparate = copyReportData(draft.manual.fabricSeparate || {});
    plan.tallBigSettings = copyReportData(draft.manual.tallBig || { enabled: false, declarations: {} });
    plan.reportOverrides = {
      schemaVersion: 1,
      generalInfo: copyReportData(draft.manual.generalInfo || {}),
      odBP: copyReportData(draft.manual.odBP || {}),
      fabricRows: copyReportData(draft.manual.fabricRows),
      batchRows: copyReportData(draft.manual.batchRows),
      componentRows: copyReportData(draft.manual.componentRows || {}),
      instructions: copyReportData(draft.manual.instructions ?? null),
    };
  }
  if (newStatus === 'Confirm' && !plan.flatAllowanceSnapshot) plan.flatAllowanceSnapshot = copyReportData(getFlatAllowance());
  if (newStatus === 'Confirm' && old.confirmedSnapshot && draft.dirty && !draft.reviewLatest)
    plan.confirmedSnapshot = {
      ...old.confirmedSnapshot,
      reportData: internalApproval && draft.previewReport ? copyReportData(draft.previewReport) : captureConfirmedReport(master[index], floor),
    };
  if (newStatus === 'Confirm' && !plan.batchDate) plan.batchDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  master[index] = floor
    ? { ...master[index], floorPlans: { ...(master[index].floorPlans || {}), [floor]: plan } }
    : { ...master[index], ...plan };
  if (!floor && newStatus === 'Pending') {
    delete master[index].machineSelections;
    delete master[index].reportOverrides;
    delete master[index].componentDyeingTypes;
    delete master[index].componentSeparate;
    delete master[index].fabricDyeingSeparate;
    delete master[index].tallBigSettings;
  }
}
/** Saves the draft into a Tentative booking right away (true when saved); a Confirm booking keeps a preview. */
export async function retainSavedReportDraft(): Promise<boolean> {
  const booking = currentReportBooking();
  if (!booking || !S.reportDraft || S.reportDraft.reviewLatest) return false;
  if (reportBookingStatus(booking, S.reportDraft.floor) === 'Confirm') {
    S.reportDraft.previewReport = captureConfirmedReport(booking, S.reportDraft.floor);
    return false;
  }
  if (reportBookingStatus(booking, S.reportDraft.floor) !== 'Tentative') return false;
  if (tallBigSaveError(booking, S.reportDraft.floor)) return false;
  const activeDraft = S.reportDraft;
  const master = getStoredMasterList().slice(),
    index = master.findIndex((row) => row.number === S.reportDraft!.number);
  if (index < 0) return false;
  writeDraftToBooking(master, index, reportBookingStatus(booking, S.reportDraft.floor));
  await saveMasterList(master);
  if (S.reportDraft === activeDraft) S.reportDraft.dirty = false;
  return true;
}
/** Saves the fabric or batch row being edited. The row's inputs keep S.reportRowEditor.values up to date
    (the old code read them from the editing row's [data-row-field] inputs here). */
export async function saveReportRow(): Promise<boolean> {
  if (!S.reportRowEditor || !S.reportDraft || !canEditReport()) return false;
  if (S.reportRowEditor.kind === 'instruction' || S.reportRowEditor.kind.startsWith('component:')) return saveAuxiliaryReportRow();
  const editor = copyReportData(S.reportRowEditor),
    before = copyReportData(S.reportDraft);
  const rows = copyReportData(editor.kind === 'fabric' ? S.currentFabricRows : S.currentBatchRows);
  const source: Row = editor.isNew ? {} : rows[editor.index];
  let row: Row;
  if (editor.kind === 'fabric') {
    row = {
      ...source,
      ...editor.values,
      key: source.key || 'manual-fabric:' + Date.now() + ':' + Math.random().toString(36).slice(2),
      name: source.name || 'Fabric ' + (S.currentFabricRows.length + 1),
      manual: true,
    };
    if (
      !row.componentKind &&
      String(row.greigeQty || '').trim() &&
      (fabricQuantity(row.greigeQty) === null || (fabricQuantity(row.greigeQty) as number) < 0)
    ) {
      S.reportRowEditor = { ...editor, error: 'Greige Qty must be a non-negative number.' };
      refreshEditableReport();
      return false;
    }
  } else {
    row = {
      ...source,
      quantities: { ...(source.quantities || {}) },
      manual: true,
      rowKey: source.rowKey || 'manual:' + Date.now() + ':' + Math.random().toString(36).slice(2),
    };
    for (const [field, value] of Object.entries(editor.values)) {
      if (field.startsWith('qty:')) {
        const quantity = String(value).trim() === '' ? 0 : fabricQuantity(value);
        if (quantity === null || quantity < 0) {
          S.reportRowEditor.values = editor.values;
          S.reportRowEditor.error = 'Fabric quantities must be non-negative numbers.';
          refreshEditableReport();
          return false;
        }
        row.quantities[field.slice(4)] = quantity;
      } else if (!isCalculatedBatchField(field)) row[field] = value;
    }
    if (!String(row.id || '').trim() || !String(row.shade || '').trim()) {
      S.reportRowEditor.values = editor.values;
      S.reportRowEditor.error = 'Enter a batch number and colour.';
      refreshEditableReport();
      return false;
    }
    const saved = row;
    if (rows.some((other, index) => index !== editor.index && String(other.id).trim() === String(saved.id).trim())) {
      S.reportRowEditor.values = editor.values;
      S.reportRowEditor.error = 'This batch number is already used by another row.';
      refreshEditableReport();
      return false;
    }
    row.manualNumber = editor.isNew || source.manualNumber || row.id !== source.id;
  }
  if (editor.isNew) rows.push(row);
  else rows[editor.index] = row;
  if (editor.kind === 'batch') {
    if (tallBigEnabled() && !['No', 'Tall', 'Big'].includes(row.tallBig)) {
      S.reportRowEditor = { ...editor, error: 'Select No, Tall or Big for this batch.' };
      refreshEditableReport();
      return false;
    }
    const error = reportBatchAssignmentError(row, rows, S.currentFabricRows, S.reportDraft.floor);
    if (error) {
      S.reportRowEditor.values = editor.values;
      S.reportRowEditor.error = error;
      refreshEditableReport();
      return false;
    }
    const machine = findReportRowMachine(row, S.reportDraft.floor);
    row.machineId = machine?.id ?? null;
    preserveTallBigBatchEdits();
    S.reportDraft.manual.batchRows = rows;
    syncBodyTallBigQuantities(rows);
  } else {
    preserveTallBigBatchEdits();
    S.reportDraft.manual.fabricRows = rows;
    if (S.reportDraft.manual.batchRows)
      S.reportDraft.manual.batchRows = sanitizeReportAssignments(S.reportDraft.manual.batchRows, rows, S.reportDraft.floor).rows;
  }
  S.reportDraft.dirty = true;
  setMutationBusy(true);
  try {
    const retained = await retainSavedReportDraft();
    S.reportRowEditor = null;
    refreshEditableReport();
    toast(retained ? 'Row saved to the booking.' : 'Row staged. ' + reportSaveHint());
    return true;
  } catch (error) {
    if (S.currentViewingNumber === before.number && S.currentViewingFloor === before.floor) {
      S.reportDraft = before;
      S.reportRowEditor = { ...editor, error: 'Could not save. Your entered values remain available for retry.' };
      refreshEditableReport();
    }
    showSaveError(error);
    return false;
  } finally {
    setMutationBusy(false);
  }
}
export function renumberReportBatches(rows: Row[], bookingNumber: unknown): void {
  const used = new Set(rows.filter((row) => row.manualNumber && row.id).map((row) => String(row.id)));
  let sequence = 1;
  for (const row of rows) {
    if (row.manualNumber && row.id) continue;
    let id: string;
    do {
      id = normalizeBookingKey(bookingNumber) + String(sequence++).padStart(3, '0');
    } while (used.has(id));
    row.id = id;
    used.add(id);
  }
}
export function regroupManualDyeingRows(rows: Row[], fabrics: Row[], booking: Row, floor: Floor): Row[] {
  preserveTallBigBatchEdits();
  const result: Row[] = [],
    colours = new Map<string, Row>();
  for (const row of rows) {
    const key = colourSelectionKey(row.shade);
    if (!colours.has(key)) colours.set(key, { shade: row.shade, rows: [] });
    if (row.dyeingGroup === 'components' && !row.manual) continue;
    const colour: Row = { shade: row.shade, groups: new Map() };
    fabrics.forEach((fabric, index) => {
      const qty = fabricQuantity(row.quantities?.[fabric.key]) || 0;
      if (fabric.componentKind || qty <= 0) return;
      const source = getReportKnittingRows(booking.number, floor).filter(
        (item) => rowFabricKey(item) === fabric.key && colourSelectionKey(firstUploadedValue(item, BATCH_CALCULATION.colorHeaders)) === key
      );
      const finishes = new Set(source.map((item) => hasPeachFinish(item._fabricColumns?.peach)));
      const peach =
        !fabric.manual && finishes.size > 1 && typeof row.peachFinish === 'boolean' ? row.peachFinish : fabricPeachForColour(fabric, row.shade, booking, floor);
      addDyeingGroupQuantity(colour, fabrics, index, qty, peach, booking, floor);
    });
    if (!colour.groups.size) {
      const emptyKey = row.dyeingGroup === 'components' ? 'components' : 'together';
      colour.groups.set(emptyKey, { key: emptyKey, peach: false, quantities: Array(fabrics.length).fill(0) });
    }
    // Preserve each manually saved row's quantities, number and other fields.
    // Only split a row when its fabrics now belong to different dyeing groups.
    const groups: Row[] = Array.from(colour.groups.values() as Iterable<Row>).sort(
      (a, b) => (a.key === 'together' ? -2 : a.key === 'peach' ? -1 : 0) - (b.key === 'together' ? -2 : b.key === 'peach' ? -1 : 0)
    );
    groups.forEach((group, index) => {
      const split = {
        ...copyReportData(row),
        id: index ? '' : row.id,
        rowKey: index ? 'split:' + row.rowKey + ':' + group.key : row.rowKey,
        manualNumber: index ? false : !!row.manualNumber,
        dyeingGroup: group.key,
        peachFinish: group.peach,
        quantities: Object.fromEntries(fabrics.map((fabric, i) => [fabric.key, group.quantities[i]])),
        manual: true,
      };
      result.push(split);
      colours.get(key)!.rows.push(split);
    });
  }
  const components = componentColourSummary(
    booking,
    floor,
    Array.from(colours.values()).map((colour) => colour.shade)
  );
  for (const [key, colour] of colours) {
    const groupKeys = new Set(colour.rows.map((row: Row) => row.dyeingGroup)),
      anchor = groupKeys.has('together') ? 'together' : groupKeys.has('peach') ? 'peach' : groupKeys.has('components') ? 'components' : null;
    const together: Row | undefined = components.get(key);
    if (!anchor && (together?.kg > 0 || together?.missing)) {
      const seed = {
        shade: colour.shade,
        groups: new Map([['components', { key: 'components', label: 'Together components', peach: false, quantities: Array(fabrics.length).fill(0) }]]),
        ld: new Map(),
        reference: new Map(),
        invalid: false,
      };
      const added: Row[] = createDyeingBatches(booking, fabrics, floor, new Map([[key, seed]])).batches.map((batch: Row, index: number) => ({
        ...autoBatchRow(batch, fabrics),
        rowKey: 'components:' + key + ':' + index,
        id: '',
        manual: false,
      }));
      result.push(...added);
      colour.rows.push(...added);
      groupKeys.add('components');
    }
    for (const row of colour.rows) {
      row.componentAnchor = row.dyeingGroup === (anchor || 'components');
      row.selectionKey = groupKeys.size === 1 ? key : dyeingBatchGroupKey(colour.shade, row.dyeingGroup);
    }
  }
  orderDyeingModeBatches(result, fabrics, booking, floor);
  renumberReportBatches(result, booking.number);
  return result;
}
export function applyMachineToManualBatchRows(group: Row, configuration: Row): void {
  const draft = S.reportDraft!;
  if (!draft.manual.batchRows) return;
  preserveTallBigBatchEdits();
  const rows = copyReportData(S.currentBatchRows),
    key = machineEvaluationKey(group),
    source = rows.filter((row) => machineEvaluationKey(row) === key);
  const quantityTotals: Row = {};
  for (const row of source)
    for (const [fabricKey, quantity] of Object.entries(row.quantities || {}))
      quantityTotals[fabricKey] = (quantityTotals[fabricKey] || 0) + (fabricQuantity(quantity) || 0);
  const replacement: Row[] = Array.from({ length: Math.min(configuration.batches, BATCH_CALCULATION.maxRenderedBatches) }, (_, index) => ({
    rowKey: 'loaded:' + key + ':' + index,
    id: source[index]?.manualNumber ? source[index].id : '',
    manualNumber: !!source[index]?.manualNumber,
    dyeingGroup: group.dyeingGroup,
    componentAnchor: group.componentAnchor,
    selectionKey: key,
    peachFinish: source[0]?.peachFinish,
    tallBig: source[index]?.tallBig || (automaticTallBig() ? source[0]?.tallBig : '') || '',
    shade: group.shade,
    ld: source[index]?.ld ?? source[0]?.ld ?? '',
    reference: source[index]?.reference ?? source[0]?.reference ?? '',
    quantities: Object.fromEntries(Object.entries(quantityTotals).map(([fabricKey, quantity]) => [fabricKey, quantity / configuration.batches])),
    loading: String(Number(configuration.actualLoadingPercent.toFixed(2))) + '%',
    nozzle: String(machineNozzles(configuration.capacityKg)),
    machineId: configuration.id,
    machineLabel: configuration.machine.label,
    manual: true,
  }));
  const first = rows.findIndex((row) => machineEvaluationKey(row) === key),
    remaining = rows.filter((row) => machineEvaluationKey(row) !== key);
  remaining.splice(first < 0 ? remaining.length : first, 0, ...replacement);
  orderDyeingModeBatches(remaining, S.currentFabricRows, currentReportBooking()!, draft.floor);
  renumberReportBatches(remaining, draft.number);
  draft.manual.batchRows = remaining;
}
export function tentativeReasons(answers: Row | null | undefined): string[] {
  if (!answers) return [];
  const reasons: string[] = [];
  for (const [field, question] of [
    ['labDip', 'Is the lab dip approved?'],
    ['bookingHold', 'Is the booking on hold?'],
    ['productionConfirmed', 'Is final production confirmation completed?'],
  ]) {
    if (['Yes', 'No'].includes(answers[field])) reasons.push(question + ' ' + answers[field]);
  }
  if (String(answers.others || '').trim()) reasons.push('And Also: ' + String(answers.others).trim());
  return reasons;
}

/* ---------- Instructions and component rows ---------- */
export function instructionRows(booking: Row, floor: Floor): Row[] {
  const frozen = frozenConfirmedReport(booking, floor);
  if (frozen) return copyReportData(frozen.instructions || []);
  const manual = reportManualState(booking, floor),
    source = manual.instructions ?? booking.instructions ?? [];
  return copyReportData(
    source.map((value: Row | string, index: number) =>
      typeof value === 'object'
        ? { serial: String(value.serial ?? index + 1), details: String(value.details ?? '') }
        : { serial: String(index + 1), details: String(value) }
    )
  );
}
export function auxiliaryRowFields(kind: string): string[][] {
  if (kind === 'instruction')
    return [
      ['serial', 'SL No'],
      ['details', 'Details'],
    ];
  const section = S.currentComponentSections.find((item) => item.kind === kind.slice(10));
  return [
    ['id', 'Batch #'],
    ...(tallBigEnabled() && tallBigSettings().declarations?.[section?.kind]?.enabled ? [['tallBig', 'Tall/Big size']] : []),
    ['shade', 'Color'],
    ...(odColumn(section?.kind) ? [['odColour', 'OD Colour']] : []),
    ...(section?.dyeingType === 'YD' ? [['tippingColour', 'Tipping Colour']] : []),
    ['fabricType', 'FabricType'],
    ['ld', 'Lapdip Number'],
    ['reference', 'Reference'],
    ...(section?.sizes || []).map((size: Row) => ['qty:' + size.key, size.label + ' (pcs)']),
    ['newSize', 'Add Size (L x W)'],
    ['newSizeQty', 'New Size Qty (pcs)'],
    ['newSizeWeight', 'New Size Weight (kg/pc)'],
  ];
}
export function auxiliarySourceRows(kind: string): Row[] {
  return kind === 'instruction'
    ? instructionRows(getFloorBooking(currentReportBooking()!, S.currentViewingFloor), S.currentViewingFloor)
    : S.currentComponentSections.find((section) => section.kind === kind.slice(10))?.rows || [];
}
/** Saves the instruction or component row being edited (values from S.reportRowEditor.values). */
export async function saveAuxiliaryReportRow(): Promise<boolean> {
  if (!S.reportRowEditor || !S.reportDraft || !canEditReport()) return false;
  const editor = copyReportData(S.reportRowEditor),
    before = copyReportData(S.reportDraft);
  const rows = copyReportData(auxiliarySourceRows(editor.kind)),
    old: Row = editor.isNew ? {} : rows[editor.index];
  let row: Row,
    error = '';
  if (editor.kind === 'instruction') {
    row = { serial: String(editor.values.serial || '').trim(), details: String(editor.values.details || '').trim() };
    if (!row.serial || !row.details) error = 'Enter a serial number and instruction.';
  } else {
    row = {
      ...old,
      id: String(editor.values.id || '').trim(),
      shade: String(editor.values.shade || '').trim(),
      fabricType: String(editor.values.fabricType || '').trim(),
      odColour: String(editor.values.odColour ?? old.odColour ?? '').trim(),
      tippingColour: String(editor.values.tippingColour ?? old.tippingColour ?? '').trim(),
      ld: editor.values.ld || '',
      reference: editor.values.reference || '',
      quantities: {},
      weights: { ...(old.weights || {}) },
      manual: true,
    };
    for (const [key, value] of Object.entries(editor.values))
      if (key.startsWith('qty:')) {
        const qty = String(value).trim() === '' ? 0 : fabricQuantity(value);
        if (qty === null || !Number.isSafeInteger(qty) || qty < 0) error = 'Size quantities must be non-negative whole pieces.';
        else row.quantities[key.slice(4)] = qty;
      }
    for (const [key, value] of Object.entries(editor.values))
      if (key.startsWith('weight:')) {
        const weight = String(value).trim() === '' ? null : fabricQuantity(value);
        if (weight !== null && weight < 0) error = 'Weight per piece must be a non-negative kg value.';
        else row.weights[key.slice(7)] = weight;
      }
    const newSize = String(editor.values.newSize || '').trim(),
      newQty = String(editor.values.newSizeQty || '').trim();
    if (newSize || newQty) {
      const size = componentSize({ CCSize: newSize }),
        qty = fabricQuantity(newQty);
      if (!size?.numeric || qty === null || !Number.isSafeInteger(qty) || qty < 0)
        error = 'Enter the new size as length x width and a non-negative whole-piece quantity.';
      else {
        row.quantities[size.key] = qty;
        const weight = String(editor.values.newSizeWeight || '').trim() === '' ? null : fabricQuantity(editor.values.newSizeWeight);
        if (weight !== null && weight < 0) error = 'Weight per piece must be a non-negative kg value.';
        row.weights[size.key] = weight;
      }
    }
    if (!row.id || !row.shade || !row.fabricType) error = 'Enter Batch #, Color and FabricType.';
    if (!Object.values(row.quantities).some((qty) => (qty as number) > 0)) error = 'Enter a positive planned quantity for at least one size.';
    const saved = row;
    if (
      rows.some(
        (other, index) =>
          index !== editor.index &&
          other.id === saved.id &&
          colourSelectionKey(other.shade) === colourSelectionKey(saved.shade) &&
          other.fabricType.toLowerCase() === saved.fabricType.toLowerCase()
      )
    )
      error = 'This batch, colour and FabricType already exist in this section.';
    const existing: Row[] = [...S.currentBatchRows, ...S.currentComponentSections.flatMap((section) => section.rows)];
    if (existing.some((other) => other.id === saved.id && colourSelectionKey(other.shade) !== colourSelectionKey(saved.shade)))
      error = 'A batch number cannot belong to two different colours.';
  }
  if (error) {
    S.reportRowEditor = { ...editor, error };
    refreshEditableReport();
    return false;
  }
  if (editor.isNew) rows.push(row);
  else rows[editor.index] = row;
  if (editor.kind === 'instruction') S.reportDraft.manual.instructions = rows;
  else {
    S.reportDraft.manual.componentRows = { ...(S.reportDraft.manual.componentRows || {}), [editor.kind.slice(10)]: rows };
    syncTallBigManualComponentRows(editor.kind.slice(10), rows);
  }
  S.reportDraft.dirty = true;
  setMutationBusy(true);
  try {
    const retained = await retainSavedReportDraft();
    S.reportRowEditor = null;
    refreshEditableReport();
    toast(retained ? 'Row saved to the booking.' : 'Row staged. ' + reportSaveHint());
    return true;
  } catch (error) {
    S.reportDraft = before;
    S.reportRowEditor = { ...editor, error: 'Could not save. Your entered values remain available for retry.' };
    refreshEditableReport();
    showSaveError(error);
    return false;
  } finally {
    setMutationBusy(false);
  }
}
export async function deleteReportRow(kind: string, index: number): Promise<boolean> {
  if (!S.reportDraft || !canEditReport()) return false;
  if (S.reportRowEditor && (S.reportRowEditor.kind !== kind || (!S.reportRowEditor.isNew && S.reportRowEditor.index !== index))) {
    toast('Save or cancel the row being edited first.');
    return false;
  }
  if (S.reportRowEditor?.isNew) {
    S.reportRowEditor = null;
    refreshEditableReport();
    return true;
  }
  if (kind === 'batch' && S.currentReportBatchRowsTruncated) {
    toast('Deletion requires the complete batch list.');
    return false;
  }
  const before = copyReportData(S.reportDraft),
    editor = copyReportData(S.reportRowEditor);
  const source = kind === 'fabric' ? S.currentFabricRows : kind === 'batch' ? S.currentBatchRows : auxiliarySourceRows(kind);
  if (!source[index]) return false;
  const rows = copyReportData(source);
  rows.splice(index, 1);
  if (kind === 'fabric' || kind === 'batch') preserveTallBigBatchEdits();
  if (kind === 'fabric') {
    const key = source[index].key;
    S.reportDraft.manual.fabricRows = rows;
    // Freeze the displayed batches so removing a fabric cannot recreate it.
    S.reportDraft.manual.batchRows = copyReportData(S.currentBatchRows).map((row) => {
      delete row.quantities[key];
      return row;
    });
  } else if (kind === 'batch') {
    S.reportDraft.manual.batchRows = rows;
    syncBodyTallBigQuantities(rows);
    for (const section of S.currentComponentSections)
      S.reportDraft.manual.componentRows[section.kind] = copyReportData(
        section.rows.filter((row: Row) => row.bodyBatchId !== source[index].id && row.id !== source[index].id)
      );
  } else if (kind === 'instruction') S.reportDraft.manual.instructions = rows;
  else {
    S.reportDraft.manual.componentRows = { ...(S.reportDraft.manual.componentRows || {}), [kind.slice(10)]: rows };
    syncTallBigManualComponentRows(kind.slice(10), rows);
  }
  S.reportDraft.dirty = true;
  setMutationBusy(true);
  try {
    const retained = await retainSavedReportDraft();
    S.reportRowEditor = null;
    refreshEditableReport();
    toast(retained ? 'Row deleted and saved.' : 'Row deletion staged. ' + reportSaveHint());
    return true;
  } catch (error) {
    S.reportDraft = before;
    S.reportRowEditor = editor;
    refreshEditableReport();
    showSaveError(error);
    return false;
  } finally {
    setMutationBusy(false);
  }
}

/* ---------- Dyeing Mode (CC mode popup) ----------
   The popup component keeps its own open / expanded / search state across re-renders, so these functions
   no longer reopen it (the old code restored it after refreshEditableReport()). */
export function dyeingModeOptions(booking: Row, floor: Floor): Row[] {
  const allColours = new Map<string, string>(),
    byFabric = new Map<string, Map<string, string>>();
  const add = (key: string, shade: unknown) => {
    if (!String(shade || '').trim()) return;
    const normalized = colourSelectionKey(shade);
    allColours.set(normalized, String(shade).trim());
    if (!byFabric.has(key)) byFabric.set(key, new Map());
    byFabric.get(key)!.set(normalized, String(shade).trim());
  };
  for (const row of getReportKnittingRows(booking.number, floor)) add(rowFabricKey(row), firstUploadedValue(row, BATCH_CALCULATION.colorHeaders));
  for (const row of S.currentBatchRows) for (const [key, qty] of Object.entries(row.quantities || {})) if ((qty as number) > 0) add(key, row.shade);
  for (const row of getReportBpRows(booking, floor))
    for (const kind of componentKinds(bpValue(row, 'details'))) add('component:' + kind + ':' + colourSelectionKey(bpValue(row, 'fabricType')), bpValue(row, 'colour'));
  return reportFabricSlots().map((fabric) => ({
    ...fabric,
    colours: Array.from((byFabric.get(fabric.key)?.size ? byFabric.get(fabric.key)! : allColours).values()),
  }));
}
export async function changeFabricDyeingMode(fabricKey: string, shadeKey: string, checked: boolean): Promise<boolean> {
  if (!S.reportDraft || !canEditReport()) return false;
  if (S.reportRowEditor) {
    toast('Save or cancel the row being edited first.');
    refreshEditableReport();
    return false;
  }
  const options = dyeingModeOptions(currentReportBooking()!, S.currentViewingFloor),
    targets = fabricKey === 'all' ? options : options.filter((option) => option.key === fabricKey);
  if (!targets.length) return false;
  const before = copyReportData(S.reportDraft);
  const selected = copyReportData(S.reportDraft.manual.fabricSeparate || {});
  for (const option of targets) selected[option.key] = shadeKey === '*' ? { '*': checked } : { ...(selected[option.key] || {}), [shadeKey]: checked };
  S.reportDraft.manual.fabricSeparate = selected;
  if (S.reportDraft.manual.batchRows && targets.some((option) => !option.componentKind))
    S.reportDraft.manual.batchRows = regroupManualDyeingRows(S.currentBatchRows, S.currentFabricRows, currentReportBooking()!, S.currentViewingFloor);
  S.reportDraft.dirty = true;
  setMutationBusy(true);
  try {
    await retainSavedReportDraft();
    refreshEditableReport();
    return true;
  } catch (error) {
    S.reportDraft = before;
    refreshEditableReport();
    showSaveError(error);
    return false;
  } finally {
    setMutationBusy(false);
  }
}
export async function changeCCMode(kind: string, checked: boolean): Promise<boolean> {
  if (!S.reportDraft || !canEditReport()) return false;
  if (S.reportRowEditor) {
    toast('Save or cancel the row being edited first.');
    refreshEditableReport();
    return false;
  }
  const before = copyReportData(S.reportDraft),
    kinds: string[] = availableComponentKinds(currentReportBooking()!, S.currentViewingFloor);
  const selected = { ...(S.reportDraft.manual.componentSeparate || {}) };
  for (const item of kind === 'all' ? kinds : [kind]) if (kinds.includes(item)) selected[item] = checked;
  S.reportDraft.manual.componentSeparate = selected;
  S.reportDraft.dirty = true;
  setMutationBusy(true);
  try {
    await retainSavedReportDraft();
    refreshEditableReport();
    return true;
  } catch (error) {
    S.reportDraft = before;
    refreshEditableReport();
    showSaveError(error);
    return false;
  } finally {
    setMutationBusy(false);
  }
}
