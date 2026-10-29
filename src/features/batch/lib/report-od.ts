/* Batch Plan report: OD BP (re-exported by report-model.ts).
   OD BP is an explicit manual batch-count override for Semi Bleach only. Port of the old
   js/batch/batch-app.js OD functions; the rules are unchanged. The OD declaration dialog (components/plan/report/ReportDialogs.tsx) keeps
   `S.odDeclarationContext` up to date: its inputs write `context.colours[odBatchIndex]` and
   `context.quantityEdits[rowKey][fabricKey]` on change, so collectODColours()/collectODQuantities() have
   nothing left to read. */
import { BATCH_CALCULATION } from '@/features/batch/constants';
import { S } from '@/features/batch/store/batch-store';
import { setMutationBusy, showSaveError, toast } from './storage';
import {
  GenericMachineSelection,
  batchMass,
  bodyBatchQuantity,
  colourSelectionKey,
  componentRowTotals,
  erpMachineConfigurations,
  fabricQuantity,
  knittingQuantityAtLeast,
  machineFabricsWithComponents,
  machineNozzles,
  productionMultiply,
  productionSum,
} from './batch-calculation';
import { canEditReport } from './bookings';
import { openODDeclaration, refreshEditableReport } from './report-actions';
import { copyReportData, currentReportBooking, renumberReportBatches, reportManualState, retainSavedReportDraft } from './report-model';
import { buildComponentBatches, componentBatchAllocator } from './report-components';
import { isTallBigAccessory } from './report-tall-big';
import type { Row } from '@/features/batch/types';

type Floor = string | null;

export function oneDecimalQty(value: unknown): string {
  const qty = fabricQuantity(value);
  return qty === null ? String(value ?? '') : qty.toFixed(1);
}
export function isODSemiBleach(shade: unknown): boolean {
  return /^(?:semi[\s_-]*bleach|rfd)$/i.test(String(shade ?? '').trim());
}
export function odSettings(kind = 'body', booking: Row | undefined = currentReportBooking(), floor: Floor = S.currentViewingFloor): Row {
  return reportManualState(booking!, floor).odBP?.[kind] || { mode: 'Regular' };
}
export function odRows(kind: string): Row[] {
  return kind === 'body' ? S.currentBatchRows : S.currentComponentSections.find((section) => section.kind === kind)?.rows || [];
}
export function odColumn(kind?: string): boolean {
  return odSettings(kind).mode !== 'Regular';
}
/** Old: read the OD Colour inputs into context.colours. The dialog's inputs now write there on change. */
export function collectODColours(): void {}
/** Old: read the body kg inputs into context.quantityEdits. The dialog's inputs now write there on change. */
export function collectODQuantities(): void {}
export function editedODRows(context: Row): Row[] {
  const automatic = makeODRows(context),
    rows = copyReportData(automatic);
  if (context.kind !== 'body') return rows;
  const fields = S.currentFabricRows.filter((f) => !isTallBigAccessory(f) && !f.componentKind);
  for (const row of rows)
    for (const fabric of fields) {
      const value = context.quantityEdits?.[row.rowKey]?.[fabric.key] ?? row.quantities[fabric.key] ?? 0;
      const qty = String(value).trim() === '' ? 0 : fabricQuantity(value);
      if (qty === null || qty < 0) throw new Error('Enter a non-negative kg quantity for ' + fabric.name + '.');
      row.quantities[fabric.key] = Number(qty.toFixed(1));
    }
  const groupKey = (row: Row) => JSON.stringify([colourSelectionKey(row.shade), row.dyeingGroup, row.peachFinish ?? null, row.tallBig || 'No']),
    groups = new Set(automatic.map(groupKey));
  for (const group of groups)
    for (const fabric of fields) {
      const expected = productionSum(automatic.filter((r) => groupKey(r) === group).map((r) => r.quantities[fabric.key] || 0)),
        actual = productionSum(rows.filter((r) => groupKey(r) === group).map((r) => r.quantities[fabric.key] || 0));
      if ((expected === 0 && actual !== 0) || Math.abs(actual - expected) > 10 + Number.EPSILON * 16 * Math.max(1, Math.abs(expected), Math.abs(actual)))
        throw new Error(
          fabric.name +
            ': declared total ' +
            oneDecimalQty(actual) +
            ' kg must be within ±10 kg of available ' +
            oneDecimalQty(expected) +
            ' kg within the same colour and finish/Tall/Big group.'
        );
    }
  for (const shade of new Set(rows.map((row) => colourSelectionKey(row.shade))))
    for (const fabric of fields) {
      const expected = productionSum(
          context.baseRows.filter((r: Row) => colourSelectionKey(r.shade) === shade).map((r: Row) => r.quantities?.[fabric.key] || 0)
        ),
        actual = productionSum(rows.filter((r) => colourSelectionKey(r.shade) === shade).map((r) => r.quantities[fabric.key] || 0));
      if (!knittingQuantityAtLeast(actual, productionSum([expected, -10])) || !knittingQuantityAtLeast(productionSum([expected, 10]), actual))
        throw new Error(fabric.name + ': this colour’s total must be within ±10 kg of available ' + oneDecimalQty(expected) + ' kg.');
    }
  if (rows.some((row) => !(bodyBatchQuantity(row) > 0))) throw new Error('Each declared batch must have a positive fabric quantity.');
  return rows;
}
export function makeODRows(context: Row): Row[] {
  const { kind, count, baseRows, colours } = context,
    byShade = new Map<string, Row[]>();
  for (const row of baseRows) {
    const key = colourSelectionKey(row.shade);
    if (!byShade.has(key)) byShade.set(key, []);
    byShade.get(key)!.push(row);
  }
  const result: Row[] = [];
  let colourIndex = 0;
  for (const shadeRows of byShade.values()) {
    const partitions = new Map<string, { rows: Row[]; count: number }>();
    for (const row of shadeRows) {
      const key = kind === 'body' ? JSON.stringify([row.dyeingGroup || 'together', row.peachFinish ?? null, row.tallBig || 'No']) : row.tallBig || 'No';
      if (!partitions.has(key)) partitions.set(key, { rows: [], count: 1 });
      partitions.get(key)!.rows.push(row);
    }
    const plans = Array.from(partitions.values());
    if (plans.length > count) throw new Error('Choose at least ' + plans.length + ' batches to preserve this colour’s existing Peach, Dyeing Mode and Tall/Big groups.');
    for (let extra = plans.length; extra < count; extra++) {
      const target = plans
        .slice()
        .sort(
          (a, b) =>
            productionSum(b.rows.map((r) => bodyBatchQuantity(r))) / b.count - productionSum(a.rows.map((r) => bodyBatchQuantity(r))) / a.count
        )[0];
      target.count++;
    }
    for (const plan of plans) {
      const group = plan.rows,
        localCount = plan.count;
      const fabrics = new Map<string, Row[]>();
      for (const row of group) {
        const key = kind === 'body' ? 'body' : String(row.fabricType).toLowerCase();
        if (!fabrics.has(key)) fabrics.set(key, []);
        fabrics.get(key)!.push(row);
      }
      for (let index = 0; index < localCount; index++) {
        for (const entries of fabrics.values()) {
          const first = entries[0],
            keys = new Set(entries.flatMap((row) => Object.keys(row.quantities || {}))),
            quantities: Row = {};
          for (const key of keys) {
            const total = productionSum(entries.map((row) => fabricQuantity(row.quantities?.[key]) || 0));
            quantities[key] = kind === 'body' ? total / localCount : Math.floor(total / localCount) + (index < total % localCount ? 1 : 0);
          }
          const row: Row = {
            ...copyReportData(first),
            id: '',
            rowKey: 'od:' + kind + ':' + colourIndex + ':' + result.length,
            quantities,
            odColour: String(colours[colourIndex] || '').trim(),
            manual: true,
            manualNumber: false,
            odDeclared: true,
            odBatchIndex: colourIndex,
          };
          if (kind === 'body') {
            row.selectionKey = 'od:' + colourSelectionKey(row.shade) + ':' + (first.selectionKey || first.dyeingGroup || '') + ':' + (first.tallBig || 'No');
            row.dyeingGroup = first.dyeingGroup || 'od';
            row.machineId = null;
            row.machineLabel = '';
            row.loading = '';
            row.nozzle = '';
          } else {
            row.weights = {};
            for (const key of keys) {
              const pieces = productionSum(entries.map((r) => r.quantities?.[key] || 0)),
                active = entries.filter((r) => (r.quantities?.[key] || 0) > 0);
              row.weights[key] = active.some((r) => r.weights?.[key] === null || !Number.isFinite(r.weights?.[key]))
                ? null
                : pieces
                  ? productionSum(active.map((r) => productionMultiply(r.quantities[key], r.weights[key]))) / pieces
                  : (first.weights?.[key] ?? null);
            }
            row.bodyBatchId = '';
            row.separate = true;
            componentRowTotals(row);
          }
          result.push(row);
        }
        colourIndex++;
      }
    }
  }
  return result;
}
export function numberODRows(rows: Row[], kind: string, others: Row[]): void {
  if (kind === 'body') {
    renumberReportBatches(rows, S.currentViewingNumber);
    return;
  }
  const occupied = [...S.currentBatchRows, ...S.currentComponentSections.filter((section) => section.kind !== kind).flatMap((section) => section.rows), ...others],
    next = componentBatchAllocator(S.currentViewingNumber, occupied),
    ids = new Map<unknown, string>();
  for (const row of rows) {
    if (!ids.has(row.odBatchIndex)) ids.set(row.odBatchIndex, next());
    row.id = ids.get(row.odBatchIndex);
  }
}
export function assignODMachines(rows: Row[]): void {
  const booking = currentReportBooking(),
    floor = S.currentViewingFloor,
    sections = buildComponentBatches(booking, floor, rows);
  for (const row of rows.filter((item) => item.odDeclared)) {
    const mass: Row = batchMass(row, sections),
      used = machineFabricsWithComponents(
        S.currentFabricRows.filter((f) => !f.componentKind && (row.quantities[f.key] || 0) > 0),
        booking!,
        floor,
        row.shade,
        rows,
        [row]
      );
    if (!(mass.totalKg > 0)) continue;
    try {
      const evaluation = GenericMachineSelection.selectMachine({
          totalQuantityKg: mass.totalKg,
          machines: erpMachineConfigurations(row.shade, floor, used),
          maximumLoadingPercent: BATCH_CALCULATION.defaultMaximumLoadingPercent,
        }),
        selected: Row | undefined = evaluation.evaluations
          .filter((c: Row) => c.eligible && c.batches === 1)
          .sort((a: Row, b: Row) => b.actualLoadingPercent - a.actualLoadingPercent || a.capacityKg - b.capacityKg)[0];
      if (selected) {
        row.machineId = selected.id;
        row.machineLabel = selected.machine.label;
        row.loading = String(Number(selected.actualLoadingPercent.toFixed(2))) + '%';
        row.nozzle = String(machineNozzles(selected.capacityKg));
      }
    } catch (error) {
      if (!(error instanceof GenericMachineSelection.MachineSelectionError)) throw error;
    }
  }
}
/** A section's "OD BP" select (Regular / As Suggested / Need Declaration). */
export async function changeODMode(kind: string, mode: string): Promise<boolean> {
  if (!S.reportDraft || !canEditReport() || S.mutationBusy || !['Regular', 'As Suggested', 'Need Declaration'].includes(mode)) return false;
  if (S.reportRowEditor) {
    toast('Save or cancel the edited row first.');
    refreshEditableReport();
    return false;
  }
  if (mode === 'Need Declaration') {
    const opened = openODDeclaration(kind);
    refreshEditableReport();
    return opened;
  }
  const before = copyReportData(S.reportDraft),
    old = odSettings(kind);
  S.reportDraft.manual.odBP ||= {};
  setMutationBusy(true);
  try {
    if (old.mode === 'Need Declaration' && old.baseRows) {
      restoreODRows(kind, old.baseRows);
    }
    S.reportDraft.manual.odBP[kind] = { mode };
    S.reportDraft.dirty = true;
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
export function replaceODBodyRows(semi: Row[]): void {
  const draft = S.reportDraft!;
  const previous = copyReportData(S.currentBatchRows),
    others = copyReportData(previous.filter((row) => !isODSemiBleach(row.shade))),
    combined = [...semi, ...others];
  for (const row of combined) row.manualNumber = false;
  renumberReportBatches(combined, S.currentViewingNumber);
  const remap = new Map<unknown, unknown>(others.map((row, index) => [previous.filter((r) => !isODSemiBleach(r.shade))[index].id, row.id]));
  for (const rows of Object.values(draft.manual.componentRows || {}) as (Row[] | null)[])
    if (rows) {
      for (const row of rows)
        if (!isODSemiBleach(row.shade)) {
          if (remap.has(row.bodyBatchId)) row.bodyBatchId = remap.get(row.bodyBatchId);
          if (!row.separate && remap.has(row.id)) row.id = remap.get(row.id);
        }
    }
  draft.manual.batchRows = combined;
  // Existing manually edited component pieces remain conserved when body count changes.
  for (const section of S.currentComponentSections) {
    if (odSettings(section.kind).mode === 'Need Declaration') continue;
    const manual: Row[] | null | undefined = draft.manual.componentRows?.[section.kind];
    if (!manual) continue;
    const source: Row[] = section.rows.filter((row: Row) => isODSemiBleach(row.shade)),
      groups = new Map<string, Row[]>();
    for (const row of source) {
      const key = JSON.stringify([colourSelectionKey(row.shade), row.fabricType, row.tallBig || 'No']);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    const revised: Row[] = [];
    for (const entries of groups.values()) {
      const targets = semi.filter((row) => colourSelectionKey(row.shade) === colourSelectionKey(entries[0].shade));
      if (!targets.length) continue;
      const keys = new Set(entries.flatMap((row) => Object.keys(row.quantities)));
      targets.forEach((target, index) => {
        const row: Row = { ...copyReportData(entries[0]), id: target.id, bodyBatchId: target.id, quantities: {} };
        for (const key of keys) {
          const total = productionSum(entries.map((r) => r.quantities[key] || 0));
          row.quantities[key] = Math.floor(total / targets.length) + (index < total % targets.length ? 1 : 0);
        }
        componentRowTotals(row);
        revised.push(row);
      });
    }
    draft.manual.componentRows[section.kind] = [...revised, ...manual.filter((row) => !isODSemiBleach(row.shade))];
  }
  const allocated = [
      ...combined,
      ...(Object.values(draft.manual.componentRows || {}) as (Row[] | null)[]).flatMap((rows) => rows || []).filter((row) => !row.odDeclared),
    ],
    next = componentBatchAllocator(S.currentViewingNumber, allocated);
  for (const rows of Object.values(draft.manual.componentRows || {}) as (Row[] | null)[]) {
    const ids = new Map<string, string>();
    for (const row of rows || [])
      if (row.odDeclared) {
        const key = JSON.stringify([colourSelectionKey(row.shade), row.odBatchIndex]);
        if (!ids.has(key)) ids.set(key, next());
        row.id = ids.get(key);
      }
  }
  assignODMachines(combined);
}
export function restoreODRows(kind: string, baseRows: Row[]): void {
  if (kind === 'body') replaceODBodyRows(copyReportData(baseRows));
  else
    S.reportDraft!.manual.componentRows = {
      ...(S.reportDraft!.manual.componentRows || {}),
      [kind]: [...copyReportData(baseRows), ...copyReportData(odRows(kind).filter((row) => !isODSemiBleach(row.shade)))],
    };
}
