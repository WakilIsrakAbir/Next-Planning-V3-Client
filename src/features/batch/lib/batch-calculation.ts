/* Batch Plan: batch calculation — flat allowance, knitting fabric columns and fabric de-duplication, machine
   setup rules, knitting readiness, machine evaluation and production math, colour batch generation.
   Port of the old js/batch/batch-app.js (see docs/batch-module.md). Every rule is kept statement for statement;
   old globals are S.<name>. The Generic ERP Machine Selection lives in ./machine-selection (re-exported). */
import { BATCH_CALCULATION, COMPONENT_KINDS, INITIAL_FLAT_ALLOWANCE, KNITTING_FABRIC_COLUMNS, MACHINE_FLOOR_POOLS } from '@/features/batch/constants';
import { S, notify } from '@/features/batch/store/batch-store';
import { getStoredDatasets, setMutationBusy, showSaveError, toast } from './storage';
import {
  canEditReport,
  getFloorBooking,
  getKnittingRows,
  getReportKnittingRows,
  knittingInfoValue,
  knittingProductionValue,
  normalizeBookingKey,
  normalizeFloor,
  reportSaveHint,
  reviewingLatest,
  sourceBooking,
} from './bookings';
import {
  applyMachineToManualBatchRows,
  autoBatchRow,
  automaticTallBig,
  bpValue,
  buildComponentBatches,
  buildEditableReportTables,
  componentDyeingType,
  componentKinds,
  copyReportData,
  currentReportBooking,
  getReportBpRows,
  renumberReportBatches,
  reportBookingStatus,
  reportManualState,
  retainSavedReportDraft,
  savedReportPlan,
} from './report-model';
import { closeMachineEvaluation, refreshEditableReport, refreshMachineEvaluationPopup } from './report-actions';
import { GenericMachineSelection, type MachineSelectionResult } from './machine-selection';
import type { Row } from '@/features/batch/types';

export * from './machine-selection';

/** A unit key (old `floor` arguments: 'EFL', 'EKL', ... or null), as in core and model. */
type Floor = string | null;

// The project compiles to ES2017, which has no bigint literals: BigInt(10) is the old `10n`.
const B0 = BigInt(0);
const B1 = BigInt(1);
const B10 = BigInt(10);
const B100 = BigInt(100);

/* ============================================================
   Flat Allowance (Setup > Flat Allowance rules applied to collar/cuff/hem/placket pieces)
   ============================================================ */
export type AllowanceRange = { min: number; max: number };
export type AllowanceLoss = { kind: 'percent' | 'pieces'; value: string };
export type AllowanceSelection = { rule: Row; loss: AllowanceLoss; range: AllowanceRange; index: number; specificity: number };

export function getFlatAllowance(): Row[] {
  return S.appState.flatAllowance || INITIAL_FLAT_ALLOWANCE;
}
export function parseAllowanceRange(value: unknown): AllowanceRange | null {
  const text = String(value).trim().replace(/,/g, '').toLowerCase();
  let match: RegExpMatchArray | null;
  if (text === 'all') return { min: 0, max: Infinity };
  if ((match = text.match(/^<\s*(\d+)$/))) return { min: 0, max: Number(match[1]) - 1 };
  if ((match = text.match(/^<=\s*(\d+)$/))) return { min: 0, max: Number(match[1]) };
  if ((match = text.match(/^(?:above|>)\s*(\d+)$/))) return { min: Number(match[1]) + 1, max: Infinity };
  if ((match = text.match(/^>=\s*(\d+)$/))) return { min: Number(match[1]), max: Infinity };
  if ((match = text.match(/^(\d+)\s*(?:to|[-–—])\s*(\d+)$/)) && Number(match[1]) <= Number(match[2])) return { min: Number(match[1]), max: Number(match[2]) };
  return null;
}
export function parseAllowanceLoss(value: unknown): AllowanceLoss | null {
  const text = String(value).trim();
  let match: RegExpMatchArray | null;
  if ((match = text.match(/^\+?\s*(\d+(?:\.\d+)?)\s*%$/))) return { kind: 'percent', value: match[1] };
  if ((match = text.match(/^\+?\s*(\d+)\s*(?:pcs|pieces)?$/i))) return { kind: 'pieces', value: match[1] };
  return null;
}
export function selectAllowanceRule(quantity: number, dyeingType: string, kind: string, rules: Row[] = getFlatAllowance()): AllowanceSelection | null {
  const candidates = rules.flatMap((rule, index): AllowanceSelection[] => {
    const range = parseAllowanceRange(rule.range),
      loss = parseAllowanceLoss(rule.loss),
      dye = String(rule.dyeingType).trim().toLowerCase(),
      flat = String(rule.flatType).trim().toLowerCase();
    if (!range || !loss || ![dyeingType.toLowerCase(), 'all'].includes(dye) || ![kind.toLowerCase(), 'all'].includes(flat) || quantity < range.min || quantity > range.max) return [];
    return [{ rule, loss, range, index, specificity: (dye === 'all' ? 0 : 1) + (flat === 'all' ? 0 : 1) }];
  });
  candidates.sort((a, b) => b.specificity - a.specificity || a.range.max - a.range.min - (b.range.max - b.range.min) || a.index - b.index);
  return candidates[0] || null;
}
export function allowanceQuantity(quantity: number, selection: AllowanceSelection | null): number {
  if (!quantity || !selection) return quantity;
  const qty = BigInt(quantity),
    loss = selection.loss;
  let result: bigint;
  if (loss.kind === 'pieces') result = qty + BigInt(loss.value);
  else {
    const [whole, fraction = ''] = loss.value.split('.'),
      denominator = B10 ** BigInt(fraction.length),
      percent = BigInt(whole + fraction),
      base = B100 * denominator;
    result = (qty * (base + percent) + base - B1) / base;
  }
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('Allowance-adjusted quantity exceeds the supported whole-piece range.');
  return Number(result);
}
export function reportFlatAllowance(booking: Row, floor: Floor): Row[] {
  const plan = savedReportPlan(booking, floor);
  return !reviewingLatest(booking.number, floor) && reportBookingStatus(booking, floor) === 'Confirm' && plan.flatAllowanceSnapshot
    ? plan.flatAllowanceSnapshot
    : getFlatAllowance();
}
export function applyComponentAllowance(section: Row, groups: Row[], booking: Row, floor: Floor): void {
  const pools = new Map<string, { shade: unknown; size: string; items: { group: Row; qty: number }[]; quantity: number }>();
  section.allowanceBreakdown = [];
  for (const group of groups)
    for (const [size, qty] of Object.entries(group.quantities)) {
      const key = JSON.stringify([group.colourKey, size]);
      if (!pools.has(key)) pools.set(key, { shade: group.shade, size, items: [], quantity: 0 });
      const pool = pools.get(key)!;
      pool.items.push({ group, qty: qty as number });
      pool.quantity += qty as number;
    }
  for (const pool of pools.values()) {
    if (!Number.isSafeInteger(pool.quantity)) {
      pool.items.forEach((item) => (item.group.invalid = true));
      section.warnings.push(pool.shade + ': combined size quantity exceeds the supported whole-piece range.');
      continue;
    }
    const selection = selectAllowanceRule(pool.quantity, section.dyeingType, section.kind, reportFlatAllowance(booking, floor));
    if (pool.quantity && !selection) section.warnings.push(pool.shade + ' · ' + pool.size + ': no matching Flat Allowance rule; source quantity is unchanged.');
    let adjusted: number;
    try {
      adjusted = allowanceQuantity(pool.quantity, selection);
    } catch (error) {
      pool.items.forEach((item) => (item.group.invalid = true));
      section.warnings.push((error as Error).message);
      continue;
    }
    section.allowanceBreakdown.push({ shade: pool.shade, size: pool.size, sourceQty: pool.quantity, processLoss: selection?.rule.loss || '0%', plannedQty: adjusted });
    if (!pool.quantity) continue;
    const allocated = pool.items.map((item, index) => {
      const numerator = BigInt(adjusted) * BigInt(item.qty),
        denominator = BigInt(pool.quantity);
      return { ...item, index, qty: Number(numerator / denominator), remainder: numerator % denominator };
    });
    const left = adjusted - allocated.reduce((sum, item) => sum + item.qty, 0);
    const ranked = allocated.slice().sort((a, b) => (a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1));
    for (let index = 0; index < left; index++) ranked[index].qty++;
    allocated.forEach((item) => (item.group.quantities[pool.size] = item.qty));
  }
}

/* ============================================================
   Knitting fabric columns and Fabric Info de-duplication
   ============================================================ */
export function readKnittingFabricColumns(sheet: Row, sourceRow: Row): Row {
  // __rowNum__ is the actual, zero-based Excel row, including skipped blank rows.
  const excelRow = sourceRow.__rowNum__ + 1;
  const values: Row = {};
  for (const [field, column] of Object.entries(KNITTING_FABRIC_COLUMNS)) {
    const cell = sheet[column + excelRow];
    if (!cell || cell.v === undefined || cell.v === null) {
      values[field] = '';
    } else if (field === 'requiredFinish') {
      values[field] = cell.v; // Numeric value, used for quantity totals.
    } else if (field === 'greyWaste') {
      const formatted = String(cell.w ?? cell.v).trim();
      if (formatted.includes('%')) values[field] = formatted;
      else if (typeof cell.v === 'number') {
        // Excel percentages are often stored as fractions: 0.10 means 10%.
        const percent = Math.abs(cell.v) <= 1 ? cell.v * 100 : cell.v;
        values[field] = Number(percent.toFixed(8)) + '%';
      } else values[field] = formatted;
    } else {
      values[field] = String(cell.w ?? cell.v).trim();
    }
  }
  return values;
}

export function addDistinctFabricValue(target: Map<string, string>, value: unknown): void {
  const text = String(value ?? '').trim();
  if (!text) return;
  const key = text.toLowerCase().replace(/\s+/g, ' ');
  if (!target.has(key)) target.set(key, text);
}

export function fabricQuantity(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const number = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(number) ? number : null;
}

export function hasPeachFinish(value: unknown): boolean {
  const text = String(value ?? '').trim();
  return /\bpeach(?:ing|ed)?\b/i.test(text) && !/\b(?:no|non|not)\s*[-:]?\s*peach(?:ing|ed)?\b/i.test(text);
}

type DeduplicatedFabricGroup = {
  type: string;
  gsm: string;
  totalQty: number;
  requiredFinish: number;
  hasRequiredFinish: boolean;
  otherRequiredValues: Map<string, string>;
  gaugeDia: Map<string, string>;
  width: Map<string, string>;
  yarn: Map<string, string>;
  composition: Map<string, string>;
  ld: Map<string, string>;
  reference: Map<string, string>;
  greigeQty: number;
  hasGreigeQty: boolean;
  otherGreigeValues: Map<string, string>;
  greyWaste: Map<string, string>;
  dryMethod: Map<string, string>;
  remarks: Set<string>;
};

export function extractDeduplicatedFabrics(orderNo: string, booking?: Row | null, floor: Floor = S.activeFloor): Row[] {
  const groups = new Map<string, DeduplicatedFabricGroup>();
  for (const row of getReportKnittingRows(orderNo, floor)) {
    const construction = String(row.FabricConstruction || row.Fabric || '').trim();
    const gsm = String(row.FinishGSM || row.GSM || '').trim();
    if (!construction) continue;
    const fabricKey = construction.toLowerCase().replace(/\s+/g, ' ');
    const gsmKey = /^\d+(\.\d+)?$/.test(gsm) ? String(Number(gsm)) : gsm.toLowerCase();
    const key = fabricKey + '|' + gsmKey;
    if (!groups.has(key)) {
      groups.set(key, {
        type: construction,
        gsm,
        totalQty: 0,
        requiredFinish: 0,
        hasRequiredFinish: false,
        otherRequiredValues: new Map(),
        gaugeDia: new Map(),
        width: new Map(),
        yarn: new Map(),
        composition: new Map(),
        ld: new Map(),
        reference: new Map(),
        greigeQty: 0,
        hasGreigeQty: false,
        otherGreigeValues: new Map(),
        greyWaste: new Map(),
        dryMethod: new Map(),
        remarks: new Set(),
      });
    }
    const group = groups.get(key)!;
    // Rows from older uploads need to be uploaded again to capture Excel letters.
    const columns = row._fabricColumns || {};
    const required = fabricQuantity(columns.requiredFinish);
    if (required !== null) {
      group.requiredFinish += required;
      group.hasRequiredFinish = true;
    } else addDistinctFabricValue(group.otherRequiredValues, columns.requiredFinish);
    group.totalQty += fabricQuantity(row.RequiredQtyKgs ?? row.GreyReq) ?? required ?? 0;
    for (const field of ['composition', 'ld', 'reference'] as const) addDistinctFabricValue(group[field], knittingInfoValue(row, field));
    const greigeValue = knittingInfoValue(row, 'greigeQty'),
      greigeQuantity = fabricQuantity(greigeValue);
    if (greigeQuantity !== null) {
      group.greigeQty = productionSum([group.greigeQty, greigeQuantity]);
      group.hasGreigeQty = true;
    } else addDistinctFabricValue(group.otherGreigeValues, greigeValue);
    for (const field of ['gaugeDia', 'width', 'yarn', 'greyWaste', 'dryMethod'] as const) {
      addDistinctFabricValue(group[field], columns[field]);
    }
    if (hasPeachFinish(columns.peach)) group.remarks.add('Peach');
    if (/\bbrush(?:ing|ed)?\b/i.test(String(columns.brush || ''))) group.remarks.add('Brush');
    if (/\bset\b|\bheat\s*set\b|\blycra\s*2\s*[x×]\s*2\s*rib\b/i.test(String(columns.heatset || ''))) {
      group.remarks.add('Heatset');
    }
  }
  const list = Array.from(groups.values());
  // Fabric numbers follow Required (Finish), largest to smallest.
  list.sort((a, b) => (b.hasRequiredFinish ? b.requiredFinish : -Infinity) - (a.hasRequiredFinish ? a.requiredFinish : -Infinity));
  const fabrics = list.map((group, index) => {
    const requiredValues: string[] = [];
    if (group.hasRequiredFinish) requiredValues.push(String(Number(group.requiredFinish.toFixed(8))));
    requiredValues.push(...group.otherRequiredValues.values());
    const greigeValues: string[] = [];
    if (group.hasGreigeQty) greigeValues.push(String(group.greigeQty));
    greigeValues.push(...group.otherGreigeValues.values());
    return {
      name: 'Fabric ' + (index + 1),
      key: rowFabricKey({ Fabric: group.type, GSM: group.gsm }),
      type: group.type,
      gsm: group.gsm,
      requiredFinish: requiredValues.join(', '),
      gaugeDia: Array.from(group.gaugeDia.values()).join(', '),
      width: Array.from(group.width.values()).join(', '),
      yarn: Array.from(group.yarn.values()).join(', '),
      composition: Array.from(group.composition.values()).join(', '),
      greigeQty: greigeValues.join(', '),
      ld: Array.from(group.ld.values()).join(', '),
      reference: Array.from(group.reference.values()).join(', '),
      greyWaste: Array.from(group.greyWaste.values()).join(', '),
      dryMethod: Array.from(group.dryMethod.values()).join(', '),
      remarks: ['Peach', 'Brush', 'Heatset'].filter((value) => group.remarks.has(value)).join(', '),
    };
  });
  return [...fabrics, ...componentFabricRows(booking || sourceBooking(orderNo) || { number: orderNo }, floor)].map((fabric: Row, index: number) => ({
    ...fabric,
    name: 'Fabric ' + (index + 1),
  }));
}

/* ============================================================
   Machine setup rules (Setup > Dyeing MC: Not Possible Fabric / GSM)
   ============================================================ */
export function getMachineSetup(): Row[] {
  return S.appState.setup || [];
}

/* Not Possible Fabric is a per-machine list of excluded constructions.
   New uploads capture physical column C; older rows can use their named header. */
export function constructionKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
export function getFabricConstructionChoices(): string[] {
  const plan = getStoredDatasets().knitPlan;
  const bp = getStoredDatasets().bpData;
  if (plan === S.constructionChoiceSource && bp === S.constructionBpSource) return S.constructionChoiceCache;
  S.constructionChoiceSource = plan;
  S.constructionBpSource = bp;
  const choices = new Map<string, string>();
  for (const rows of Object.values(plan || {})) {
    for (const row of rows) {
      const value = String(row._fabricColumns?.construction ?? row.FabricConstruction ?? '').trim();
      if (value && !choices.has(constructionKey(value))) choices.set(constructionKey(value), value);
    }
  }
  for (const rows of Object.values(bp || {}))
    for (const row of rows)
      if (componentKinds(bpValue(row, 'details')).length) {
        const value = String(bpValue(row, 'fabricType')).trim();
        if (value && !choices.has(constructionKey(value))) choices.set(constructionKey(value), value);
      }
  S.constructionChoiceCache = Array.from(choices.values()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return S.constructionChoiceCache;
}
export function machineExcludedFabrics(machine: Row): unknown[] {
  if (Array.isArray(machine.notPossibleFabric)) return machine.notPossibleFabric.filter((value: unknown) => String(value).trim());
  const value = String(machine.notPossibleFabric ?? '').trim();
  if (!value) return [];
  // Preserve an old single fabric name containing commas if it is in the upload.
  if (getFabricConstructionChoices().some((name) => constructionKey(name) === constructionKey(value))) return [value];
  return value
    .split(/[;,\n]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export type FabricRestrictionRule = { fabric: string; blocked: boolean; gsmGreaterThan: string };

/* A checked fabric is excluded completely. An unchecked fabric's GSM limit
   excludes only that construction above its own threshold. Blank adds no limit. */
export function machineFabricRestrictions(machine: Row): FabricRestrictionRule[] {
  const rules = new Map<string, FabricRestrictionRule>(),
    legacyLimits: unknown[] = [];
  const textLimit = (value: unknown) =>
    String(value ?? '')
      .trim()
      .replace(/^>\s*/, '');
  const getRule = (fabric: unknown): FabricRestrictionRule | null => {
    const name = String(fabric ?? '').trim(),
      key = constructionKey(name);
    if (!name) return null;
    if (!rules.has(key)) rules.set(key, { fabric: name, blocked: false, gsmGreaterThan: '' });
    return rules.get(key) as FabricRestrictionRule;
  };
  const mergeLimit = (rule: FabricRestrictionRule, value: unknown) => {
    const text = textLimit(value);
    if (!text) return;
    const number = fabricQuantity(text),
      previous = fabricQuantity(rule.gsmGreaterThan);
    if (!rule.gsmGreaterThan || number === null || number < 0 || (previous !== null && number < previous)) rule.gsmGreaterThan = text;
  };
  // (getRule(...) as FabricRestrictionRule): the old code dereferenced the result directly.
  for (const fabric of machineExcludedFabrics(machine)) (getRule(fabric) as FabricRestrictionRule).blocked = true;
  for (const source of Array.isArray(machine.notPossibleFabricRules) ? machine.notPossibleFabricRules : []) {
    const rule = getRule(source?.fabric);
    if (rule) {
      rule.blocked = rule.blocked || (typeof source.blocked === 'boolean' ? source.blocked : true);
      mergeLimit(rule, source.gsmGreaterThan);
    } else if (textLimit(source?.gsmGreaterThan)) legacyLimits.push(source.gsmGreaterThan);
  }
  if (textLimit(machine.notPossibleGsm)) legacyLimits.push(machine.notPossibleGsm);
  // Old machine-wide values had no fabric association. Preserve them as visible
  // independent rules for the current catalog, saved without an unscoped source.
  if (legacyLimits.length) {
    const fabrics = new Set([...getFabricConstructionChoices(), ...Array.from(rules.values()).map((rule) => rule.fabric)]);
    for (const fabric of fabrics) for (const value of legacyLimits) mergeLimit(getRule(fabric) as FabricRestrictionRule, value);
  }
  return Array.from(rules.values());
}
export function fabricRestrictionText(rule: FabricRestrictionRule): string {
  if (rule.blocked) return rule.fabric + ' · blocked' + (rule.gsmGreaterThan ? ' (GSM > ' + rule.gsmGreaterThan + ' saved)' : '');
  return rule.fabric + ' · GSM > ' + rule.gsmGreaterThan;
}
export function machineAllowsFabrics(machine: Row, fabrics: Row[]): boolean {
  const rules = new Map(machineFabricRestrictions(machine).map((rule) => [constructionKey(rule.fabric), rule] as [string, FabricRestrictionRule]));
  return fabrics.every((fabric) => {
    const rule = rules.get(constructionKey(fabric.type));
    if (!rule) return true;
    if (rule.blocked) return false;
    if (!rule.gsmGreaterThan) return true;
    const limit = fabricQuantity(rule.gsmGreaterThan),
      gsm = fabricQuantity(fabric.gsm);
    return limit !== null && limit >= 0 && gsm !== null && gsm <= limit;
  });
}

/* ============================================================
   Knitting readiness (Knit ok / Not knit ok per batch, confirmed reports)
   ============================================================ */
export type KnittingReadiness = { kind: string; label: string; cells: Record<string, Row>; hasCC: boolean };

export function showKnittingReadiness(): boolean {
  const booking = currentReportBooking();
  return !!booking && !S.rebuildingConfirmedReport && !reviewingLatest(booking.number, S.currentViewingFloor) && reportBookingStatus(booking, S.currentViewingFloor) === 'Confirm';
}
export function knittingResourceKey(shade: unknown, type: unknown, gsm: unknown): string {
  return JSON.stringify([colourSelectionKey(shade), rowFabricKey({ FabricConstruction: type, GSM: gsm })]);
}
export function knittingQuantityAtLeast(available: unknown, required: unknown): boolean {
  const a = productionFraction(available),
    b = productionFraction(required);
  return a.n * b.d >= b.n * a.d;
}
export function evaluateKnittingReadiness(booking: Row, floor: Floor, fabrics: Row[], rows: Row[], components: Row[] = []): KnittingReadiness[] {
  const production = new Map<string, { quantity: number; known: boolean; missing: boolean }>();
  for (const source of getKnittingRows(booking.number, floor)) {
    const shade = firstUploadedValue(source, BATCH_CALCULATION.colorHeaders),
      type = source.FabricConstruction || source.Fabric || '',
      gsm = String(source.GSM ?? '').trim() ? source.GSM : source.FinishGSM || '';
    if (!String(type).trim() || !String(shade).trim()) continue;
    const key = knittingResourceKey(shade, type, gsm),
      raw = knittingProductionValue(source),
      value = fabricQuantity(raw);
    if (!production.has(key)) production.set(key, { quantity: 0, known: false, missing: false });
    const entry = production.get(key)!;
    if (value === null || value < 0) {
      entry.missing = true;
      continue;
    }
    entry.quantity = productionSum([entry.quantity, value]);
    entry.known = true;
  }
  const remaining = new Map(Array.from(production, ([key, entry]) => [key, entry.quantity] as [string, number]));
  const ccBatches = new Set<string>();
  for (const section of components)
    for (const row of section.rows)
      if (Object.values(row.quantities || {}).some((quantity) => (quantity as number) > 0)) {
        for (const id of [row.id, row.bodyBatchId]) if (id) ccBatches.add(JSON.stringify([String(id), colourSelectionKey(row.shade)]));
      }
  return rows.map((row) => {
    const cells: Record<string, Row> = {},
      knownKeys = new Set(fabrics.map((fabric) => fabric.key));
    let hasRequired = false,
      short = false,
      unknown = false;
    let hasCC = ccBatches.has(JSON.stringify([String(row.id), colourSelectionKey(row.shade)]));
    for (const fabric of fabrics) {
      if (fabric.componentKind) {
        cells[fabric.key] = { kind: 'cc', label: 'Check CC Prod.' };
        continue;
      }
      const quantity = fabricQuantity(row.quantities?.[fabric.key]) || 0;
      if (quantity <= 0) continue;
      hasRequired = true;
      const key = knittingResourceKey(row.shade, fabric.type, fabric.gsm),
        entry = production.get(key),
        available = remaining.get(key) || 0;
      const ready = !!entry?.known && knittingQuantityAtLeast(available, quantity);
      const missing = !entry?.known;
      cells[fabric.key] = {
        kind: ready ? 'ready' : missing ? 'unknown' : 'short',
        label: ready ? 'Knit ok' : missing ? 'Knit prod. missing' : 'Not knit ok',
        availableKg: available,
        requiredKg: quantity,
        producedKg: entry?.quantity || 0,
      };
      if (!ready) {
        short = true;
        if (missing) unknown = true;
      }
      // Earlier listed batches reserve production per fabric, including partial
      // amounts. A later batch cannot reuse production reserved for an earlier one.
      remaining.set(key, productionSum([available, -Math.min(available, quantity)]));
    }
    for (const [key, value] of Object.entries(row.quantities || {}))
      if (!knownKeys.has(key) && (fabricQuantity(value) || 0) > 0) {
        hasRequired = true;
        short = true;
        unknown = true;
      }
    if (Object.values(row.componentKg || {}).some((quantity) => quantity === null || (quantity as number) > 0)) hasCC = true;
    const kind = short ? (unknown ? 'unknown' : 'short') : hasRequired || hasCC ? 'ready' : 'empty';
    const label = short ? (unknown ? 'Knit prod. missing' : 'Not knit ok') : hasCC ? 'Knit ok but need check CC Prod.' : hasRequired ? 'Knit ok' : 'No fabric qty';
    return { kind, label, cells, hasCC };
  });
}

/* ============================================================
   Machine evaluation and batch math
   ============================================================ */
export function firstUploadedValue(row: Row, headers: readonly string[]) {
  for (const header of headers) {
    const value = row[header];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}
export function rowFabricKey(row: Row): string {
  const fabric = String(row.FabricConstruction || row.Fabric || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const gsm = String(row.FinishGSM || row.GSM || '').trim();
  const gsmKey = /^\d+(\.\d+)?$/.test(gsm) ? String(Number(gsm)) : gsm.toLowerCase();
  return fabric + '|' + gsmKey;
}
export function loadingFraction(value: unknown): number | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const number = Number(text.replace(/%$/, '').trim());
  const fraction = text.includes('%') || number > 1 ? number / 100 : number;
  return Number.isFinite(fraction) && fraction > 0 && fraction <= 1 ? fraction : null;
}
export function kgText(quantityKg: unknown): string {
  return quantityKg === null ? 'Weight missing' : Number.isFinite(quantityKg) ? String(Number((quantityKg as number).toFixed(3))) : '';
}

// Nozzle counts follow rated capacity: 500 kg => 2, 1000 kg => 4.
export function machineNozzles(capacity: number): number {
  return Math.max(1, Math.ceil(capacity / BATCH_CALCULATION.kgPerNozzle));
}
export function isSemiBleach(shade: unknown): boolean {
  // RegExp.test converts its argument with String() exactly like the old test(shade).
  return /\bsemi[\s-]*bleach(?:ed)?\b/i.test(String(shade)) || /^rfd$/i.test(String(shade ?? '').trim());
}

/* ERP-specific adapter. The reusable selector itself has no factory rules.
   Every Setup machine is evaluated; constraints explain why a row is rejected. */
export function erpMachineConfigurations(shade: unknown, floor: Floor, fabrics: Row[]): Row[] {
  const pool = new Set<string | null>(machineFloorsForMenu(floor));
  return getMachineSetup()
    .filter((machine) => pool.has(normalizeFloor(machine.floor)) && String(machine.mcType).trim().toUpperCase() === 'BULK')
    .map((machine, index) => {
      const reasons: string[] = [];
      if (String(machine.mcType).trim().toUpperCase() !== 'BULK') reasons.push('MC Type must be Bulk.');
      if (!machineAllowsFabrics(machine, fabrics)) reasons.push('Fabric or GSM is restricted by Setup.');
      if (!String(machine.mcBrand ?? '').trim() || !String(machine.mcNo ?? '').trim()) reasons.push('Machine brand or number is missing.');
      const text = String(machine.loading ?? '').trim();
      // An unreadable loading gives null * 100 = 0 (rejected as an invalid percentage), as before.
      const configured = text === '' ? BATCH_CALCULATION.defaultMaximumLoadingPercent : (loadingFraction(machine.loading) as number) * 100;
      // Preserve the earlier textile-specific Semi Bleach exception in this adapter.
      // GenericMachineSelection never applies colour-specific or fixed limits.
      const maximumLoadingPercent = isSemiBleach(shade) ? BATCH_CALCULATION.semiBleachLoading * 100 : configured;
      return {
        ...machine,
        id: machine.id ?? index + 1,
        capacityKg: fabricQuantity(machine.capacity),
        maximumLoadingPercent,
        label: String(machine.mcBrand ?? '').trim() + '-' + String(machine.mcNo ?? '').trim(),
        rejectionReasons: reasons,
      };
    });
}

// No integer scaling or rounding is used when distributing production quantities.
export function splitColourQuantities(quantitiesKg: number[], batchCount: number): number[][] {
  return Array.from({ length: batchCount }, () => quantitiesKg.map((quantity) => quantity / batchCount));
}
/* Popup evaluations and saved manual machine selections.
   Choices belong to one booking, floor and normalized colour, so selecting a
   machine never changes another floor's or another colour's saved preference. */
// Project (plan section 16.3): a unit outside the demo's five floors uses the Dyeing MC machines whose
// 'Dyeing Floor' is that unit.
export function machineFloorsForMenu(floor: Floor): string[] {
  return (MACHINE_FLOOR_POOLS as Record<string, string[]>)[floor as string] || (floor ? [floor] : []);
}
export function colourSelectionKey(shade: unknown): string {
  return String(shade ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
export function machineEvaluationKey(group: Row): string {
  return group.selectionKey || colourSelectionKey(group.shade);
}
export function dyeingBatchGroupKey(shade: unknown, group: unknown): string {
  return JSON.stringify([colourSelectionKey(shade), group || 'together']);
}
export function savedColourMachine(booking: Row, floor: Floor, shade: unknown, selectionKey: string = colourSelectionKey(shade)): Row | null {
  const preferences = reportManualState(booking, floor).machineSelections;
  return preferences?.[selectionKey] ?? preferences?.[colourSelectionKey(shade)] ?? null;
}

/** Old `$('machineEvaluationStatus').textContent = text`: the machine evaluation dialog shows context.status. */
function setMachineEvaluationStatus(text: string): void {
  if (S.machineEvaluationContext) S.machineEvaluationContext.status = text;
  notify();
}
export async function loadMachineForColour(machineId: unknown): Promise<boolean> {
  if (!S.machineEvaluationContext || !canEditReport() || !S.reportDraft) return false;
  if (S.reportRowEditor) {
    toast('Save or cancel the row being edited before loading a machine.');
    return false;
  }
  const context: Row = { ...S.machineEvaluationContext },
    before = copyReportData(S.reportDraft);
  if (S.currentViewingNumber !== context.number || S.currentViewingFloor !== context.floor || S.activeFloor !== context.floor) {
    closeMachineEvaluation();
    return false;
  }
  const booking = currentReportBooking();
  if (!booking) return false;
  buildEditableReportTables(getFloorBooking(booking, context.floor), context.floor);
  const group = S.currentReportMachineEvaluations.find((value) => machineEvaluationKey(value) === context.shadeKey);
  const configuration = group?.rows.find((row: Row) => String(row.id) === String(machineId));
  if (!configuration?.eligible) {
    setMachineEvaluationStatus(configuration?.remarks || 'This machine is no longer eligible for the selected colour.');
    return false;
  }
  if (configuration.batches > BATCH_CALCULATION.maxRenderedBatches) {
    setMachineEvaluationStatus('This selection exceeds the report row limit. Choose a larger eligible machine.');
    return false;
  }
  // group is set here: configuration was found in group.rows.
  const evaluation = group as Row;
  S.reportDraft.manual.machineSelections = { ...S.reportDraft.manual.machineSelections, [context.shadeKey]: { machineId: configuration.id } };
  applyMachineToManualBatchRows(evaluation, configuration);
  S.reportDraft.dirty = true;
  setMutationBusy(true);
  try {
    const retained = await retainSavedReportDraft();
    if (S.currentViewingNumber === context.number && S.currentViewingFloor === context.floor) {
      const keepMachinePopup = !!S.machineEvaluationContext;
      refreshEditableReport({ keepMachinePopup });
      if (keepMachinePopup) {
        refreshMachineEvaluationPopup(context.shadeKey);
        setMachineEvaluationStatus(
          configuration.machine.label + (retained ? ' loaded and saved for ' : ' loaded in draft for ') + evaluation.shade + (retained ? '.' : '. ' + reportSaveHint())
        );
      }
    }
    toast(retained ? 'Machine loaded and saved.' : 'Machine loaded in draft. ' + reportSaveHint());
    return true;
  } catch (error) {
    if (S.currentViewingNumber === context.number && S.currentViewingFloor === context.floor) S.reportDraft = before;
    showSaveError(error);
    if (S.currentViewingNumber === context.number && S.currentViewingFloor === context.floor) {
      refreshEditableReport({ keepMachinePopup: !!S.machineEvaluationContext });
      if (S.machineEvaluationContext) {
        refreshMachineEvaluationPopup(context.shadeKey);
        setMachineEvaluationStatus('Could not save. Previous machine assignment remains in place.');
      }
    }
    return false;
  } finally {
    setMutationBusy(false);
  }
}

// Decimal source quantities stay unrounded; only table cells are formatted.
export function productionFraction(value: unknown): { n: bigint; d: bigint } {
  const [coefficient, exponent = '0'] = String(value).toLowerCase().split('e');
  const [whole, fraction = ''] = coefficient.split('.'),
    power = Number(exponent) - fraction.length;
  return power >= 0 ? { n: BigInt(whole + fraction) * B10 ** BigInt(power), d: B1 } : { n: BigInt(whole + fraction), d: B10 ** BigInt(-power) };
}
export function productionSum(values: Iterable<unknown>): number {
  let n = B0,
    d = B1;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    const part = productionFraction(value);
    n = n * part.d + part.n * d;
    d *= part.d;
    let a = n < B0 ? -n : n,
      b = d;
    while (b) {
      const next = a % b;
      a = b;
      b = next;
    }
    if (a) {
      n /= a;
      d /= a;
    }
  }
  return Number(n) / Number(d);
}
export function productionMultiply(a: unknown, b: unknown): number {
  const x = productionFraction(a),
    y = productionFraction(b);
  return Number(x.n * y.n) / Number(x.d * y.d);
}
export function availableComponentKinds(booking: Row | null | undefined, floor: Floor): string[] {
  if (!booking) return [];
  const kinds = new Set<string>(getReportBpRows(booking, floor).flatMap((row: Row) => componentKinds(bpValue(row, 'details'))));
  return COMPONENT_KINDS.filter(([kind]) => kinds.has(kind)).map(([kind]) => kind);
}
export function fabricDyeingChoice(booking: Row, floor: Floor, fabricKey: string, shade: unknown) {
  const choices = reportManualState(booking, floor).fabricSeparate?.[fabricKey];
  const key = colourSelectionKey(shade);
  return choices && Object.prototype.hasOwnProperty.call(choices, key) ? choices[key] : choices?.['*'];
}
export function componentIsSeparate(booking: Row, floor: Floor, kind: string, shade: unknown = null, fabricType: unknown = null): boolean {
  if (componentDyeingType(booking, floor, kind) === 'YD') return true;
  if (shade !== null && fabricType !== null) {
    const choice = fabricDyeingChoice(booking, floor, 'component:' + kind + ':' + colourSelectionKey(fabricType), shade);
    if (choice !== undefined) return choice === true;
  }
  return reportManualState(booking, floor).componentSeparate?.[kind] === true;
}
export function componentFabricRows(booking: Row, floor: Floor): Row[] {
  const groups = new Map<string, { key: string; type: string; kind: string; pcs: number[]; kg: number[]; missingPcs: boolean; missingKg: boolean }>();
  for (const row of getReportBpRows(booking, floor))
    for (const kind of componentKinds(bpValue(row, 'details'))) {
      const type = String(bpValue(row, 'fabricType')).trim(),
        key = 'component:' + kind + ':' + colourSelectionKey(type);
      if (!groups.has(key)) groups.set(key, { key, type, kind, pcs: [], kg: [], missingPcs: false, missingKg: false });
      const group = groups.get(key)!,
        pcs = fabricQuantity(bpValue(row, 'quantity')),
        kg = fabricQuantity(bpValue(row, 'quantityKg'));
      if (pcs === null) group.missingPcs = true;
      else group.pcs.push(pcs);
      if (kg === null) group.missingKg = true;
      else group.kg.push(kg);
    }
  return Array.from(groups.values()).map((group) => ({
    key: group.key,
    type: group.type,
    componentKind: group.kind,
    composition: '',
    yarn: '',
    gsm: '',
    width: '',
    gaugeDia: '',
    greyWaste: '',
    greigeQty: '',
    dryMethod: '',
    remarks: '',
    requiredFinish: (group.missingPcs ? '—' : kgText(productionSum(group.pcs))) + ' Pcs & ' + (group.missingKg ? '—' : kgText(productionSum(group.kg))) + ' Kg',
  }));
}
export function componentRowTotals(row: Row): Row {
  row.totalPcs = productionSum(Object.values(row.quantities || {}));
  const parts = Object.entries(row.quantities || {}).filter(([, qty]) => (qty as number) > 0);
  row.totalKg = parts.some(([size]) => row.weights?.[size] === null || !Number.isFinite(row.weights?.[size]) || row.weights[size] < 0)
    ? null
    : productionSum(parts.map(([size, qty]) => productionMultiply(qty, row.weights[size])));
  return row;
}
export function bodyBatchQuantity(row: Row, fabrics: Row[] = S.currentFabricRows): number {
  const componentKeys = new Set(fabrics.filter((fabric) => fabric.componentKind).map((fabric) => fabric.key));
  return productionSum(
    Object.entries(row.quantities || {})
      .filter(([key]) => !componentKeys.has(key))
      .map(([, qty]) => fabricQuantity(qty) || 0)
  );
}

/** Old componentMassIndex result: a Map of per-batch component kg with a `kinds` list on the Map itself. */
export type ComponentMassIndex = Map<string, Row> & { kinds: string[] };
export type BatchMass = { bodyKg: number; componentKg: Record<string, number | null>; totalKg: number | null };

export function componentMassIndex(sections: Row[]): ComponentMassIndex {
  const index = new Map<string, Row>() as ComponentMassIndex;
  index.kinds = sections.map((section) => section.kind);
  for (const section of sections)
    for (const row of section.rows) {
      const key = JSON.stringify([String(row.id), colourSelectionKey(row.shade)]);
      if (!index.has(key)) index.set(key, {});
      const totals = index.get(key)!;
      totals[section.kind] = row.totalKg === null || totals[section.kind] === null ? null : productionSum([totals[section.kind] || 0, row.totalKg]);
    }
  return index;
}
export function batchMass(row: Row, sections: Row[] | ComponentMassIndex): BatchMass {
  const componentKg: Record<string, number | null> = {},
    bodyKg = bodyBatchQuantity(row);
  const index = sections instanceof Map ? sections : componentMassIndex(sections),
    totals: Row = index.get(JSON.stringify([String(row.id), colourSelectionKey(row.shade)])) || {};
  for (const kind of index.kinds) componentKg[kind] = totals[kind] === null ? null : totals[kind] || 0;
  return { bodyKg, componentKg, totalKg: Object.values(componentKg).some((qty) => qty === null) ? null : productionSum([bodyKg, ...Object.values(componentKg)]) };
}
export function machineFabricsWithComponents(fabrics: Row[], booking: Row | null | undefined, floor: Floor, shade: unknown, bodyRows: Row[], targetRows: Row[] = bodyRows): Row[] {
  if (!booking) return fabrics;
  const key = colourSelectionKey(shade),
    sections = buildComponentBatches(booking, floor, bodyRows),
    ids = new Set(targetRows.map((row) => String(row.id)));
  return [
    ...fabrics,
    ...sections.flatMap((section: Row) =>
      section.rows
        .filter((row: Row) => !row.separate && ids.has(String(row.id)) && colourSelectionKey(row.shade) === key && row.totalPcs > 0)
        .map((row: Row) => ({ type: row.fabricType, gsm: '', componentKind: section.kind }))
    ),
  ];
}
export function componentColourSummary(booking: Row, floor: Floor, shades: unknown[]): Map<string, Row> {
  const seeds = shades.map((shade, index) => ({ id: normalizeBookingKey(booking.number) + String(index + 1).padStart(3, '0'), shade, quantities: {} }));
  const sections = buildComponentBatches(booking, floor, seeds),
    summary = new Map<string, Row>();
  for (const shade of shades) {
    const key = colourSelectionKey(shade),
      rows: Row[] = sections.flatMap((section: Row) =>
        section.rows.filter((row: Row) => !row.separate && colourSelectionKey(row.shade) === key).map((row: Row) => ({ ...row, componentKind: section.kind }))
      );
    summary.set(key, {
      kg: productionSum(rows.map((row) => row.totalKg ?? 0)),
      missing: rows.some((row) => row.totalKg === null),
      fabrics: rows.filter((row) => row.totalPcs > 0).map((row) => ({ type: row.fabricType, gsm: '', componentKind: row.componentKind })),
    });
  }
  return summary;
}

export type CombinedMachineInputs = {
  totalQuantityKg: number;
  bodyQuantityKg: number;
  machines: Row[];
  booking: Row;
  floor: Floor;
  shade: unknown;
  bodyRows?: Row[];
  dyeingGroup?: unknown;
  componentAnchor?: unknown;
};
// The generic ceil/distribution/ranking formula is unchanged. This validation
// also checks actual whole-piece allocations against each candidate's limit.
export function evaluateCombinedMachines({
  totalQuantityKg,
  bodyQuantityKg,
  machines,
  booking,
  floor,
  shade,
  bodyRows = [],
  dyeingGroup,
  componentAnchor,
}: CombinedMachineInputs): MachineSelectionResult {
  let initial: MachineSelectionResult;
  try {
    initial = GenericMachineSelection.selectMachine({ totalQuantityKg, machines, maximumLoadingPercent: BATCH_CALCULATION.defaultMaximumLoadingPercent });
  } catch (error) {
    if (error instanceof GenericMachineSelection.MachineSelectionError) throw error;
    throw error;
  }
  if (!availableComponentKinds(booking, floor).length) return initial;
  const portions = new Map<number, (number | null)[]>(),
    key = colourSelectionKey(shade);
  for (const config of initial.evaluations) {
    if (!config.eligible || config.batches > BATCH_CALCULATION.maxRenderedBatches) continue;
    if (!portions.has(config.batches)) {
      const matches = (row: Row) => colourSelectionKey(row.shade) === key && row.dyeingGroup === dyeingGroup;
      const source = bodyRows.filter(matches);
      const proposed: Row[] = Array.from({ length: config.batches }, (_, index) => ({
        id: source[index]?.id || '',
        manualNumber: !!source[index]?.id,
        shade,
        quantities: {},
        tallBig: source[index]?.tallBig || (automaticTallBig(booking, floor) ? source[0]?.tallBig : '') || '',
        ...(dyeingGroup === undefined ? {} : { dyeingGroup, componentAnchor }),
      }));
      const others = bodyRows.filter((row) => !matches(row));
      const proposedRows = [...others, ...proposed];
      renumberReportBatches(proposedRows, booking.number);
      const prior = S.currentReportBatchRowsTruncated;
      S.currentReportBatchRowsTruncated = false;
      let sections: Row[];
      try {
        sections = buildComponentBatches(booking, floor, proposedRows);
      } finally {
        S.currentReportBatchRowsTruncated = prior;
      }
      portions.set(
        config.batches,
        proposed.map((row) => {
          const mass = batchMass(row, sections);
          return mass.totalKg === null ? null : productionSum([bodyQuantityKg / config.batches, mass.totalKg]);
        })
      );
    }
    // Both are set here, as in the old code (portions just above; config came from these machines).
    const weights = portions.get(config.batches)!,
      machine = machines.find((machine) => String(machine.id) === String(config.id))!;
    if (weights.some((weight) => weight === null)) {
      machine.rejectionReasons.push('Weight /Pcs is missing for a together component.');
      continue;
    }
    const maximum = Math.max(...(weights as number[]));
    if (maximum > 0) {
      try {
        const one = GenericMachineSelection.selectMachine({ totalQuantityKg: maximum, machines: [config.machine], maximumLoadingPercent: BATCH_CALCULATION.defaultMaximumLoadingPercent });
        if (one.selected.batches !== 1) machine.rejectionReasons.push('Whole-piece component allocation exceeds this machine’s permitted loading in a batch.');
      } catch (error) {
        if (!(error instanceof GenericMachineSelection.MachineSelectionError)) throw error;
        machine.rejectionReasons.push('Component batch loading exceeds the machine limit.');
      }
    }
  }
  return GenericMachineSelection.selectMachine({ totalQuantityKg, machines, maximumLoadingPercent: BATCH_CALCULATION.defaultMaximumLoadingPercent });
}
export function isCalculatedBatchField(field: string): boolean {
  return (
    field === 'knitStatus' ||
    field === 'totalKg' ||
    field.startsWith('componentKg:') ||
    (field.startsWith('qty:') && S.currentFabricRows.some((fabric) => fabric.key === field.slice(4) && fabric.componentKind))
  );
}

/* ============================================================
   Colour batch generation
   ============================================================ */
export type DyeingBatchGroup = { key: string; label: string; peach: boolean };
export type DyeingBatchResult = { batches: Row[]; warnings: string[]; evaluations: Row[] };

// Finish grouping is an ERP input constraint. Each resulting group is passed
// through the unchanged generic quantity, loading and ranking formula.
export function fabricBatchGroup(fabric: Row, shade: unknown, peach: boolean, booking: Row, floor: Floor): DyeingBatchGroup {
  const separate = fabricDyeingChoice(booking, floor, fabric.key, shade) === true;
  return {
    key: separate ? 'separate:' + fabric.key + ':' + (peach ? 'peach' : 'regular') : peach ? 'peach' : 'together',
    label: separate ? (fabric.name || 'Fabric') + (peach ? ' · Peach' : ' · Separate') : peach ? 'Peach' : 'Non-peach',
    peach,
  };
}
export function addDyeingGroupQuantity(colour: Row, fabrics: Row[], index: number, quantity: number, peach: boolean, booking: Row, floor: Floor): void {
  const definition = fabricBatchGroup(fabrics[index], colour.shade, peach, booking, floor);
  if (!colour.groups.has(definition.key)) colour.groups.set(definition.key, { ...definition, quantities: Array(fabrics.length).fill(0) });
  const group = colour.groups.get(definition.key);
  group.quantities[index] = productionSum([group.quantities[index], quantity]);
}
export function fabricPeachForColour(fabric: Row, shade: unknown, booking: Row, floor: Floor): boolean {
  if (fabric.manual) return hasPeachFinish(fabric.remarks);
  const source = getReportKnittingRows(booking.number, floor).filter(
    (row: Row) => rowFabricKey(row) === fabric.key && colourSelectionKey(firstUploadedValue(row, BATCH_CALCULATION.colorHeaders)) === colourSelectionKey(shade)
  );
  return source.length ? source.every((row: Row) => hasPeachFinish(row._fabricColumns?.peach)) : hasPeachFinish(fabric.remarks);
}
export function orderDyeingModeBatches(rows: Row[], fabrics: Row[], booking: Row, floor: Floor): Row[] {
  const quantity = (row: Row, fabric: Row, index: number) => (Array.isArray(row.quantities) ? row.quantities[index] : row.quantities?.[fabric.key]);
  const active = rows.some((row) =>
    fabrics.some((fabric, index) => !fabric.componentKind && quantity(row, fabric, index) > 0 && fabricDyeingChoice(booking, floor, fabric.key, row.shade) === true)
  );
  if (!active) return rows;
  // Number separated dyeing groups in Fabric Info order, regardless of the
  // uploaded item/colour order. Keep every batch of a fabric together.
  const firstFabric = (row: Row) => {
    const index = fabrics.findIndex((fabric, index) => !fabric.componentKind && quantity(row, fabric, index) > 0);
    return index < 0 ? fabrics.length : index;
  };
  rows.sort((a, b) => firstFabric(a) - firstFabric(b));
  return rows;
}
export function generateColourBatches(booking: Row, fabrics: Row[], floor: Floor = S.activeFloor): DyeingBatchResult {
  const slots = new Map(fabrics.filter((fabric) => !fabric.componentKind).map((fabric) => [fabric.key, fabrics.indexOf(fabric)] as [string, number]));
  const colours = new Map<string, Row>();
  for (const row of getReportKnittingRows(booking.number, floor)) {
    const shade = String(firstUploadedValue(row, BATCH_CALCULATION.colorHeaders)).trim(),
      key = colourSelectionKey(shade),
      index = slots.get(rowFabricKey(row));
    if (index === undefined) continue; // A manually deleted fabric stays deleted.
    if (!colours.has(key)) colours.set(key, { shade, quantities: Array(fabrics.length).fill(0), groups: new Map(), ld: new Map(), reference: new Map(), invalid: false });
    const colour = colours.get(key)!;
    addDistinctFabricValue(colour.ld, knittingInfoValue(row, 'ld'));
    addDistinctFabricValue(colour.reference, knittingInfoValue(row, 'reference'));
    const qty = fabricQuantity(knittingInfoValue(row, 'greigeQty'));
    if (qty === null || qty < 0) {
      colour.invalid = true;
      addDyeingGroupQuantity(colour, fabrics, index, 0, hasPeachFinish(row._fabricColumns?.peach), booking, floor);
      continue;
    }
    colour.quantities[index] = productionSum([colour.quantities[index], qty]);
    addDyeingGroupQuantity(colour, fabrics, index, qty, fabrics[index].manual ? hasPeachFinish(fabrics[index].remarks) : hasPeachFinish(row._fabricColumns?.peach), booking, floor);
  }
  // A manually edited Greige Qty is distributed across its uploaded colours in
  // their original greige proportions; finish quantities never drive loading.
  fabrics.forEach((fabric, index) => {
    if (fabric.componentKind) return;
    const source = productionSum(Array.from(colours.values()).map((colour) => colour.quantities[index])),
      target = fabricQuantity(fabric.greigeQty);
    if (source > 0 && target !== null && target >= 0 && target !== source)
      for (const colour of colours.values()) for (const group of colour.groups.values()) group.quantities[index] = (group.quantities[index] / source) * target;
  });
  return createDyeingBatches(booking, fabrics, floor, colours);
}
export function createDyeingBatches(booking: Row, fabrics: Row[], floor: Floor, colours: Map<string, Row>): DyeingBatchResult {
  const warnings: string[] = [];
  const componentSummary = componentColourSummary(
    booking,
    floor,
    Array.from(colours.values()).map((colour) => colour.shade)
  );
  const batches: Row[] = [],
    evaluations: Row[] = [],
    bookingKey = normalizeBookingKey(booking.number);
  for (const colour of colours.values()) {
    let groups: Row[] = Array.from(colour.groups.values());
    if (groups.some((group) => group.quantities.some((qty: number) => qty > 0))) groups = groups.filter((group) => group.quantities.some((qty: number) => qty > 0));
    const together = componentSummary.get(colourSelectionKey(colour.shade));
    let anchor = groups.find((group) => group.key === 'together') || groups.find((group) => group.key === 'peach') || groups.find((group) => group.key === 'components');
    if (!anchor && (together?.kg > 0 || together?.missing)) {
      anchor = { key: 'components', label: 'Together components', peach: false, quantities: Array(fabrics.length).fill(0) };
      groups.push(anchor);
    }
    for (const group of groups) {
      const componentAnchor = group === anchor,
        components = componentAnchor ? together : null;
      const bodyTotal = productionSum(group.quantities),
        total = productionSum([bodyTotal, components?.kg || 0]);
      const selectionKey = groups.length === 1 ? colourSelectionKey(colour.shade) : dyeingBatchGroupKey(colour.shade, group.key),
        groupLabel = groups.length === 1 ? '' : group.label;
      if (!colour.shade || !Number.isFinite(total)) colour.invalid = true;
      const used = [...fabrics.filter((fabric, index) => !fabric.componentKind && group.quantities[index] > 0), ...(components?.fabrics || [])];
      let selected: Row | null = null;
      if (colour.invalid) warnings.push(`${colour.shade || 'Blank colour'}: check uploaded fabric, GSM, colour and non-negative Greige Qty; no machine was assigned.`);
      else if (total === 0) warnings.push(`${colour.shade}: total quantity is zero; no machine was assigned.`);
      else if (floor) {
        const machines = erpMachineConfigurations(colour.shade, floor, used);
        if (components?.missing) machines.forEach((machine) => machine.rejectionReasons.push('BP Data Weight /Pcs is missing for together components.'));
        try {
          const evaluated = evaluateCombinedMachines({
            totalQuantityKg: total,
            bodyQuantityKg: bodyTotal,
            machines,
            booking,
            floor,
            shade: colour.shade,
            bodyRows: batches.map((batch) => autoBatchRow(batch, fabrics)),
            dyeingGroup: group.key,
            componentAnchor,
          });
          selected = evaluated.selected;
          const preference = savedColourMachine(booking, floor, colour.shade, selectionKey),
            loaded = preference ? evaluated.evaluations.find((row) => String(row.id) === String(preference.machineId) && row.eligible) : null;
          if (loaded) selected = loaded;
          else if (preference) warnings.push(`${colour.shade}: the saved machine is not currently eligible; the recommended machine is applied.`);
          evaluated.evaluations.forEach((row) => {
            row.applied = row === selected;
            row.appliedBy = loaded ? 'manual' : 'automatic';
          });
          evaluations.push({ shade: colour.shade, dyeingGroup: group.key, componentAnchor, selectionKey, groupLabel, rows: evaluated.evaluations, error: '', totalQuantityKg: total });
        } catch (error) {
          if (!(error instanceof GenericMachineSelection.MachineSelectionError)) throw error;
          warnings.push(`${colour.shade}${groupLabel ? ' · ' + groupLabel : ''}: ${error.message}`);
          evaluations.push({
            shade: colour.shade,
            dyeingGroup: group.key,
            componentAnchor,
            selectionKey,
            groupLabel,
            rows: error.evaluations,
            error: error.message,
            totalQuantityKg: total,
          });
        }
      }
      const machine = selected ? { ...selected.machine, capacity: selected.capacityKg } : null,
        count = selected?.batches || 1,
        displayedCount = Math.min(count, BATCH_CALCULATION.maxRenderedBatches);
      if (displayedCount < count)
        warnings.push(
          `${colour.shade}: selected configuration requires ${count} batches. Only the first ${displayedCount} are displayed; evaluation and ranking use the complete configuration.`
        );
      for (let index = 0; index < displayedCount; index++)
        batches.push({
          id: bookingKey + String(batches.length + 1).padStart(3, '0'),
          shade: colour.shade,
          dyeingGroup: group.key,
          peachFinish: group.peach,
          componentAnchor,
          selectionKey,
          ld: Array.from(colour.ld.values()).join(', '),
          reference: Array.from(colour.reference.values()).join(', '),
          quantities: group.quantities.map((qty: number) => qty / count),
          totalQuantityKg: total / count,
          machine,
          loading: selected ? String(Number(selected.actualLoadingPercent.toFixed(2))) + '%' : '',
          nozzle: machine ? machineNozzles(machine.capacity) : '',
        });
    }
  }
  orderDyeingModeBatches(batches, fabrics, booking, floor);
  batches.forEach((batch, index) => {
    batch.id = bookingKey + String(index + 1).padStart(3, '0');
  });
  return { batches, warnings, evaluations };
}
