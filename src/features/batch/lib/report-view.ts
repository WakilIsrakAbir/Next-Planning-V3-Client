/* Batch Plan report view: the Batch Plan report body as data.
   The old generateBlankBatchPlanHtml() and its helpers (generalInfoTable, fabricInfoEditableTable,
   colourBatchEditableTable, renderComponentSections, componentEditableTable, editableInstructionTable,
   reportManualNotice, ccDyeingModeControl, tallBigControl, odControl, ...) built one HTML string for
   #reportContent. Here they keep their names, rules and side effects (renderComponentSections still sets
   S.currentComponentSections) but return the values that HTML showed. openBatchPlanReport() (report-actions.ts)
   stores the result in S.ui.reportuiView and components/plan/report/ReportBody.tsx renders it.

   Like the old HTML, the view is a snapshot taken when the report is (re)opened. Only the row being edited
   (S.reportRowEditor) and the disabled state (S.mutationBusy / S.storageReady, the old setMutationBusy loop)
   are read live by the components. */
import { FABRIC_ROW_FIELDS } from '@/features/batch/constants';
import { S } from '@/features/batch/store/batch-store';
import type { Row } from '@/features/batch/types';
import {
  batchPlanRevision,
  confirmedReportLocked,
  floorLabel,
  generalInfoValues,
  getReportKnittingRows,
  normalizeFloor,
  reportFactoryName,
  revisionDisplay,
  revisionNumberFromRows,
  reviewingLatest,
} from './bookings';
import {
  GenericMachineSelection,
  availableComponentKinds,
  colourSelectionKey,
  componentIsSeparate,
  evaluateKnittingReadiness,
  fabricDyeingChoice,
  getMachineSetup,
  isCalculatedBatchField,
  kgText,
  machineFloorsForMenu,
  productionSum,
  showKnittingReadiness,
} from './batch-calculation';
import {
  automaticTallBig,
  auxiliaryRowFields,
  buildComponentBatches,
  buildEditableReportTables,
  currentReportBooking,
  dyeingModeOptions,
  instructionRows,
  odColumn,
  odRows,
  odSettings,
  isODSemiBleach,
  reportBookingStatus,
  reportFabricSlots,
  savedReportPlan,
  tallBigEnabled,
  tallBigSettings,
  tentativeReasons,
} from './report-model';

/** One editable column of a report table: [field, label] (the old field lists). */
export type ReportBodyField = string[];

export type ReportBodyNotice =
  | { kind: 'locked' }
  | { kind: 'confirm'; dirty: boolean }
  | { kind: 'review'; confirmedRevision: string; latestRevision: string }
  | { kind: 'tentative'; summary: string; edit: boolean }
  | { kind: 'manual'; retained: boolean; edit: boolean };

/** OD BP select of a section (old odControl). */
export interface ReportBodyOdControl {
  kind: string;
  mode: string;
}

/** Tall/Big select (+ its button) of Colour & Batch Info or of a component section. */
export interface ReportBodyTallBigControl {
  enabled: boolean;
  locked: boolean;
}

/** Old checkbox(values): 'checked', 'mixed' (aria-checked="mixed" data-mode-partial) or ''. */
export type ReportBodyCheckState = 'checked' | 'mixed' | '';

export interface ReportBodyDyeingModeOption {
  key: string;
  name: string;
  type: string;
  state: ReportBodyCheckState;
  colours: { shade: string; key: string; checked: boolean }[];
  /** The option's text as the old filterDyeingModeOptions read it (textContent of [data-cc-option]). */
  text: string;
}

/** Dyeing Mode popup (old ccDyeingModeControl). */
export interface ReportBodyDyeingMode {
  locked: boolean;
  all: ReportBodyCheckState;
  options: ReportBodyDyeingModeOption[];
}

/** One cell of Colour & Batch Info: the text shown when the row is not edited, and its knit note badge. */
export interface ReportBodyBatchCell {
  display: string;
  knitNote: Row | null;
}

/** Colour & Batch Info table (old colourBatchEditableTable). */
export interface ReportBodyBatchTable {
  fields: ReportBodyField[];
  rows: Row[];
  warnings: string[];
  /** isCalculatedBatchField(field) for every field. */
  calculated: boolean[];
  cells: ReportBodyBatchCell[][];
  readiness: Row[] | null;
  automaticTallBig: boolean;
  /** confirmedReportLocked() as the old table read it. */
  locked: boolean;
}

/** A component section's table (old componentEditableTable). */
export interface ReportBodyComponentTable {
  /** Every column; New Size columns are shown only while a row of this section is edited. */
  fields: ReportBodyField[];
  /** Tall/Big size shown for each row (row.tallBig, else its body batch's). */
  rowTallBig: string[];
  newRowTallBig: string;
  totals: { sizes: number[]; pieces: number; kg: number | null; span: number } | null;
}

export interface ReportBodyComponentSection {
  section: Row;
  od: ReportBodyOdControl | null;
  tallBig: ReportBodyTallBigControl;
  table: ReportBodyComponentTable;
}

/** Everything the report body shows (old generateBlankBatchPlanHtml). */
export interface ReportBodyView {
  /** Changes on every rebuild (uncontrolled selects and checkboxes are re-created, like the old HTML). */
  seq: number;
  number: string;
  floor: string | null;
  review: boolean;
  booking: Row;
  status: string;
  isBlank: boolean;
  factoryName: string;
  floorName: string;
  revision: string;
  /** confirmedReportLocked() (the old setMutationBusy reportLocked). */
  locked: boolean;
  notice: ReportBodyNotice;
  machineOptions: string[];
  general: { values: Row };
  fabrics: Row[];
  batch: ReportBodyBatchTable;
  bodyOd: ReportBodyOdControl | null;
  tallBig: ReportBodyTallBigControl | null;
  dyeingMode: ReportBodyDyeingMode;
  machineEvaluationCount: number;
  sections: ReportBodyComponentSection[];
  instructions: { rows: Row[]; fields: ReportBodyField[] };
  timestamp: string;
}

let viewSeq = 0;

/* ---------- knitting status badge (old knittingBadge(state, summary) returned the <span>) ---------- */
export interface KnittingBadgeView {
  /** Readiness kind ('ready', 'short', 'unknown', 'cc' or 'empty'); KnittingBadge maps it to its colours. */
  kind: string;
  /** The batch row's summary badge (larger text, bounded width) rather than a fabric cell badge. */
  summary: boolean;
  title: string;
  label: string;
}

export function knittingBadge(state: Row | null | undefined, summary = false): KnittingBadgeView | null {
  if (!state) return null;
  const detail =
    state.requiredKg === undefined
      ? ''
      : `Produced: ${kgText(state.producedKg)} kg; available before this batch: ${kgText(state.availableKg)} kg; required: ${kgText(state.requiredKg)} kg.`;
  return { kind: String(state.kind ?? ''), summary, title: detail, label: String(state.label ?? '') };
}

/* ---------- Machine Selection Evaluation rows ---------- */
export interface MachineEvaluationRowView {
  row: Row;
  display: Row;
  remarks: string;
  /** 'selected': the applied machine (green); 'recommended': the algorithm's choice (blue). */
  highlight: 'selected' | 'recommended' | null;
}

/** Rows of the evaluation table for one colour (old renderMachineEvaluationRows returned the table HTML). */
export function renderMachineEvaluationRows(index = 0): { error: string; rows: MachineEvaluationRowView[] } | null {
  const group = S.currentReportMachineEvaluations[index];
  if (!group) return null;
  const display: Row[] = GenericMachineSelection.formatEvaluations(group.rows);
  const rows = (group.rows as Row[]).map((row, i): MachineEvaluationRowView => {
    const applied = row.applied;
    const remarks = applied
      ? (row.appliedBy === 'manual' ? 'Loaded manually for this colour. ' : 'Applied automatically. ') + (row.selected ? 'Recommended by algorithm.' : row.remarks)
      : row.selected
        ? 'Recommended by algorithm.'
        : row.remarks;
    return { row, display: display[i], remarks: String(remarks ?? ''), highlight: applied ? 'selected' : row.selected ? 'recommended' : null };
  });
  return { error: group.error ? String(group.error) : '', rows };
}

/* ---------- report controls ---------- */
export function tallBigControl(booking: Row, floor: string | null): ReportBodyTallBigControl | null {
  if (!availableComponentKinds(booking, floor).length) return null;
  return { enabled: !!tallBigEnabled(booking, floor), locked: !!confirmedReportLocked(booking, floor) };
}

export function ccDyeingModeControl(booking: Row, floor: string | null): ReportBodyDyeingMode {
  const options: Row[] = dyeingModeOptions(booking, floor),
    locked = !!confirmedReportLocked(booking, floor);
  const state = (option: Row): unknown[] =>
    (option.colours as string[]).map((shade) =>
      option.componentKind ? componentIsSeparate(booking, floor, option.componentKind, shade, option.type) : fabricDyeingChoice(booking, floor, option.key, shade) === true
    );
  const checkbox = (values: unknown[]): ReportBodyCheckState => (values.length && values.every(Boolean) ? 'checked' : values.some(Boolean) ? 'mixed' : '');
  return {
    locked,
    all: checkbox(options.flatMap(state)),
    options: options.map((option) => {
      const values = state(option);
      const type = String(option.type ?? '');
      const colours = (option.colours as string[]).map((shade, index) => ({ shade: String(shade ?? ''), key: colourSelectionKey(shade), checked: !!values[index] }));
      return {
        key: String(option.key ?? ''),
        name: String(option.name ?? ''),
        type,
        state: checkbox(values),
        colours,
        text: String(option.name ?? '') + (type || 'Fabric details not entered') + ' All Colour' + colours.map((colour) => ' ' + (colour.shade || 'Blank colour')).join(''),
      };
    }),
  };
}

export function odControl(kind: string, booking: Row, floor: string | null): ReportBodyOdControl | null {
  if (!(odRows(kind) as Row[]).some((row) => isODSemiBleach(row.shade))) return null;
  return { kind, mode: String(odSettings(kind, booking, floor).mode ?? '') };
}

export function tallBigDeclarationControl(section: Row, booking: Row, floor: string | null): ReportBodyTallBigControl {
  const enabled = tallBigEnabled(booking, floor) && tallBigSettings(booking, floor).declarations?.[section.kind]?.enabled;
  return { enabled: !!enabled, locked: !!confirmedReportLocked(booking, floor) };
}

export function reportManualNotice(booking: Row, floor: string | null): ReportBodyNotice {
  const status = reportBookingStatus(booking, floor),
    retained = ['Tentative', 'Confirm'].includes(status);
  if (confirmedReportLocked(booking, floor)) return { kind: 'locked' };
  if (status === 'Confirm' && !reviewingLatest(booking.number, floor)) return { kind: 'confirm', dirty: !!S.reportDraft?.dirty };
  if (reviewingLatest(booking.number, floor))
    return {
      kind: 'review',
      confirmedRevision: String(revisionDisplay(savedReportPlan(booking, floor).confirmedSnapshot?.revisionNo)),
      latestRevision: String(revisionDisplay(revisionNumberFromRows(getReportKnittingRows(booking.number, floor)))),
    };
  const reasons: string[] = status === 'Tentative' ? tentativeReasons(savedReportPlan(booking, floor).tentativeAnswers) : [];
  const edit = status === 'Tentative';
  if (reasons.length) return { kind: 'tentative', summary: reasons.join('; '), edit };
  return { kind: 'manual', retained, edit };
}

/* ---------- General Info ---------- */
export function generalInfoTable(booking: Row, floor: string | null): { values: Row } {
  return { values: generalInfoValues(booking, floor) };
}

/** Which General Info buttons show: '' (read-only), 'save' (Save/Cancel while editing) or 'edit'. */
export function generalInfoActions(locked: boolean = confirmedReportLocked()): '' | 'save' | 'edit' {
  return locked ? '' : S.reportRowEditor?.kind === 'general' ? 'save' : 'edit';
}

/* ---------- row editing ---------- */
export function rowEditingFields(kind: string): ReportBodyField[] {
  if (kind === 'instruction' || kind.startsWith('component:')) return auxiliaryRowFields(kind);
  return kind === 'fabric'
    ? FABRIC_ROW_FIELDS
    : [
        ['id', 'Batch #'],
        ...(tallBigEnabled() ? [['tallBig', 'Tall/Big size']] : []),
        ['shade', 'Shade'],
        ...(odColumn('body') ? [['odColour', 'OD Colour']] : []),
        ['ld', 'Lapdip Number'],
        ['reference', 'Reference'],
        ...(reportFabricSlots() as Row[]).map((fabric) => ['qty:' + fabric.key, fabric.name]),
        ['totalKg', 'Total batch Qty (kg)'],
        ...(showKnittingReadiness() ? [['knitStatus', 'Knit Status']] : []),
        ['loading', 'Loading'],
        ['nozzle', 'M/C nozzle'],
        ['machineLabel', 'MC Number'],
      ];
}

/* ---------- tables ---------- */
/** Fabric Info rows (the component shows FABRIC_ROW_FIELDS of each). */
export function fabricInfoEditableTable(fabrics: Row[]): Row[] {
  return fabrics;
}

export function componentFabricDisplayQuantities(
  rows: Row[],
  fabrics: Row[],
  booking: Row | null | undefined,
  floor: string | null,
  sections: Row[] = buildComponentBatches(booking, floor, rows)
): Map<string, number | null> {
  const totals = new Map<string, number | null>();
  for (const section of sections)
    for (const row of section.rows as Row[]) {
      const type = colourSelectionKey(row.fabricType),
        sourceKey = 'component:' + section.kind + ':' + type;
      const candidates = fabrics.filter((fabric) => fabric.componentKind === section.kind);
      const fabric = candidates.find((value) => value.key === sourceKey) || candidates.find((value) => colourSelectionKey(value.type) === type);
      if (!fabric) continue;
      const key = JSON.stringify([String(row.id), colourSelectionKey(row.shade), fabric.key]);
      const prior = totals.get(key);
      totals.set(key, row.totalKg === null || prior === null ? null : productionSum([prior || 0, row.totalKg]));
    }
  return totals;
}

export function colourBatchEditableTable(rows: Row[], warnings: string[]): ReportBodyBatchTable {
  const fields = rowEditingFields('batch');
  // Component kg is displayed in its existing Fabric number. Display values
  // stay outside body quantities so loading and totals continue to count it once.
  const booking = currentReportBooking(),
    floor = S.currentViewingFloor;
  const components: Row[] = buildComponentBatches(booking, floor, rows);
  const componentQuantities = componentFabricDisplayQuantities(rows, S.currentFabricRows, booking, floor, components);
  const readiness: Row[] | null = showKnittingReadiness() ? evaluateKnittingReadiness(booking as Row, floor, S.currentFabricRows, rows, components) : null;
  const componentKeys = new Set(S.currentFabricRows.filter((fabric) => fabric.componentKind).map((fabric) => fabric.key));
  const calculated = fields.map(([field]) => !!isCalculatedBatchField(field));
  const cells = rows.map((row, index) =>
    fields.map(([field], column): ReportBodyBatchCell => {
      if (field === 'tallBig' || field === 'knitStatus') return { display: '', knitNote: null };
      const fabricKey = field.startsWith('qty:') ? field.slice(4) : null;
      const rawValue =
        fabricKey !== null
          ? componentKeys.has(fabricKey)
            ? componentQuantities.get(JSON.stringify([String(row.id), colourSelectionKey(row.shade), fabricKey]))
            : row.quantities?.[fabricKey]
          : row[field];
      const value = rawValue === null && calculated[column] ? 'Weight missing' : (rawValue ?? '');
      const display =
        field.startsWith('qty:') || field.startsWith('componentKg:') || field === 'totalKg'
          ? value === 0
            ? ''
            : typeof value === 'number'
              ? kgText(value)
              : value
          : value;
      const knitCell = fabricKey ? readiness?.[index]?.cells[fabricKey] : undefined;
      const knitNote =
        knitCell && (knitCell.kind !== 'cc' || rawValue === null || (typeof rawValue === 'number' && rawValue > 0)) ? (knitCell as Row) : null;
      return { display: String(display ?? ''), knitNote };
    })
  );
  return { fields, rows, warnings, calculated, cells, readiness, automaticTallBig: !!automaticTallBig(), locked: !!confirmedReportLocked() };
}

export function componentEditableTable(section: Row): ReportBodyComponentTable {
  const kind = 'component:' + section.kind;
  const fields = auxiliaryRowFields(kind);
  const hasField = (name: string) => fields.some(([field]) => field === name);
  const sectionRows: Row[] = section.rows;
  const tallBigOf = (row: Row): string => {
    const body = S.currentBatchRows.find(
      (batch) => batch.id === (row.bodyBatchId || row.id) && colourSelectionKey(batch.shade) === colourSelectionKey(row.shade)
    );
    return String(row.tallBig || body?.tallBig || 'No');
  };
  const showTallBig = hasField('tallBig');
  let totals: ReportBodyComponentTable['totals'] = null;
  if (sectionRows.length) {
    const sizes = (section.sizes as Row[]).map((size) => productionSum(sectionRows.map((row) => row.quantities[size.key] || 0)));
    const kg = sectionRows.some((row) => row.totalKg === null) ? null : productionSum(sectionRows.map((row) => row.totalKg));
    totals = {
      sizes,
      pieces: productionSum(sizes),
      kg,
      span: 5 + (hasField('odColour') ? 1 : 0) + (hasField('tallBig') ? 1 : 0) + (hasField('tippingColour') ? 1 : 0),
    };
  }
  return {
    fields,
    rowTallBig: showTallBig ? sectionRows.map(tallBigOf) : [],
    newRowTallBig: showTallBig ? tallBigOf({}) : 'No',
    totals,
  };
}

export function renderComponentSections(booking: Row, floor: string | null, bodyRows: Row[]): ReportBodyComponentSection[] {
  S.currentComponentSections = buildComponentBatches(booking, floor, bodyRows);
  return S.currentComponentSections.map((section) => ({
    section,
    od: odControl(section.kind, booking, floor),
    tallBig: tallBigDeclarationControl(section, booking, floor),
    table: componentEditableTable(section),
  }));
}

export function editableInstructionTable(booking: Row, floor: string | null): { rows: Row[]; fields: ReportBodyField[] } {
  return { rows: instructionRows(booking, floor), fields: auxiliaryRowFields('instruction') };
}

/* ---------- the whole report ---------- */
export function generateBlankBatchPlanHtml(booking: Row, floor: string | null = S.activeFloor): ReportBodyView {
  const isBlank = booking.status === 'Pending';

  // General Info Grid
  const general = generalInfoTable(booking, floor);

  // Data rows can be edited individually; the selection algorithm is unchanged.
  const reportTables: { fabrics: Row[]; rows: Row[]; warnings: string[] } = buildEditableReportTables(booking, floor);
  const fabricTable = fabricInfoEditableTable(reportTables.fabrics);
  const colorTable = colourBatchEditableTable(reportTables.rows, reportTables.warnings);
  const floorPool: unknown[] = machineFloorsForMenu(floor);
  const machineOptions = (getMachineSetup() as Row[])
    .filter((machine) => floorPool.includes(normalizeFloor(machine.floor)) && String(machine.mcType).trim().toUpperCase() === 'BULK')
    .map((machine) => String(machine.mcBrand).trim() + '-' + String(machine.mcNo).trim());

  const componentSections = renderComponentSections(booking, floor, reportTables.rows);

  const instructionTable = editableInstructionTable(booking, floor);

  return {
    seq: ++viewSeq,
    number: String(booking.number),
    floor,
    review: S.currentReportReviewLatest,
    booking,
    status: String(booking.status ?? ''),
    isBlank,
    factoryName: String(reportFactoryName(floor) ?? ''),
    floorName: floor ? String(floorLabel(floor)) : '',
    revision: String(batchPlanRevision(booking.number, floor) || ''),
    locked: !!confirmedReportLocked(),
    notice: reportManualNotice(booking, floor),
    machineOptions,
    general,
    fabrics: fabricTable,
    batch: colorTable,
    bodyOd: odControl('body', booking, floor),
    tallBig: tallBigControl(booking, floor),
    dyeingMode: ccDyeingModeControl(booking, floor),
    machineEvaluationCount: S.currentReportMachineEvaluations.length,
    sections: componentSections,
    instructions: instructionTable,
    timestamp: new Date().toLocaleString(),
  };
}
