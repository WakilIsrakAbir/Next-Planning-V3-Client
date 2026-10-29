/* Batch engine slice "model": Tall/Big sizes (re-exported by model.ts).
   Port of the old js/batch/batch-app.js Tall/Big functions: the report's Tall/Big setting, body Tall/Big kg
   declarations (they regenerate the batch rows), component Tall/Big piece declarations and allocation.
   The rules are unchanged. The declaration dialog (reportui) shows `S.tallBigDeclarationContext` and writes
   its inputs into `context.quantities`; the functions here put their messages into `context.error`
   (the old #tallBigDeclarationError). */
import { BATCH_CALCULATION } from './constants';
import { S, notify } from './state';
import { setMutationBusy, showSaveError, toast } from './storage';
import {
  GenericMachineSelection,
  addDistinctFabricValue,
  availableComponentKinds,
  colourSelectionKey,
  componentColourSummary,
  componentIsSeparate,
  dyeingBatchGroupKey,
  erpMachineConfigurations,
  fabricBatchGroup,
  fabricPeachForColour,
  fabricQuantity,
  kgText,
  knittingQuantityAtLeast,
  machineEvaluationKey,
  machineNozzles,
  orderDyeingModeBatches,
  productionFraction,
  productionMultiply,
  productionSum,
  savedColourMachine,
} from './calc';
import { canEditReport, captureConfirmedReport, reportSaveHint } from './core';
import {
  closeTallBigDeclaration,
  collectTallBigDeclarationInputs,
  openBodyTallBigDeclaration,
  refreshEditableReport,
  renderTallBigDeclaration,
} from './reportui';
import { compactCardSignature } from './cards';
import {
  copyReportData,
  currentReportBooking,
  evaluateManualBatchRows,
  renumberReportBatches,
  reportManualState,
  retainSavedReportDraft,
  savedReportPlan,
} from './model';
import { componentDyeingType } from './model-components';
import type { Row } from './types';

type Floor = string | null;

/** Shows a message in the Tall/Big declaration dialog (old #tallBigDeclarationError). */
function setTallBigDeclarationError(message: string): void {
  if (S.tallBigDeclarationContext) S.tallBigDeclarationContext.error = message;
  notify();
}

export function tallBigSettings(booking: Row | undefined = currentReportBooking(), floor: Floor = S.currentViewingFloor): Row {
  return booking ? reportManualState(booking, floor).tallBig || { enabled: false, declarations: {} } : { enabled: false, declarations: {} };
}
export function tallBigEnabled(booking: Row | undefined = currentReportBooking(), floor: Floor = S.currentViewingFloor): boolean {
  return !!booking && availableComponentKinds(booking, floor).length > 0 && tallBigSettings(booking, floor).enabled === true;
}
export function tallBigBatchType(row: Row, booking?: Row, floor?: Floor): string {
  return tallBigEnabled(booking, floor) ? (['No', 'Tall', 'Big'].includes(row.tallBig) ? row.tallBig : '') : 'No';
}
export function automaticTallBig(booking: Row | undefined = currentReportBooking(), floor: Floor = S.currentViewingFloor): boolean {
  return tallBigEnabled(booking, floor) && !!tallBigSettings(booking, floor).bodyDeclarations;
}
export function tallBigSaveError(booking: Row, floor: Floor): string {
  if (!tallBigEnabled(booking, floor)) return '';
  const data = captureConfirmedReport(booking, floor);
  const missing = data.rows.find((row: Row) => !['No', 'Tall', 'Big'].includes(row.tallBig));
  if (missing) return 'Select No, Tall or Big for batch ' + (missing.id || missing.shade) + ' before saving the batch plan.';
  if (data.truncated) return 'Tall/Big allocation requires the complete batch list.';
  for (const section of data.components || []) if (section.tallBigErrors?.length) return section.title + ': ' + section.tallBigErrors[0];
  return '';
}
export function preserveTallBigBatchEdits(): void {
  if (S.reportDraft?.manual.tallBig?.enabled) S.reportDraft.manual.tallBig.createdBatchOverride = false;
}
/** The report's "Tall/Big size" select (value 'Yes' / 'No'). */
export async function changeTallBigEnabled(value: string): Promise<boolean> {
  if (!['Yes', 'No'].includes(value) || !S.reportDraft || !canEditReport() || !availableComponentKinds(currentReportBooking()!, S.currentViewingFloor).length)
    return false;
  if (S.reportRowEditor) {
    toast('Save or cancel the row being edited first.');
    refreshEditableReport();
    return false;
  }
  if (value === 'Yes' && S.currentReportBatchRowsTruncated) {
    toast('Tall/Big size requires the complete batch list. Use a configuration within the report row limit first.');
    refreshEditableReport();
    return false;
  }
  if (value === 'Yes') return openBodyTallBigDeclaration();
  const before = copyReportData(S.reportDraft),
    settings = copyReportData(tallBigSettings());
  if ((value === 'Yes') === (settings.enabled === true)) {
    refreshEditableReport();
    return true;
  }
  if (value === 'Yes' && !settings.enabled) {
    settings.createdBatchOverride = !S.reportDraft.manual.batchRows;
    S.reportDraft.manual.batchRows = copyReportData(S.currentBatchRows).map((row) => ({
      ...row,
      tallBig: ['No', 'Tall', 'Big'].includes(row.tallBig) ? row.tallBig : '',
    }));
  } else if (value === 'No' && settings.bodyDeclarations) {
    settings.enabled = false;
    S.reportDraft.manual.tallBig = settings;
    try {
      S.reportDraft.manual.batchRows = generateBodyTallBigRows(currentReportBooking()!, S.currentViewingFloor, S.currentFabricRows, S.currentBatchRows, {});
    } catch (error) {
      S.reportDraft = before;
      refreshEditableReport();
      toast((error as Error).message);
      return false;
    }
    delete settings.bodyDeclarations;
    settings.createdBatchOverride = false;
  } else if (value === 'No' && settings.createdBatchOverride) {
    const saved = savedReportPlan(currentReportBooking()!, S.currentViewingFloor).confirmedSnapshot?.reportData;
    S.reportDraft.manual.batchRows = saved ? copyReportData(saved.rows) : null;
    settings.createdBatchOverride = false;
  }
  settings.enabled = value === 'Yes';
  S.reportDraft.manual.tallBig = settings;
  S.reportDraft.dirty = true;
  setMutationBusy(true);
  try {
    const retained = await retainSavedReportDraft();
    refreshEditableReport();
    toast(
      retained
        ? 'Tall/Big size saved.'
        : value === 'Yes'
          ? 'Choose No, Tall or Big for every batch before saving.'
          : 'Tall/Big size disabled. ' + reportSaveHint()
    );
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
/** A batch row's No / Tall / Big select. */
export async function changeBatchTallBig(index: number, value: string): Promise<boolean> {
  if (!S.reportDraft || !canEditReport() || !tallBigEnabled() || !['No', 'Tall', 'Big'].includes(value) || !S.currentBatchRows[index]) return false;
  if (automaticTallBig()) {
    toast('Declare fabric quantities to set Tall/Big automatically.');
    return false;
  }
  if (S.reportRowEditor) {
    toast('Save or cancel the row being edited first.');
    refreshEditableReport();
    return false;
  }
  if (S.currentBatchRows[index].tallBig === value) return true;
  const before = copyReportData(S.reportDraft),
    rows = copyReportData(S.currentBatchRows);
  rows[index].tallBig = value;
  S.reportDraft.manual.batchRows = rows;
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

/* ---------- Component Tall/Big pieces ---------- */
export function tallBigComponentPools(rows: Row[]): Row[] {
  const groups = new Map<string, Row>();
  for (const row of rows) {
    const colourKey = colourSelectionKey(row.shade),
      fabricKey = colourSelectionKey(row.fabricType),
      key = JSON.stringify([colourKey, fabricKey]);
    if (!groups.has(key)) groups.set(key, { key, colourKey, fabricKey, shade: row.shade, fabricType: row.fabricType, quantities: {}, weights: {}, rows: [] });
    const pool = groups.get(key)!;
    pool.rows.push(row);
    for (const [size, qty] of Object.entries(row.quantities || {})) pool.quantities[size] = productionSum([pool.quantities[size] || 0, qty]);
  }
  for (const pool of groups.values())
    for (const [size, qty] of Object.entries(pool.quantities)) {
      const active: Row[] = pool.rows.filter((row: Row) => row.quantities?.[size] > 0);
      pool.weights[size] = active.some((row) => row.weights?.[size] === null || !Number.isFinite(row.weights?.[size]))
        ? null
        : (qty as number) > 0
          ? productionSum(active.map((row) => productionMultiply(row.quantities[size], row.weights[size]))) / (qty as number)
          : (pool.rows.find((row: Row) => Number.isFinite(row.weights?.[size]))?.weights[size] ?? null);
    }
  return Array.from(groups.values());
}
export function tallBigAllocationSignature(
  booking: Row,
  floor: Floor,
  kind: string,
  bodyRows: Row[],
  settings: Row = tallBigSettings(booking, floor)
): string {
  const manual = reportManualState(booking, floor);
  return compactCardSignature({
    kind,
    rows: bodyRows.map((row) => [row.id, colourSelectionKey(row.shade), row.tallBig || '', row.dyeingGroup || '', row.componentAnchor]),
    colours: settings.declarations?.[kind]?.colours || {},
    dyeingType: componentDyeingType(booking, floor, kind),
    separate: manual.componentSeparate,
    fabricSeparate: manual.fabricSeparate,
  });
}
export function allocateTallBigPool(
  pool: Row,
  batches: Row[],
  booking: Row | undefined,
  floor: Floor,
  kind: string,
  declaration: Row | undefined
): { active: boolean; errors: string[]; allocated: Map<Row, Row> } {
  const types: Record<string, Row[]> = {
    Tall: batches.filter((row) => tallBigBatchType(row, booking, floor) === 'Tall'),
    Big: batches.filter((row) => tallBigBatchType(row, booking, floor) === 'Big'),
  };
  const separate = componentIsSeparate(booking!, floor, kind, pool.shade, pool.fabricType);
  types.No = batches.filter(
    (row) =>
      !['Tall', 'Big'].includes(tallBigBatchType(row, booking, floor)) &&
      (separate || !batches.some((batch) => batch.componentAnchor !== undefined) || row.componentAnchor)
  );
  const values = declaration?.colours?.[pool.colourKey],
    special = types.Tall.length || types.Big.length,
    errors: string[] = [],
    allocated = new Map<Row, Row>();
  if (!special) return { active: false, errors, allocated };
  if (!values?.complete) {
    errors.push(pool.shade + ': declare Tall/Big size quantities.');
    return { active: true, errors, allocated };
  }
  const requested = values.fabrics?.[pool.fabricKey] || { Tall: {}, Big: {} };
  for (const size of new Set([...Object.keys(pool.quantities), ...Object.keys(requested.Tall || {}), ...Object.keys(requested.Big || {})])) {
    const total = pool.quantities[size] || 0,
      tall = requested.Tall?.[size] ?? 0,
      big = requested.Big?.[size] ?? 0;
    if (![total, tall, big].every((qty) => Number.isSafeInteger(qty) && qty >= 0)) {
      errors.push(pool.shade + ' · ' + pool.fabricType + ' · ' + size + ': enter non-negative whole pieces.');
      continue;
    }
    if (tall > total || big > total - tall) {
      errors.push(pool.shade + ' · ' + pool.fabricType + ' · ' + size + ': Tall + Big exceeds ' + total + ' planned pieces.');
      continue;
    }
    for (const [type, qty] of [
      ['Tall', tall],
      ['Big', big],
      ['No', total - tall - big],
    ] as [string, number][]) {
      if (qty > 0 && !types[type].length) {
        errors.push(
          pool.shade +
            ' · ' +
            pool.fabricType +
            ' · ' +
            size +
            ': ' +
            (type === 'No' ? 'remaining pieces need a No batch' : type + ' pieces need a matching ' + type + ' batch') +
            '.'
        );
        continue;
      }
      types[type].forEach((batch, index) => {
        if (!allocated.has(batch)) allocated.set(batch, {});
        allocated.get(batch)![size] = Math.floor(qty / types[type].length) + (index < qty % types[type].length ? 1 : 0);
      });
    }
  }
  return { active: true, errors, allocated };
}
export function applyTallBigComponentAllocation(section: Row, booking: Row, floor: Floor, bodyRows: Row[], nextId: () => string): void {
  const pools = tallBigComponentPools(section.rows);
  section.tallBigPools = pools.map((pool) => {
    const copy = { ...pool };
    delete copy.rows;
    return copyReportData(copy);
  });
  section.tallBigErrors = [];
  const settings = tallBigSettings(booking, floor),
    declaration = settings.declarations?.[section.kind];
  if (!tallBigEnabled(booking, floor) || !declaration?.enabled) return;
  const keepManual = section.manual && declaration.manualSignature === tallBigAllocationSignature(booking, floor, section.kind, bodyRows);
  const result: Row[] = [];
  for (const pool of pools) {
    const batches = bodyRows.filter((row) => colourSelectionKey(row.shade) === pool.colourKey && String(row.id || '').trim());
    const allocation = allocateTallBigPool(pool, batches, booking, floor, section.kind, declaration);
    section.tallBigErrors.push(...allocation.errors);
    if (!allocation.active || allocation.errors.length || keepManual) {
      result.push(...pool.rows);
      continue;
    }
    const separate = componentIsSeparate(booking, floor, section.kind, pool.shade, pool.fabricType);
    const allocatedRows: Row[] = [];
    for (const [batch, quantities] of allocation.allocated) {
      const old: Row | undefined = pool.rows.find((row: Row) => (row.bodyBatchId || row.id) === batch.id),
        template = old || pool.rows[0];
      allocatedRows.push({
        ...copyReportData(template),
        id: separate ? (old?.separate ? old.id : nextId()) : batch.id,
        bodyBatchId: batch.id,
        separate,
        tallBig: tallBigBatchType(batch, booking, floor),
        shade: batch.shade,
        ld: batch.ld || '',
        reference: batch.reference || '',
        quantities,
        weights: copyReportData(pool.weights),
      });
    }
    const positions = new Map<unknown, number>(batches.map((batch, index) => [batch.id, index]));
    allocatedRows.sort((a, b) => (positions.get(a.bodyBatchId) as number) - (positions.get(b.bodyBatchId) as number));
    result.push(...allocatedRows);
  }
  section.rows = result;
  section.tallBigDeclared = true;
  section.tallBigErrors = Array.from(new Set(section.tallBigErrors));
}
export function syncTallBigManualComponentRows(kind: string, rows: Row[]): void {
  const booking = currentReportBooking(),
    settings = tallBigSettings(),
    declaration = settings.declarations?.[kind];
  if (!tallBigEnabled() || !declaration?.enabled) return;
  const bodies = new Map<string, Row>(S.currentBatchRows.map((row) => [String(row.id), row]));
  const colours = copyReportData(declaration.colours || {});
  for (const pool of tallBigComponentPools(rows)) {
    if (!colours[pool.colourKey]) colours[pool.colourKey] = { complete: true, fabrics: {} };
    const quantities: Row = { Tall: {}, Big: {} };
    for (const row of pool.rows) {
      const body = bodies.get(String(row.bodyBatchId || row.id)),
        type = body ? tallBigBatchType(body, booking, S.currentViewingFloor) : 'No';
      row.tallBig = type;
      if (type === 'Tall' || type === 'Big')
        for (const [size, qty] of Object.entries(row.quantities || {})) quantities[type][size] = productionSum([quantities[type][size] || 0, qty]);
    }
    colours[pool.colourKey].fabrics[pool.fabricKey] = quantities;
  }
  declaration.colours = colours;
  declaration.manualSignature = tallBigAllocationSignature(booking!, S.currentViewingFloor, kind, S.currentBatchRows, settings);
}

/* ---------- Body (main fabric) Tall/Big kg ---------- */
export function isTallBigAccessory(fabric: Row): boolean {
  const gsm = String(fabric.gsm ?? '').trim();
  return gsm === '' || fabricQuantity(gsm) === 0;
}
export function bodyTallBigPools(rows: Row[], fabrics: Row[]): Row[] {
  const pools = new Map<string, Row>();
  for (const row of rows)
    for (const fabric of fabrics)
      if (!isTallBigAccessory(fabric)) {
        const qty = fabricQuantity(row.quantities?.[fabric.key]) || 0;
        if (qty <= 0) continue;
        const colourKey = colourSelectionKey(row.shade),
          key = JSON.stringify([colourKey, fabric.key]);
        if (!pools.has(key))
          pools.set(key, { colourKey, shade: row.shade, fabricKey: fabric.key, fabricName: fabric.name, fabricType: fabric.type, quantities: { kg: 0 } });
        const pool = pools.get(key)!;
        pool.quantities.kg = productionSum([pool.quantities.kg, qty]);
      }
  return Array.from(pools.values());
}
export function validateBodyTallBig(pools: Row[], colours: Row, onlyTall = false): string {
  for (const pool of pools) {
    const declared = colours[pool.colourKey]?.fabrics?.[pool.fabricKey],
      tall = declared?.Tall?.kg ?? 0,
      big = onlyTall ? 0 : (declared?.Big?.kg ?? 0);
    if (![tall, big].every((qty) => typeof qty === 'number' && Number.isFinite(qty) && qty >= 0))
      return pool.shade + ' · ' + pool.fabricName + ': enter non-negative kg quantities.';
    if (!knittingQuantityAtLeast(pool.quantities.kg, productionSum([tall, big])))
      return pool.shade + ' · ' + pool.fabricName + ': Tall + Big exceeds ' + kgText(pool.quantities.kg) + ' kg.';
  }
  return '';
}
export function syncBodyTallBigQuantities(rows: Row[]): void {
  if (!automaticTallBig()) return;
  const colours: Row = {};
  for (const row of rows) {
    const key = colourSelectionKey(row.shade);
    colours[key] ||= { complete: true, fabrics: {} };
    for (const fabric of S.currentFabricRows) {
      if (isTallBigAccessory(fabric)) continue;
      const values = (colours[key].fabrics[fabric.key] ||= { Tall: { kg: 0 }, Big: { kg: 0 } });
      if (row.tallBig === 'Tall' || row.tallBig === 'Big')
        values[row.tallBig].kg = productionSum([values[row.tallBig].kg, fabricQuantity(row.quantities?.[fabric.key]) || 0]);
    }
  }
  S.reportDraft!.manual.tallBig.bodyDeclarations = { colours };
}
export function generateBodyTallBigRows(booking: Row, floor: Floor, fabrics: Row[], source: Row[], colours: Row): Row[] {
  const previous = S.rebuildingConfirmedReport;
  S.rebuildingConfirmedReport = true;
  try {
    return buildBodyTallBigRows(booking, floor, fabrics, source, colours);
  } finally {
    S.rebuildingConfirmedReport = previous;
  }
}
export function buildBodyTallBigRows(booking: Row, floor: Floor, fabrics: Row[], source: Row[], colours: Row): Row[] {
  const pools = bodyTallBigPools(source, fabrics),
    error = validateBodyTallBig(pools, colours);
  if (error) throw new Error(error);
  const groups = new Map<string, Row>(),
    byPool = new Map<string, Row>(pools.map((pool) => [JSON.stringify([pool.colourKey, pool.fabricKey]), pool]));
  // Split each fabric's declared kg across its existing finish groups, preserving
  // Peach, Dyeing Mode and all existing machine eligibility constraints.
  const buckets = new Map<string, Row>();
  for (const row of source)
    fabrics.forEach((fabric, index) => {
      if (fabric.componentKind) return;
      const qty = fabricQuantity(row.quantities?.[fabric.key]) || 0;
      if (qty <= 0) return;
      const key = colourSelectionKey(row.shade),
        peach = typeof row.peachFinish === 'boolean' ? row.peachFinish : fabricPeachForColour(fabric, row.shade, booking, floor),
        base = fabricBatchGroup(fabric, row.shade, peach, booking, floor),
        bucketKey = JSON.stringify([key, fabric.key, base.key]);
      if (!buckets.has(bucketKey)) buckets.set(bucketKey, { shade: row.shade, key, fabric, index, peach, base, qty: 0, ld: new Map(), reference: new Map() });
      const bucket = buckets.get(bucketKey)!;
      bucket.qty = productionSum([bucket.qty, qty]);
      addDistinctFabricValue(bucket.ld, row.ld);
      addDistinctFabricValue(bucket.reference, row.reference);
    });
  const scale = (amount: number, part: number, total: number) => {
    const a = productionFraction(amount),
      b = productionFraction(part),
      c = productionFraction(total);
    return Number(a.n * b.n * c.d) / Number(a.d * b.d * c.n);
  };
  for (const bucket of buckets.values()) {
    const { shade, key, fabric, index, peach, base, qty } = bucket,
      pool = byPool.get(JSON.stringify([key, fabric.key])),
      declared = pool ? colours[key]?.fabrics?.[fabric.key] : null,
      tall = pool ? scale(declared?.Tall?.kg || 0, qty, pool.quantities.kg) : 0,
      big = pool ? scale(declared?.Big?.kg || 0, qty, pool.quantities.kg) : 0;
    for (const [type, amount] of [
      ['Tall', tall],
      ['Big', big],
      ['No', productionSum([qty, -tall, -big])],
    ] as [string, number][]) {
      if (amount <= 0) continue;
      const groupKey = base.key + ':size:' + type,
        selectionKey = dyeingBatchGroupKey(shade, groupKey);
      if (!groups.has(selectionKey))
        groups.set(selectionKey, {
          shade,
          key: groupKey,
          baseKey: base.key,
          type,
          peach,
          selectionKey,
          quantities: Array(fabrics.length).fill(0),
          ld: new Map(),
          reference: new Map(),
          count: 1,
          machine: null,
        });
      const group = groups.get(selectionKey)!;
      group.quantities[index] = productionSum([group.quantities[index], amount]);
      for (const value of bucket.ld.values()) addDistinctFabricValue(group.ld, value);
      for (const value of bucket.reference.values()) addDistinctFabricValue(group.reference, value);
    }
  }
  const shades = Array.from(new Map<string, Row[string]>(source.map((row) => [colourSelectionKey(row.shade), row.shade])).values()),
    components = componentColourSummary(booking, floor, shades);
  for (const shade of shades) {
    const same = Array.from(groups.values()).filter((group) => colourSelectionKey(group.shade) === colourSelectionKey(shade)),
      anchor = same.some((g) => g.baseKey === 'together') ? 'together' : same.some((g) => g.baseKey === 'peach') ? 'peach' : null;
    if (!anchor && ((components.get(colourSelectionKey(shade))?.kg || 0) > 0 || components.get(colourSelectionKey(shade))?.missing)) {
      const selectionKey = dyeingBatchGroupKey(shade, 'components:size:No');
      groups.set(selectionKey, {
        shade,
        key: 'components:size:No',
        baseKey: 'components',
        type: 'No',
        peach: false,
        selectionKey,
        quantities: Array(fabrics.length).fill(0),
        ld: new Map(),
        reference: new Map(),
        count: 1,
        machine: null,
      });
    }
    for (const group of groups.values()) if (colourSelectionKey(group.shade) === colourSelectionKey(shade)) group.anchor = group.baseKey === (anchor || 'components');
  }
  const ordered = Array.from(groups.values()).sort((a, b) => ['Tall', 'Big', 'No'].indexOf(a.type) - ['Tall', 'Big', 'No'].indexOf(b.type));
  for (const group of ordered) {
    const total = productionSum(group.quantities);
    if (total > 0)
      try {
        const result = GenericMachineSelection.selectMachine({
          totalQuantityKg: total,
          machines: erpMachineConfigurations(
            group.shade,
            floor,
            fabrics.filter((fabric, index) => group.quantities[index] > 0)
          ),
          maximumLoadingPercent: BATCH_CALCULATION.defaultMaximumLoadingPercent,
        });
        group.count = result.selected.batches;
        group.machine = result.selected;
      } catch (error) {
        if (!(error instanceof GenericMachineSelection.MachineSelectionError)) throw error;
      }
  }
  const makeRows = () => {
    const rows: Row[] = [];
    for (const group of ordered) {
      if (group.count > BATCH_CALCULATION.maxRenderedBatches) throw new Error('Tall/Big quantities require too many batch rows. Choose a larger eligible machine.');
      for (let index = 0; index < group.count; index++)
        rows.push({
          id: '',
          rowKey: '',
          shade: group.shade,
          tallBig: group.type,
          dyeingGroup: group.key,
          selectionKey: group.selectionKey,
          peachFinish: group.peach,
          componentAnchor: group.anchor,
          ld: Array.from(group.ld.values()).join(', '),
          reference: Array.from(group.reference.values()).join(', '),
          quantities: Object.fromEntries(fabrics.map((fabric, i) => [fabric.key, group.quantities[i] / group.count])),
          machineId: group.machine?.id ?? null,
          machineLabel: group.machine?.machine.label || '',
          loading: group.machine ? String(Number(group.machine.actualLoadingPercent.toFixed(2))) + '%' : '',
          nozzle: group.machine ? String(machineNozzles(group.machine.capacityKg)) : '',
          manual: true,
          manualNumber: false,
        });
    }
    orderDyeingModeBatches(rows, fabrics, booking, floor);
    renumberReportBatches(rows, booking.number);
    for (const row of rows) row.rowKey = 'auto-size:' + row.id;
    return rows;
  };
  for (let round = 0; round < 20; round++) {
    const rows = makeRows(),
      evaluations = evaluateManualBatchRows(rows, fabrics, booking, floor);
    let changed = false;
    for (const group of ordered) {
      const evaluated = evaluations.find((value) => machineEvaluationKey(value) === group.selectionKey),
        preference = savedColourMachine(booking, floor, group.shade, group.selectionKey),
        selected =
          evaluated?.rows.find((row: Row) => row.eligible && preference && String(row.id) === String(preference.machineId)) ||
          evaluated?.rows.find((row: Row) => row.selected && row.eligible);
      if (selected) {
        if (group.count !== selected.batches) changed = true;
        group.count = selected.batches;
        group.machine = selected;
      } else group.machine = null;
    }
    if (!changed) return makeRows();
  }
  throw new Error('Tall/Big batch allocation could not fit the configured machines. Review the quantities or machine setup.');
}

/* ---------- Declaration dialog actions (the dialog component is reportui's) ---------- */
export async function saveBodyTallBigDeclaration(context: Row): Promise<boolean> {
  const error = validateBodyTallBig(context.pools, context.quantities);
  if (error) {
    setTallBigDeclarationError(error);
    return false;
  }
  const before = copyReportData(S.reportDraft);
  setMutationBusy(true);
  try {
    const settings = copyReportData(tallBigSettings());
    settings.enabled = true;
    settings.createdBatchOverride = false;
    settings.bodyDeclarations = { colours: copyReportData(context.quantities) };
    S.reportDraft!.manual.tallBig = settings;
    S.reportDraft!.manual.batchRows = generateBodyTallBigRows(currentReportBooking()!, S.currentViewingFloor, S.currentFabricRows, context.bodyRows, context.quantities);
    S.reportDraft!.dirty = true;
    const retained = await retainSavedReportDraft();
    closeTallBigDeclaration(false);
    refreshEditableReport();
    toast(retained ? 'Tall/Big fabric quantities saved.' : 'Tall/Big fabric quantities staged. ' + reportSaveHint());
    return true;
  } catch (error) {
    S.reportDraft = before;
    context.draft = S.reportDraft;
    setTallBigDeclarationError((error as Error).message);
    return false;
  } finally {
    setMutationBusy(false);
  }
}
/** The dialog's Next button (Tall step -> Big step). */
export function nextTallBigDeclaration(): boolean {
  if (!S.tallBigDeclarationContext) return false;
  collectTallBigDeclarationInputs();
  const context = S.tallBigDeclarationContext;
  if (context.kind === 'body') {
    const error = validateBodyTallBig(context.pools, context.quantities, true);
    if (error) {
      setTallBigDeclarationError(error);
      return false;
    }
    context.step = 'Big';
    setTallBigDeclarationError('');
    renderTallBigDeclaration();
    return true;
  }
  for (const pool of context.pools)
    for (const [size, qty] of Object.entries(context.quantities[pool.colourKey]?.fabrics?.[pool.fabricKey]?.Tall || {}))
      if (!Number.isSafeInteger(qty) || (qty as number) < 0 || (qty as number) > (pool.quantities[size] || 0)) {
        setTallBigDeclarationError(
          'Enter non-negative whole Tall pieces within the planned quantity for ' + pool.shade + ' · ' + pool.fabricType + ' · ' + size + '.'
        );
        return false;
      }
  context.step = 'Big';
  setTallBigDeclarationError('');
  renderTallBigDeclaration();
  return true;
}
/** The dialog's Save button. */
export async function saveTallBigDeclaration(): Promise<boolean> {
  const context = S.tallBigDeclarationContext;
  if (!context || !S.reportDraft || !canEditReport()) return false;
  if (context.number !== S.currentViewingNumber || context.floor !== S.currentViewingFloor || context.draft !== S.reportDraft) {
    closeTallBigDeclaration(false);
    return false;
  }
  if (context.kind === 'body') {
    collectTallBigDeclarationInputs();
    return saveBodyTallBigDeclaration(context);
  }
  collectTallBigDeclarationInputs();
  const booking = currentReportBooking(),
    declaration = { enabled: true, colours: context.quantities };
  for (const colour of context.colours)
    for (const type of ['Tall', 'Big'])
      if (
        context.bodyRows.some((row: Row) => colourSelectionKey(row.shade) === colour.key && row.tallBig === type) &&
        !context.reviewed[colour.key]?.[type]
      ) {
        context.colourKey = colour.key;
        context.step = type;
        renderTallBigDeclaration();
        setTallBigDeclarationError('Review ' + type + ' quantities for ' + colour.shade + ', then save.');
        return false;
      }
  for (const pool of context.pools) {
    const result = allocateTallBigPool(
      pool,
      context.bodyRows.filter((row: Row) => colourSelectionKey(row.shade) === pool.colourKey),
      booking,
      context.floor,
      context.kind,
      declaration
    );
    if (result.errors.length) {
      setTallBigDeclarationError(result.errors[0]);
      return false;
    }
  }
  const before = copyReportData(S.reportDraft);
  S.reportDraft.manual.tallBig.declarations = { ...(S.reportDraft.manual.tallBig.declarations || {}), [context.kind]: copyReportData(declaration) };
  S.reportDraft.dirty = true;
  setMutationBusy(true);
  try {
    const retained = await retainSavedReportDraft();
    closeTallBigDeclaration(false);
    refreshEditableReport();
    toast(retained ? 'Tall/Big quantities saved.' : 'Tall/Big quantities staged. ' + reportSaveHint());
    return true;
  } catch (error) {
    S.reportDraft = before;
    context.draft = S.reportDraft;
    setTallBigDeclarationError('Could not save. Your entered quantities are available for retry.');
    showSaveError(error);
    return false;
  } finally {
    setMutationBusy(false);
  }
}
/** A component section's "Do you declare Tall/Big sizes?" set to No. */
export async function disableTallBigDeclaration(kind: string): Promise<boolean> {
  if (!S.reportDraft || !canEditReport()) return false;
  if (S.reportRowEditor) {
    toast('Save or cancel the row being edited first.');
    refreshEditableReport();
    return false;
  }
  const before = copyReportData(S.reportDraft),
    settings = copyReportData(tallBigSettings());
  if (!settings.declarations?.[kind]?.enabled) {
    refreshEditableReport();
    return true;
  }
  settings.declarations = { ...(settings.declarations || {}), [kind]: { ...(settings.declarations?.[kind] || {}), enabled: false } };
  S.reportDraft.manual.tallBig = settings;
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
