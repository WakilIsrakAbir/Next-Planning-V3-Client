/* Batch engine slice "reports": Dyeable Batch, Dyeable Batch Summary and Daily Confirm Batch Plan
   (port of js/batch/batch-app.js lines 5187-5501 and 5579-5634, and the report rule of the old BatchApi.route()).

   Dyeable Batch reads approved Colour & Batch Info rows. Production is allocated over each complete saved
   sequence before report filters are applied. Previewing and downloading never modify bookings.

   Where the old code wrote HTML, these functions keep what components/reports needs in S and call notify():
     S.dyeableFilterContext        the Dyeable filters dialog (old fields source, returnFocus, mode, selections, plus
                                   `error`, the old #dyeableFilterError text); the dialog is shown while it is set
     S.ui.reportsDailyFilters      the Daily Confirm filters dialog (DailyConfirmForm: the old inputs' values, buyer
                                   choices and #dailyConfirmError); shown while it is set
     S.ui.reportsExportStatus      old #dyeableExportStatus text
     S.ui.reportsSummaryExportStatus  old #dyeableSummaryExportStatus text
     S.ui.reportsSummaryPrintedAt  the time shown as 'Printed Date & Time' on the summary (old #dyeableSummaryTimestamp)
     S.ui.reportsDyeableRestoreFocus  the filters dialog gives the focus back when it closes
     S.ui.reportsRouteKind         the report kind the route shows
   The report tables, counts and notes are computed by the components from the results in S. */
import type { Range, WorkBook } from 'xlsx';
import {
  APP_SETTINGS,
  DAILY_CONFIRM_HEADERS,
  DYEABLE_ALL,
  DYEABLE_FILTER_IDS,
  DYEABLE_SUMMARY_CRITERIA,
  DYEABLE_UNASSIGNED,
} from './constants';
import { BATCH_FLOORS, DYEABLE_FLOOR_LABELS, S, notify } from './state';
import { currentUsername, ensureExcelReader, getStoredDatasets, getStoredMasterList, printWithBodyClass, toast } from './storage';
import { captureConfirmedReport, floorLabel, knittingRowFloor, normalizeBookingKey, normalizeFloor, revisionLabel } from './core';
import {
  colourSelectionKey,
  constructionKey,
  evaluateKnittingReadiness,
  fabricQuantity,
  getMachineSetup,
  kgText,
  machineEvaluationKey,
  machineFloorsForMenu,
  machineNozzles,
  productionSum,
} from './calc';
import { copyReportData, currentReportBooking, savedReportPlan } from './model';
import { switchMainView } from './planflow';
import { componentFabricDisplayQuantities } from './reportui';
import type { Row } from './types';

export type BatchReportKind = 'detail' | 'summary' | 'daily';
export type DyeableFilterKey = keyof typeof DYEABLE_FILTER_IDS;

/** One multi-select of the Dyeable filters dialog (old dyeableFilterContext.selections[key]). */
export interface DyeableSelection {
  all: boolean;
  values: Set<string>;
  choices: [string, string][];
}

/** The Daily Confirm filters dialog (old #dailyConfirmFrom/To/Route/Floor/Buyer and #dailyConfirmError). */
export interface DailyConfirmForm {
  from: string;
  to: string;
  route: string;
  floor: string;
  buyer: string;
  buyers: string[];
  error: string;
}

export interface DyeableSummaryCell {
  count: number;
  quantity: number;
  missing: number;
}

type ExcelReader = Awaited<ReturnType<typeof ensureExcelReader>>;

const errorMessage = (error: unknown): string => (error as Error)?.message;

/* ---------- Dyeable Batch data ---------- */

export function generalInfoBuyer(row: Row | null | undefined): string {
  for (const [key, value] of Object.entries(row || {}))
    if (['buyer', 'buyername'].includes(key.toLowerCase().replace(/[^a-z0-9]/g, '')) && String(value ?? '').trim()) return String(value).trim();
  return '';
}

export function dyeableBuyerChoices(): string[] {
  const choices = new Map<string, string>();
  for (const row of Object.values(getStoredDatasets().genInfo || {})) {
    const buyer = generalInfoBuyer(row);
    if (buyer && !choices.has(constructionKey(buyer))) choices.set(constructionKey(buyer), buyer);
  }
  return Array.from(choices.values()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function dyeableConfirmedScopes(): { booking: Row; floor: string | null; filterFloor: string | null }[] {
  const scopes: { booking: Row; floor: string | null; filterFloor: string | null }[] = [];
  for (const booking of getStoredMasterList()) {
    if (booking.status === 'Confirm' && booking.confirmedSnapshot) {
      // A whole-order confirmation owns its complete approved sequence. Imports
      // can create inherited floor records; they must not replace or duplicate it.
      const sourceFloors = new Set<string>((booking.confirmedSnapshot.sourceRows || []).map(knittingRowFloor).filter(Boolean));
      scopes.push({ booking, floor: null, filterFloor: sourceFloors.size === 1 ? Array.from(sourceFloors)[0] : null });
      continue;
    }
    const floors = BATCH_FLOORS.map((floor) => floor.key).filter((floor) => booking.floorPlans?.[floor]?.status === 'Confirm');
    for (const floor of floors) scopes.push({ booking, floor, filterFloor: floor });
    // Older plans confirmed from All Orders have one saved report, not a newly
    // generated copy for every floor. Include that approved sequence only once.
    if (!floors.length && booking.status === 'Confirm') {
      const sourceFloors = new Set<string>((booking.confirmedSnapshot?.sourceRows || []).map(knittingRowFloor).filter(Boolean));
      scopes.push({ booking, floor: null, filterFloor: sourceFloors.size === 1 ? Array.from(sourceFloors)[0] : null });
    }
  }
  return scopes;
}

export function dyeableMachineLabel(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  const object = value as Row;
  const label = String(object.label || object.machineLabel || '').trim();
  if (label) return label;
  const brand = String(object.mcBrand ?? '').trim(),
    number = String(object.mcNo ?? '').trim();
  return brand || number ? brand + '-' + number : '';
}

export function savedDyeableMachineDetails(row: Row, data: Row, saved: Row, totalKg: number | null): Row {
  if (row.assignmentError && !dyeableMachineLabel(row.machineLabel) && !dyeableMachineLabel(row.machine))
    return { machine: '', loading: '', nozzle: '', machineRecovered: false, machineNote: String(row.assignmentError) };
  const has = (value: unknown): boolean => value !== null && value !== undefined && String(value).trim() !== '';
  const same = (other: Row): boolean =>
    String(other.id ?? other.batchNo ?? '') === String(row.id) && (!other.shade || colourSelectionKey(other.shade) === colourSelectionKey(row.shade));
  const legacy: Row | undefined = (saved.batches || []).find(same),
    groups: Row[] = (data.evaluations || []).filter((value: Row) => colourSelectionKey(value.shade) === colourSelectionKey(row.shade));
  const group: Row | null =
    groups.find((value) => value.sourceRows?.some(same)) ||
    groups.find((value) => machineEvaluationKey(value) === machineEvaluationKey(row)) ||
    (groups.length === 1 ? groups[0] : null);
  const source: Row | undefined = group?.sourceRows?.find(same);
  const machineId = row.machineId ?? source?.machineId ?? null;
  let config: Row | null | undefined =
    machineId !== null ? (group?.rows || []).find((value: Row) => String(value.id ?? value.machine?.id) === String(machineId)) : null;
  const existingLabel =
    dyeableMachineLabel(row.machineLabel) ||
    dyeableMachineLabel(row.machine) ||
    dyeableMachineLabel(source?.machineLabel) ||
    dyeableMachineLabel(source?.machine);
  if (!config && existingLabel)
    config = (group?.rows || []).find((value: Row) => constructionKey(dyeableMachineLabel(value.machine)) === constructionKey(existingLabel));
  // Recover an applied configuration only when older source rows have no row
  // assignments. A deliberately unassigned row in a mixed group stays unassigned.
  if (!config && !existingLabel) {
    const applied: Row[] = (group?.rows || []).filter((value: Row) => value.applied === true);
    const assignedSource = group?.sourceRows?.some(
      (value: Row) => has(value.machineId) || dyeableMachineLabel(value.machineLabel) || dyeableMachineLabel(value.machine)
    );
    if (applied.length === 1 && !assignedSource) config = applied[0];
  }
  const machine: Row | undefined = [row.machine, source?.machine, legacy?.machine, config?.machine].find((value) => value && typeof value === 'object');
  const label =
    existingLabel || dyeableMachineLabel(legacy?.machineLabel) || dyeableMachineLabel(legacy?.machine) || dyeableMachineLabel(machine);
  const capacity = [row.machineCapacityKg, row.machineCapacity, machine?.capacityKg, machine?.capacity, config?.capacityKg]
    .map(fabricQuantity)
    .find((value) => (value as number) > 0) as number | undefined;
  let loading = [row.loading, source?.loading, legacy?.loading].find(has),
    nozzle = [row.nozzle, source?.nozzle, legacy?.nozzle].find(has);
  if (!has(loading) && label && (capacity as number) > 0 && totalKg !== null)
    loading = String(Number(((totalKg / (capacity as number)) * 100).toFixed(2))) + '%';
  if (!has(nozzle) && label && (capacity as number) > 0) nozzle = machineNozzles(capacity as number);
  return {
    machine: label,
    loading: has(loading) ? String(loading) : '',
    nozzle: has(nozzle) ? String(nozzle) : '',
    machineRecovered: !!label && (!dyeableMachineLabel(row.machineLabel) || !has(row.loading) || !has(row.nozzle)),
  };
}

export function collectDyeableBatches(): { rows: Row[]; warnings: string[] } {
  const result: Row[] = [],
    warnings: string[] = [];
  const generalInfo = new Map<string, Row>(
    Object.entries(getStoredDatasets().genInfo || {}).map(([key, value]) => [normalizeBookingKey(key) as string, value])
  );
  for (const { booking, floor, filterFloor } of dyeableConfirmedScopes()) {
    const saved = savedReportPlan(booking, floor),
      data = saved.confirmedSnapshot?.reportData || captureConfirmedReport(booking, floor, { useDraft: false });
    const fabrics: Row[] = data.fabrics || [],
      rows: Row[] = data.rows || [],
      components = data.components || [];
    const readiness = evaluateKnittingReadiness(booking, floor, fabrics, rows, components);
    const componentQuantities = componentFabricDisplayQuantities(rows, fabrics, booking, floor, components);
    const buyer =
      generalInfoBuyer(generalInfo.get(normalizeBookingKey(booking.number))) || saved.confirmedSnapshot?.headerData?.buyer || booking.buyer || '';
    if (data.truncated)
      warnings.push(
        'Order ' + booking.number + (floor ? ' · ' + floorLabel(floor) : '') + ': the confirmed report contains a limited batch sequence. Only saved rows are included.'
      );
    rows.forEach((row, index) => {
      const quantities = fabrics.map((fabric) => {
        const value = fabric.componentKind
          ? componentQuantities.get(JSON.stringify([String(row.id), colourSelectionKey(row.shade), fabric.key]))
          : row.quantities?.[fabric.key];
        return {
          quantity: (value === null ? null : fabricQuantity(value) || 0) as number | null,
          type: fabric.type || '',
          gsm: fabric.gsm || '',
          componentKind: fabric.componentKind || '',
        };
      });
      const totalKg: number | null =
        row.totalKg === null
          ? null
          : fabricQuantity(row.totalKg) ??
            (quantities.some((value) => value.quantity === null) ? null : productionSum(quantities.map((value) => value.quantity || 0)));
      const details = savedDyeableMachineDetails(row, data, saved, totalKg);
      result.push({
        number: booking.number,
        floor: filterFloor,
        id: String(row.id ?? ''),
        shade: String(row.shade ?? ''),
        ld: String(row.ld ?? ''),
        reference: String(row.reference ?? ''),
        buyer: String(buyer),
        fabrics: quantities,
        totalKg,
        fabrication: quantities
          .filter((value) => value.quantity === null || value.quantity > 0)
          .map((value) => value.type)
          .filter(Boolean)
          .join('-'),
        knit: readiness[index],
        ...details,
        revision: revisionLabel(saved.confirmedSnapshot?.revisionNo) || '',
      });
    });
  }
  return { rows: result, warnings };
}

export function dyeableFilterIsAll(value: unknown): boolean {
  return value === DYEABLE_ALL || value === undefined || value === null;
}

export function dyeableFilterMatches(value: unknown, item: unknown): boolean {
  return dyeableFilterIsAll(value) || (Array.isArray(value) ? value : [value]).includes(item);
}

export function dyeableMachineKey(row: Row): string {
  return constructionKey(row.machine) || DYEABLE_UNASSIGNED;
}

export function filterDyeableBatches(source: { rows: Row[]; warnings: string[] }, filters: Row): Row {
  const rows = source.rows.filter(
    (row) =>
      dyeableFilterMatches(filters.floor, row.floor) &&
      dyeableFilterMatches(filters.buyer, constructionKey(row.buyer)) &&
      dyeableFilterMatches(filters.machine, dyeableMachineKey(row)) &&
      dyeableFilterMatches(filters.labdip, row.ld.trim() ? 'Yes' : 'No') &&
      dyeableFilterMatches(filters.knit, row.knit?.kind === 'ready' ? 'Knit ok' : 'Not Knit ok')
  );
  return {
    rows,
    warnings: source.warnings.slice(),
    filters: copyReportData(filters),
    fabricCount: rows.reduce((count, row) => Math.max(count, row.fabrics.length), 1),
    generatedAt: new Date().toISOString(),
  };
}

/* ---------- Dyeable filters dialog ---------- */

function filterSelections(): Record<string, DyeableSelection> {
  return (S.dyeableFilterContext as Row).selections;
}

/** Sets the choices of a multi-select (the old function also wrote the checkboxes; the dialog renders them). */
export function dyeableMultiOptions(key: string, choices: [string, string][], selected: unknown = DYEABLE_ALL): void {
  const all = dyeableFilterIsAll(selected),
    values = new Set<string>(
      all
        ? choices.map(([value]) => value)
        : (Array.isArray(selected) ? selected : [selected]).filter((value) => choices.some(([option]) => option === value))
    );
  filterSelections()[key] = { all, values, choices };
  syncDyeableMulti(key);
}

export function dyeableMultiValue(key: string): string | string[] {
  const state = S.dyeableFilterContext?.selections[key] as DyeableSelection | undefined;
  return !state || state.all ? DYEABLE_ALL : Array.from(state.values);
}

/** Old syncDyeableMulti wrote the caption and the checkbox states; the dialog derives them from the selection
    (dyeableMultiCaption, dyeableChoiceChecked), so this only tells the screen. */
export function syncDyeableMulti(key: string): void {
  const state = S.dyeableFilterContext?.selections[key];
  if (!state) return;
  notify();
}

/** Caption of a multi-select's summary (old [data-multi-caption] text). */
export function dyeableMultiCaption(key: string): string {
  const state = S.dyeableFilterContext?.selections[key] as DyeableSelection | undefined;
  if (!state) return 'All';
  const labels = state.choices.filter(([value]) => state.values.has(value)).map(([, label]) => label);
  return state.all ? 'All' : !labels.length ? 'None' : labels.length <= 2 ? labels.join(', ') : labels.length + ' selected';
}

/** Checked state of a choice (old syncDyeableMulti: input.checked / the All box's indeterminate). */
export function dyeableChoiceChecked(key: string, value: string): { checked: boolean; indeterminate: boolean } {
  const state = S.dyeableFilterContext?.selections[key] as DyeableSelection | undefined;
  if (!state) return { checked: false, indeterminate: false };
  const all = value === DYEABLE_ALL;
  return {
    checked: all ? state.all : state.all || state.values.has(value),
    indeterminate: all && !state.all && state.values.size > 0,
  };
}

export function updateDyeableMachineChoices(): void {
  const context = S.dyeableFilterContext;
  if (!context) return;
  const floors = dyeableMultiValue('floor'),
    previous = dyeableMultiValue('machine'),
    choices = new Map<string, string>();
  const add = (value: unknown): void => {
    const label = String(value ?? '').trim();
    if (label && label !== '-' && !choices.has(constructionKey(label))) choices.set(constructionKey(label), label);
  };
  const floorAllowed = (floor: unknown): boolean => dyeableFilterMatches(floors, floor);
  for (const machine of getMachineSetup() as Row[])
    if (
      String(machine.mcType || '').trim().toUpperCase() === 'BULK' &&
      (dyeableFilterIsAll(floors) ||
        (Array.isArray(floors) ? floors : [floors]).some((floor) => machineFloorsForMenu(floor).includes(normalizeFloor(machine.floor) as string)))
    )
      add(String(machine.mcBrand ?? '').trim() + '-' + String(machine.mcNo ?? '').trim());
  for (const row of context.source.rows as Row[])
    if (floorAllowed(row.floor)) {
      if (row.machine) add(row.machine);
      else choices.set(DYEABLE_UNASSIGNED, 'Not assigned');
    }
  dyeableMultiOptions(
    'machine',
    Array.from(choices, ([key, label]) => [key, label] as [string, string]).sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true })),
    previous
  );
}

/** A checkbox of the filters dialog changed (old #dyeableFiltersForm change listener). */
export function toggleDyeableChoice(key: string, value: string, checked: boolean): void {
  if (!S.dyeableFilterContext) return;
  const state = filterSelections()[key];
  if (!state) return;
  if (value === DYEABLE_ALL) {
    state.all = checked;
    state.values = new Set(checked ? state.choices.map(([value]) => value) : []);
  } else {
    if (checked) state.values.add(value);
    else state.values.delete(value);
    state.all = state.choices.length > 0 && state.choices.every(([value]) => state.values.has(value));
  }
  syncDyeableMulti(key);
  if (key === 'floor') updateDyeableMachineChoices();
}

export function openDyeableFilters(mode: string = 'detail'): boolean {
  mode = mode === 'summary' ? 'summary' : 'detail';
  if (!S.storageReady) {
    toast('Wait until saved data is ready before opening the report.');
    return false;
  }
  if (S.mutationBusy) {
    toast('Please wait for the current save to finish.');
    return false;
  }
  try {
    const filters = mode === 'summary' ? S.dyeableSummaryFilters : S.dyeableReportFilters;
    // returnFocus: the dialog component keeps the element that had the focus (no DOM in the engine).
    S.dyeableFilterContext = { source: collectDyeableBatches(), returnFocus: null, mode, selections: {}, error: '' };
    S.ui.reportsDyeableRestoreFocus = false;
    dyeableMultiOptions('knit', [['Knit ok', 'Knit ok'], ['Not Knit ok', 'Not Knit ok']], filters.knit);
    dyeableMultiOptions('labdip', [['Yes', 'Yes'], ['No', 'No']], filters.labdip);
    dyeableMultiOptions('buyer', dyeableBuyerChoices().map((buyer) => [constructionKey(buyer), buyer] as [string, string]), filters.buyer);
    dyeableMultiOptions('floor', Object.entries(DYEABLE_FLOOR_LABELS), filters.floor);
    filterSelections().machine = {
      all: dyeableFilterIsAll(filters.machine),
      values: new Set(Array.isArray(filters.machine) ? filters.machine : dyeableFilterIsAll(filters.machine) ? [] : [filters.machine]),
      choices: [],
    };
    updateDyeableMachineChoices();
    S.dyeableFilterContext.error = '';
    notify();
    return true;
  } catch (error) {
    S.dyeableFilterContext = null;
    notify();
    toast('Could not prepare the report: ' + errorMessage(error));
    return false;
  }
}

export function closeDyeableFilters(restoreFocus = true): void {
  const context = S.dyeableFilterContext;
  S.dyeableFilterContext = null;
  // The dialog closes its <details> with it and gives the focus back when this is true.
  S.ui.reportsDyeableRestoreFocus = !!(context && restoreFocus);
  notify();
}

export function previewDyeableReport(): boolean {
  if (!S.dyeableFilterContext || !S.storageReady || S.mutationBusy) return false;
  const filters: Row = Object.fromEntries(Object.keys(DYEABLE_FILTER_IDS).map((key) => [key, dyeableMultiValue(key)])),
    mode = S.dyeableFilterContext.mode as 'detail' | 'summary';
  try {
    const result = filterDyeableBatches(collectDyeableBatches(), filters);
    S.dyeableReportMode = mode;
    if (mode === 'summary') {
      S.dyeableSummaryFilters = filters;
      S.dyeableSummaryResult = result;
      S.ui.reportsSummaryExportStatus = '';
    } else {
      S.dyeableReportFilters = filters;
      S.dyeableReportResult = result;
      S.ui.reportsExportStatus = '';
    }
    followPreview(mode);
    switchMainView('reports');
    renderDyeableReport();
    return true;
  } catch (error) {
    if (S.dyeableFilterContext) S.dyeableFilterContext.error = 'Could not preview the report: ' + errorMessage(error);
    notify();
    return false;
  }
}

export function dyeableFilterSummary(filters: Row): string {
  const buyers = new Map(dyeableBuyerChoices().map((value) => [constructionKey(value), value]));
  const machines = new Map(
    [...(S.dyeableReportResult?.rows || []), ...(S.dyeableSummaryResult?.rows || [])]
      .filter((row: Row) => row.machine)
      .map((row: Row) => [constructionKey(row.machine), row.machine])
  );
  const label = (value: unknown, key: string): string => {
    if (dyeableFilterIsAll(value)) return 'All';
    const values = Array.isArray(value) ? value : [value];
    return values.length
      ? values
          .map((item) =>
            key === 'floor'
              ? DYEABLE_FLOOR_LABELS[item] || item
              : key === 'buyer'
                ? buyers.get(item) || item
                : key === 'machine'
                  ? item === DYEABLE_UNASSIGNED
                    ? 'Not assigned'
                    : machines.get(item) || item
                  : item
          )
          .join(', ')
      : 'None';
  };
  return Object.entries({ knit: 'Knit Status', labdip: 'Labdip', buyer: 'Buyer', floor: 'Floor', machine: 'MC Number' })
    .map(([key, title]) => title + ': ' + label(filters[key], key))
    .join(' · ');
}

/* ---------- Dyeable Batch report ---------- */

export function dyeableReportHeaders(count: number): string[] {
  return [
    'Batch #',
    'Shade',
    'Lapdip Number',
    'Reference',
    'Buyer',
    ...Array.from({ length: count }, (_, index) => 'Fabric ' + (index + 1)),
    'Total batch Qty (kg)',
    'Fabrication',
    'Knit Status',
    'Loading',
    'M/C nozzle',
    'MC Number',
  ];
}

/** Shows the report of S.dyeableReportMode. The panels are drawn by components/reports from the results in S
    (the old function wrote them as HTML). */
export function renderDyeableReport(): void {
  if (S.dyeableReportMode === 'daily') {
    renderDailyConfirmReport();
    return;
  }
  if (S.dyeableReportMode === 'summary') {
    renderDyeableSummary();
    return;
  }
  notify();
}

export function buildDyeableWorkbook(reader: ExcelReader, result: Row): WorkBook {
  const headers = dyeableReportHeaders(result.fabricCount);
  const values: unknown[][] = [
    headers,
    ...(result.rows as Row[]).map((row) => {
      const percentage = fabricQuantity(row.loading.replace(/%\s*$/, '')) as number | null;
      return [
        row.id,
        row.shade,
        row.ld,
        row.reference,
        row.buyer,
        ...Array.from({ length: result.fabricCount }, (_, index) => {
          const fabric = row.fabrics[index];
          return !fabric ? '' : fabric.quantity === null ? 'Weight missing' : fabric.quantity;
        }),
        row.totalKg === null ? 'Weight missing' : row.totalKg,
        row.fabrication || '',
        row.knit?.label || '',
        percentage === null ? 'Not available' : percentage / 100,
        fabricQuantity(row.nozzle) ?? (row.nozzle || 'Not available'),
        row.machine || 'Not assigned',
      ];
    }),
  ];
  const sheet = reader.utils.aoa_to_sheet(values),
    count: number = result.fabricCount;
  sheet['!cols'] = [
    { wch: 19 },
    { wch: 23 },
    { wch: 19 },
    { wch: 24 },
    { wch: 24 },
    ...Array.from({ length: count }, () => ({ wch: 15 })),
    { wch: 24 },
    { wch: 46 },
    { wch: 44 },
    { wch: 14 },
    { wch: 15 },
    { wch: 25 },
  ];
  sheet['!rows'] = [{ hpt: 30 }];
  sheet['!autofilter'] = { ref: sheet['!ref'] as string };
  for (let row = 1; row < values.length; row++) {
    for (let col = 5; col <= 5 + count; col++) {
      const cell = sheet[reader.utils.encode_cell({ r: row, c: col })];
      if (cell?.t === 'n') cell.z = '#,##0.000';
    }
    const loading = sheet[reader.utils.encode_cell({ r: row, c: 8 + count })];
    if (loading?.t === 'n') loading.z = '0.00%';
  }
  const workbook = reader.utils.book_new();
  reader.utils.book_append_sheet(workbook, sheet, 'Dyeable Batch');
  workbook.Props = { Title: 'Dyeable Batch', Subject: dyeableFilterSummary(result.filters), Author: currentUsername() };
  return workbook;
}

export async function downloadDyeableReport(mode: string = 'detail'): Promise<boolean> {
  mode = mode === 'summary' ? 'summary' : 'detail';
  const summary = mode === 'summary',
    result = summary ? S.dyeableSummaryResult : S.dyeableReportResult,
    status = summary ? 'reportsSummaryExportStatus' : 'reportsExportStatus';
  if (S.dyeableExportBusy || !result || (!summary && !result.rows.length)) return false;
  S.dyeableExportBusy = true;
  S.ui[status] = 'Preparing Excel…';
  notify();
  try {
    const reader = await ensureExcelReader(),
      workbook = summary ? buildDyeableSummaryWorkbook(reader, result) : buildDyeableWorkbook(reader, result);
    const filename =
      (summary ? 'Dyeable_Batch_Summary_' : 'Dyeable_Batch_') + result.generatedAt.replace(/[-:]/g, '').replace('T', '_').slice(0, 15) + '.xlsx';
    reader.writeFile(workbook, filename, { bookType: 'xlsx', compression: true });
    S.ui[status] = 'Excel download prepared.';
    return true;
  } catch (error) {
    S.ui[status] = 'Excel download failed: ' + errorMessage(error) + '. Your report is still available; try again.';
    return false;
  } finally {
    // The download buttons follow S.dyeableExportBusy and the results (old: their disabled flags were reset here).
    S.dyeableExportBusy = false;
    notify();
  }
}

/* ---------- Dyeable Batch Summary ---------- */

export function dyeableFloorTotalLabel(floor: Row): string {
  return floor.label + (['EFL', 'EKL', 'EXT'].includes(floor.floor) ? ' Floor' : '') + ' Total';
}

export function emptyDyeableSummaryCells(): DyeableSummaryCell[] {
  return Array.from({ length: 3 }, () => ({ count: 0, quantity: 0, missing: 0 }));
}

export function dyeableSummaryCriterion(row: Row): number {
  return row.knit?.kind === 'ready' ? (row.ld.trim() ? 0 : 1) : row.ld.trim() ? 2 : -1;
}

export function buildDyeableSummary(result: Row): { floors: Row[]; excluded: number } {
  // Project (plan section 16.3): a batch confirmed on a unit that is no longer in the list keeps its own group.
  const labels: Record<string, string> = { ...DYEABLE_FLOOR_LABELS };
  for (const row of result.rows as Row[]) if (row.floor && !labels[row.floor]) labels[row.floor] = floorLabel(row.floor);
  const selectedFloors: (string | null)[] = Object.keys(labels).filter((floor) => dyeableFilterMatches(result.filters.floor, floor));
  if ((result.rows as Row[]).some((row) => !row.floor)) selectedFloors.push(null);
  const floors: Row[] = selectedFloors.map((floor) => ({
    floor,
    label: (floor !== null && labels[floor]) || 'Multiple / unassigned',
    buyers: [],
    totals: emptyDyeableSummaryCells(),
  }));
  let excluded = 0;
  for (const row of result.rows as Row[]) {
    const group = floors.find((group) => group.floor === row.floor);
    if (!group) continue;
    const key = constructionKey(row.buyer);
    let buyer = (group.buyers as Row[]).find((buyer) => buyer.key === key);
    if (!buyer) {
      buyer = { key, buyer: row.buyer || 'Buyer not specified', cells: emptyDyeableSummaryCells() };
      group.buyers.push(buyer);
    }
    const criterion = dyeableSummaryCriterion(row);
    if (criterion < 0) {
      excluded++;
      continue;
    }
    for (const cells of [buyer.cells, group.totals] as DyeableSummaryCell[][]) {
      const cell = cells[criterion];
      cell.count++;
      if (row.totalKg === null) cell.missing++;
      else cell.quantity = productionSum([cell.quantity, row.totalKg]);
    }
  }
  for (const floor of floors) (floor.buyers as Row[]).sort((a, b) => a.buyer.localeCompare(b.buyer, undefined, { numeric: true }));
  return { floors, excluded };
}

export function dyeableSummaryQuantity(cell: DyeableSummaryCell, excel = false): string | number {
  return cell.missing
    ? (cell.quantity ? kgText(cell.quantity) + ' + ' : '') + 'Weight missing (' + cell.missing + ')'
    : excel
      ? cell.quantity
      : kgText(cell.quantity);
}

export function dyeablePrintedAt(value: unknown): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_SETTINGS.correctionTimeZone || 'Asia/Dhaka',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).formatToParts(new Date(value as string | number | Date));
  const p: Record<string, string> = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return p.day + '-' + p.month + '-' + p.year + ' ' + p.hour + ':' + p.minute + ':' + p.second + ' ' + p.dayPeriod.toUpperCase();
}

/** The summary panel is drawn from S.dyeableSummaryResult; its timestamp shows the preview time again. */
export function renderDyeableSummary(): void {
  S.ui.reportsSummaryPrintedAt = S.dyeableSummaryResult ? S.dyeableSummaryResult.generatedAt : null;
  notify();
}

export function buildDyeableSummaryWorkbook(reader: ExcelReader, result: Row): WorkBook {
  const summary = buildDyeableSummary(result),
    values: unknown[][] = [
      ['Dyeable Live Batch Status'],
      [dyeableFilterSummary(result.filters)],
      ['Criteria', '', ...DYEABLE_SUMMARY_CRITERIA.flatMap((label) => [label, ''])],
      ['Floor', 'Buyer', ...Array(3).fill(['No of Batch', 'Dyeable qty (kg)']).flat()],
    ],
    merges: Range[] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
      ...[2, 4, 6].map((c) => ({ s: { r: 2, c }, e: { r: 2, c: c + 1 } })),
    ];
  const rowCells = (cells: DyeableSummaryCell[]): unknown[] => cells.flatMap((cell) => [cell.count, dyeableSummaryQuantity(cell, true)]);
  for (const floor of summary.floors) {
    const start = values.length,
      buyers: Row[] = floor.buyers.length ? floor.buyers : [{ buyer: '—', cells: emptyDyeableSummaryCells() }];
    buyers.forEach((buyer, index) => values.push([index === 0 ? floor.label : '', buyer.buyer, ...rowCells(buyer.cells)]));
    if (buyers.length > 1) merges.push({ s: { r: start, c: 0 }, e: { r: values.length - 1, c: 0 } });
    merges.push({ s: { r: values.length, c: 0 }, e: { r: values.length, c: 1 } });
    values.push([dyeableFloorTotalLabel(floor), '', ...rowCells(floor.totals)]);
  }
  values.push([]);
  const footer = values.length;
  values.push(['Printed Date & Time: ' + dyeablePrintedAt(result.generatedAt), '', '', '', 'This is the PMC internal ERP System Generated Report']);
  merges.push({ s: { r: footer, c: 0 }, e: { r: footer, c: 3 } }, { s: { r: footer, c: 4 }, e: { r: footer, c: 7 } });
  if (summary.excluded) {
    merges.push({ s: { r: values.length, c: 0 }, e: { r: values.length, c: 7 } });
    values.push([summary.excluded + ' batch(es) with both knitting and labdip pending are outside the displayed criteria.']);
  }
  const sheet = reader.utils.aoa_to_sheet(values);
  sheet['!merges'] = merges;
  sheet['!cols'] = [{ wch: 20 }, { wch: 28 }, ...Array.from({ length: 3 }, () => [{ wch: 17 }, { wch: 21 }]).flat()];
  sheet['!rows'] = [{ hpt: 30 }, { hpt: 30 }, { hpt: 28 }, { hpt: 26 }];
  for (let row = 4; row < footer; row++)
    for (const col of [3, 5, 7]) {
      const cell = sheet[reader.utils.encode_cell({ r: row, c: col })];
      if (cell?.t === 'n') cell.z = '#,##0.000';
    }
  const workbook = reader.utils.book_new();
  reader.utils.book_append_sheet(workbook, sheet, 'Dyeable Batch Summary');
  workbook.Props = { Title: 'Dyeable Live Batch Status', Subject: dyeableFilterSummary(result.filters), Author: currentUsername() };
  return workbook;
}

/** Print / Save PDF of the summary with the print time as 'Printed Date & Time'.
    `flush` (new, optional): the component passes React's flushSync, so the new time is on screen before the
    print dialog opens (the old code wrote the text straight into the page). */
export function printDyeableSummary(flush: (update: () => void) => void = (update) => update()): void {
  if (!S.dyeableSummaryResult) return;
  flush(() => {
    S.ui.reportsSummaryPrintedAt = new Date().toISOString();
    notify();
  });
  printWithBodyClass('printing-dyeable-summary');
}

export function generalPlanTimestamp(booking: Row, floor: string | null, revised = false): string {
  const plan = savedReportPlan(currentReportBooking() || booking, floor);
  const value = revised ? plan.batchPlanRevisedAt || plan.lastReconfirmation?.savedAt : plan.batchPlanCreatedAt || plan.confirmationHistory?.[0]?.confirmedAt;
  return value ? dyeablePrintedAt(value) : (revised ? booking.revisedBatch : booking.batchDate) || '';
}

/* ---------- Daily Confirm Batch Plan ---------- */

export function dailyConfirmDay(value: unknown): string {
  const date = new Date(value as string | number | Date);
  if (!Number.isFinite(date.getTime())) return '';
  const parts: Record<string, string> = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: APP_SETTINGS.correctionTimeZone || 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return parts.year + '-' + parts.month + '-' + parts.day;
}

export function dailyConfirmRevision(value: unknown): string {
  const n = Number(value) || 0;
  if (!n) return 'Main';
  const last = n % 100,
    suffix = last >= 11 && last <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return n + suffix + ' Revise';
}

export function dailyConfirmationSource(): Row[] {
  const records: Row[] = [];
  for (const booking of getStoredMasterList()) {
    const scopes: [string, Row][] = [...Object.entries((booking.floorPlans || {}) as Record<string, Row>)];
    if (booking.confirmationHistory?.length || booking.status === 'Confirm') scopes.push(['', booking]);
    for (const [floor, plan] of scopes) {
      for (const event of (plan.confirmationHistory || []) as Row[])
        records.push({ ...copyReportData(event), floor, number: event.number || booking.number, legacy: false });
      if (!(plan.confirmationHistory || []).length && plan.status === 'Confirm' && plan.lastSaveAt) {
        const header = plan.confirmedSnapshot?.headerData || booking;
        records.push({
          number: booking.number,
          buyer: header.buyer || '',
          unit: header.unit || '',
          floor,
          revisionNo: plan.confirmedSnapshot?.revisionNo ?? 0,
          confirmedAt: plan.confirmedAt || plan.lastSaveAt,
          confirmedBy: plan.confirmedBy || '',
          fromStatus: plan.confirmedFromStatus || 'Unknown',
          legacy: !plan.confirmedAt || !plan.confirmedFromStatus,
        });
      }
    }
  }
  return records;
}

export function buildDailyConfirmReport(filters: Row): Row {
  const { from, to, route, floor, buyer } = filters;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw new Error('Select a valid From–To date range.');
  const rows = dailyConfirmationSource()
    .filter((row) => {
      const day = dailyConfirmDay(row.confirmedAt);
      return (
        day &&
        day >= from &&
        day <= to &&
        (route === 'Both' || row.fromStatus === route) &&
        (floor === 'All' || row.floor === floor) &&
        (buyer === 'All' || row.buyer === buyer)
      );
    })
    .sort(
      (a, b) =>
        new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime() ||
        String(a.number).localeCompare(String(b.number), undefined, { numeric: true }) ||
        a.floor.localeCompare(b.floor)
    );
  return { rows, filters: copyReportData(filters), generatedAt: new Date().toISOString() };
}

export function closeDailyConfirmFilters(): void {
  S.ui.reportsDailyFilters = null;
  notify();
}

/** Opens the Daily Confirm filters with the last preview's filters (or today), as before. A value that is no
    longer one of the choices shows the first choice, as the old <select> did. */
export function openDailyConfirmFilters(): boolean {
  if (!S.storageReady) {
    toast('Storage is not ready.');
    return false;
  }
  const filters = S.dailyConfirmResult?.filters || {
    from: dailyConfirmDay(new Date()),
    to: dailyConfirmDay(new Date()),
    route: 'Both',
    floor: 'All',
    buyer: 'All',
  };
  const buyers: string[] = Array.from(
    new Set<string>([...getStoredMasterList().map((b) => b.buyer), ...dailyConfirmationSource().map((row) => row.buyer)].filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const form: DailyConfirmForm = {
    from: filters.from,
    to: filters.to,
    route: ['Both', 'Pending', 'Tentative'].includes(filters.route) ? filters.route : 'Both',
    floor: BATCH_FLOORS.some((f) => f.key === filters.floor) ? filters.floor : 'All',
    buyer: buyers.includes(filters.buyer) ? filters.buyer : 'All',
    buyers,
    error: '',
  };
  S.ui.reportsDailyFilters = form;
  notify();
  return true;
}

/** An input of the Daily Confirm filters dialog changed (the dialog's inputs are controlled). */
export function setDailyConfirmFilter(field: 'from' | 'to' | 'route' | 'floor' | 'buyer', value: string): void {
  const form = S.ui.reportsDailyFilters as DailyConfirmForm | null;
  if (!form) return;
  form[field] = value;
  notify();
}

export function previewDailyConfirmReport(): boolean {
  const form = S.ui.reportsDailyFilters as DailyConfirmForm | null;
  if (!form) return false;
  try {
    const result = buildDailyConfirmReport({ from: form.from, to: form.to, route: form.route, floor: form.floor, buyer: form.buyer });
    S.dailyConfirmResult = result;
    closeDailyConfirmFilters();
    S.dyeableReportMode = 'daily';
    followPreview('daily');
    switchMainView('reports');
    return true;
  } catch (error) {
    form.error = errorMessage(error);
    notify();
    return false;
  }
}

export function dailyConfirmCells(row: Row): unknown[] {
  return [row.number, row.buyer, row.unit, dailyConfirmRevision(row.revisionNo), dyeablePrintedAt(row.confirmedAt), row.confirmedBy];
}

/** The Daily Confirm panel is drawn from S.dailyConfirmResult (components/reports). */
export function renderDailyConfirmReport(): void {
  notify();
}

export async function downloadDailyConfirmReport(): Promise<void> {
  const result = S.dailyConfirmResult;
  if (!result?.rows.length) return;
  try {
    const reader = await ensureExcelReader(),
      values: unknown[][] = [
        DAILY_CONFIRM_HEADERS,
        ...(result.rows as Row[]).map(dailyConfirmCells),
        [],
        ['Date range: ' + result.filters.from + ' to ' + result.filters.to],
        ...((result.rows as Row[]).some((row) => row.legacy)
          ? [['Older records: original confirmation route is unknown; these appear under Both. Last saved date is used if confirmation date is unavailable.']]
          : []),
      ],
      sheet = reader.utils.aoa_to_sheet(values);
    sheet['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 24 }, { wch: 24 }, { wch: 32 }, { wch: 26 }];
    const workbook = reader.utils.book_new();
    reader.utils.book_append_sheet(workbook, sheet, 'Daily Confirm Batch Plan');
    reader.writeFile(workbook, 'Daily_Confirm_Batch_Plan_' + result.filters.from + '_to_' + result.filters.to + '.xlsx');
  } catch (error) {
    toast(errorMessage(error));
  }
}

/** Print / Save PDF of the Daily Confirm report (old #dailyConfirmPrint). */
export function printDailyConfirmReport(): void {
  printWithBodyClass('printing-daily-confirm');
}

/* ---------- route ---------- */

/* A preview moves the page to /batch/report/<mode> through switchMainView('reports'). That route then shows the
   report without opening its filters dialog again (the old switchMainView changed the view, not the route). */
let previewRouteKind: BatchReportKind | null = null;

function followPreview(mode: BatchReportKind): void {
  if (S.ui.reportsRouteKind !== mode) previewRouteKind = mode;
}

/** The state part of the old switchMainView('reports') (the route already is /batch/report/<kind>). */
function showReportsView(): void {
  closeDailyConfirmFilters();
  closeDyeableFilters(false);
  renderDyeableReport();
}

/** The old BatchApi.route() rule for 'report/detail|summary|daily': show the report and open its filters
    dialog. The route component runs it once the data has loaded, and again when the sidebar re-opens the page. */
export function showReportRoute(kind: BatchReportKind): void {
  S.ui.reportsRouteKind = kind;
  if (previewRouteKind === kind) {
    previewRouteKind = null;
    S.dyeableReportMode = kind;
    renderDyeableReport();
    return;
  }
  previewRouteKind = null;
  if (kind === 'daily') {
    S.dyeableReportMode = 'daily';
    showReportsView();
    openDailyConfirmFilters();
    return;
  }
  const mode = kind === 'summary' ? 'summary' : 'detail';
  S.dyeableReportMode = mode;
  showReportsView();
  openDyeableFilters(mode);
}
