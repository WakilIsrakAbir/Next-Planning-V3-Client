/* Batch Plan report: BP Data rows and the collar/cuff/hem/placket component batches
   (re-exported by report-model.ts). Port of the old js/batch/batch-app.js functions; the rules are unchanged.
   BP components share the colour batch count. Together weights are included in the input to the
   unchanged generic selection formula. */
import { BATCH_CALCULATION, BP_DATA_HEADERS, COMPONENT_KINDS } from '@/features/batch/constants';
import { BATCH_FLOORS, S } from '@/features/batch/store/batch-store';
import { getStoredDatasets, setMutationBusy, showSaveError, toast } from './storage';
import {
  applyComponentAllowance,
  colourSelectionKey,
  componentIsSeparate,
  componentRowTotals,
  fabricDyeingChoice,
  fabricQuantity,
  firstUploadedValue,
  productionMultiply,
  productionSum,
} from './batch-calculation';
import {
  canEditReport,
  confirmedBpSnapshotRows,
  frozenConfirmedReport,
  getKnittingRows,
  getReportKnittingRows,
  knittingInfoHeaderKey,
  normalizeBookingKey,
  normalizeFloor,
  reportSaveHint,
  reviewingLatest,
  sourceBooking,
} from './bookings';
import { refreshEditableReport } from './report-actions';
import { copyReportData, reportBookingStatus, reportManualState, retainSavedReportDraft, savedReportPlan } from './report-model';
import { applyTallBigComponentAllocation } from './report-tall-big';
import { odSettings } from './report-od';
import type { Row } from '@/features/batch/types';

type Floor = string | null;
type CellValue = Row[string];

/** A component size from BP Data (CCSize, or Length x Width). */
export type ComponentSize = { key: string; label: string; length: number; width: number; numeric: boolean };

export function bpValue(row: Row, field: string): CellValue {
  const values = new Map<string, CellValue>(
    Object.entries(row)
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
      .map(([key, value]) => [knittingInfoHeaderKey(key), value])
  );
  for (const header of (BP_DATA_HEADERS as Record<string, string[] | undefined>)[field] || [])
    if (values.has(knittingInfoHeaderKey(header))) return values.get(knittingInfoHeaderKey(header));
  return '';
}
export function getBpRows(number: unknown, floor: Floor = null, knittingRows: Row[] | null = null, additionalColours: unknown[] | null = null): Row[] {
  const dataset = getStoredDatasets().bpData || null;
  if (S.indexedBpData !== dataset) {
    S.indexedBpData = dataset;
    S.bpBookingIndex = new Map();
    for (const [key, rows] of Object.entries(dataset || {})) {
      const normalized = normalizeBookingKey(key);
      if (!S.bpBookingIndex.has(normalized)) S.bpBookingIndex.set(normalized, []);
      for (const row of rows) S.bpBookingIndex.get(normalized)!.push(row);
    }
  }
  const rows = S.bpBookingIndex.get(normalizeBookingKey(number)) || [];
  if (!floor) return rows;
  const manualColours: unknown[] =
    additionalColours ||
    ((sourceBooking(number) && savedReportPlan(sourceBooking(number)!, floor).reportOverrides?.batchRows) || []).map((row: Row) => row.shade);
  const colours = new Set([
    ...(knittingRows || getKnittingRows(number, floor)).map((row) => colourSelectionKey(firstUploadedValue(row, BATCH_CALCULATION.colorHeaders))),
    ...manualColours.map(colourSelectionKey),
  ]);
  return rows.filter((row) => {
    // Project (plan section 16.3): a BP floor counts only when it is one of the current units.
    const assignedFloor = normalizeFloor(bpValue(row, 'floor'));
    if (assignedFloor && BATCH_FLOORS.some((item) => item.key === assignedFloor)) return assignedFloor === floor;
    const colour = colourSelectionKey(bpValue(row, 'colour'));
    return !colour || colours.has(colour);
  });
}
export function getReportBpRows(booking: Row, floor: Floor, additionalColours: unknown[] = []): Row[] {
  const capture = S.confirmedCaptureContext;
  if (capture?.booking.number === booking.number && (capture as Row).floor === floor) {
    const snapshot = savedReportPlan((capture as Row).booking, floor).confirmedSnapshot;
    if (snapshot) return confirmedBpSnapshotRows(snapshot);
  }
  if (reviewingLatest(booking.number, floor) && S.reportDraft?.reviewLatest) return S.reportDraft.reviewBpRows;
  const plan = savedReportPlan(booking, floor);
  if (reportBookingStatus(booking, floor) === 'Confirm' && plan.confirmedSnapshot?.bpSourceRows !== undefined) return confirmedBpSnapshotRows(plan.confirmedSnapshot);
  return getBpRows(booking.number, floor, getReportKnittingRows(booking.number, floor), [
    ...(reportManualState(booking, floor).batchRows || []).map((row: Row) => row.shade),
    ...additionalColours,
  ]);
}
export function componentKinds(details: unknown): string[] {
  return COMPONENT_KINDS.filter(([key]) => new RegExp(key, 'i').test(String(details))).map(([key]) => key);
}
export function componentDimension(value: unknown): number | null {
  const text = String(value)
    .trim()
    .replace(/(?:inches|inch|in|cm|mm|["“”″'])\s*$/i, '')
    .trim();
  const mixed = text.match(/^(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?$/);
  if (mixed && (!mixed[3] || Number(mixed[3]) > 0)) return Number(mixed[1]) + (mixed[2] ? Number(mixed[2]) / Number(mixed[3]) : 0);
  const fraction = text.match(/^(\d+)\/(\d+)$/);
  return fraction && Number(fraction[2]) > 0 ? Number(fraction[1]) / Number(fraction[2]) : null;
}
export function componentSize(row: Row): ComponentSize | null {
  let raw = String(bpValue(row, 'size')).trim();
  if (!raw) {
    const length = bpValue(row, 'length'),
      width = bpValue(row, 'width');
    if (length !== '' && width !== '') raw = length + ' x ' + width;
  }
  if (!raw) return null;
  const parts = raw.split(/\s*[x×*]\s*/i),
    length = parts.length === 2 ? componentDimension(parts[0]) : null,
    width = parts.length === 2 ? componentDimension(parts[1]) : null;
  const numeric = length !== null && width !== null && Number.isFinite(length) && Number.isFinite(width) && length > 0 && width > 0;
  const label = numeric ? length + ' x ' + width : raw.replace(/\s+/g, ' ');
  return { key: label.toLowerCase(), label, length: numeric ? length : Infinity, width: numeric ? width : Infinity, numeric };
}
export function compareComponentSizes(a: ComponentSize, b: ComponentSize): number {
  return a.length - b.length || a.width - b.width || a.label.localeCompare(b.label, undefined, { numeric: true });
}
export function componentDyeingType(booking: Row, floor: Floor, kind: string): 'YD' | 'Solid' {
  return reportManualState(booking, floor).componentTypes?.[kind] === 'YD' ? 'YD' : 'Solid';
}
export function componentBatchAllocator(number: unknown, bodyRows: Row[]): () => string {
  const prefix = normalizeBookingKey(number),
    used = new Set(bodyRows.map((row) => String(row.id || '')));
  // BigInt(1) is the old `1n` (the project compiles to ES2017, which has no bigint literals).
  let next = BigInt(1),
    hasNumber = false;
  for (const row of bodyRows) {
    const id = String(row.id || '');
    const suffix = id.startsWith(prefix) ? id.slice(prefix.length) : '';
    if (/^\d+$/.test(suffix)) {
      const following = BigInt(suffix) + BigInt(1);
      if (following > next) next = following;
      hasNumber = true;
    }
  }
  if (!hasNumber) next = BigInt(bodyRows.length) + BigInt(1);
  return () => {
    let id: string;
    do {
      id = prefix + String(next++).padStart(3, '0');
    } while (used.has(id));
    used.add(id);
    return id;
  };
}
export function overlayComponentRows(section: Row, booking: Row, floor: Floor): void {
  const manual = reportManualState(booking, floor).componentRows?.[section.kind];
  if (!manual) return;
  section.rows = copyReportData(manual);
  section.manual = true;
  const sizes = new Map<string, ComponentSize>(section.sizes.map((size: ComponentSize) => [size.key, size]));
  for (const row of section.rows)
    for (const key of Object.keys(row.quantities || {})) {
      if (!sizes.has(key)) {
        const size = componentSize({ CCSize: key });
        if (size) sizes.set(size.key, size);
      }
    }
  section.sizes = Array.from(sizes.values()).sort(compareComponentSizes);
}
/** The component sections (collar, cuff, hem, placket) with their batch rows, allocated from BP Data. */
export function buildComponentBatches(booking: Row | null | undefined, floor: Floor, bodyRows: Row[] = S.currentBatchRows): Row[] {
  if (!booking) return [];
  const frozen = frozenConfirmedReport(booking, floor);
  if (frozen) return copyReportData(frozen.components || []);
  const source = getReportBpRows(
      booking,
      floor,
      bodyRows.map((row) => row.shade)
    ),
    sections = new Map<string, Row>(),
    bodyByColour = new Map<string, Row[]>();
  if (!source.length) return [];
  for (const row of bodyRows) {
    const key = colourSelectionKey(row.shade);
    if (!key || !String(row.id || '').trim()) continue;
    if (!bodyByColour.has(key)) bodyByColour.set(key, []);
    if (!bodyByColour.get(key)!.some((batch) => batch.id === row.id)) bodyByColour.get(key)!.push(row);
  }
  for (const row of source) {
    const kinds = componentKinds(bpValue(row, 'details'));
    for (const kind of kinds) {
      if (!sections.has(kind))
        sections.set(kind, {
          kind,
          title: COMPONENT_KINDS.find(([key]) => key === kind)![1] + ' Batch Info',
          dyeingType: componentDyeingType(booking, floor, kind),
          groups: new Map(),
          sizes: new Map(),
          warnings: [],
          rows: [],
        });
      const section = sections.get(kind)!,
        shade = String(bpValue(row, 'colour')).trim(),
        colourKey = colourSelectionKey(shade),
        fabricType = String(bpValue(row, 'fabricType')).trim();
      const size = componentSize(row),
        qty = fabricQuantity(bpValue(row, 'quantity'));
      if (!colourKey) {
        section.warnings.push('BP Data has a component row with no Color; no pieces were allocated.');
        continue;
      }
      if (!size) {
        section.warnings.push(shade + ': size is missing. Use CCSize (length x width), or separate Length and Width columns.');
        continue;
      }
      if (qty === null || !Number.isSafeInteger(qty) || qty < 0) {
        section.warnings.push(shade + ' · ' + size.label + ': RequiredQtyPCs must be a non-negative whole number.');
        continue;
      }
      if (!size.numeric) section.warnings.push(shade + ': size "' + size.label + '" is not length x width; it is listed after numeric sizes.');
      if (kinds.length > 1)
        section.warnings.push(shade + ': FabricDetails identifies multiple components. Verify that RequiredQtyPCs is the quantity required for each component.');
      section.sizes.set(size.key, size);
      const groupKey = JSON.stringify([colourKey, fabricType.toLowerCase()]);
      if (!section.groups.has(groupKey))
        section.groups.set(groupKey, { colourKey, shade, fabricType, quantities: {}, sourceWeights: {}, weights: {}, invalid: false });
      const group = section.groups.get(groupKey),
        total = (group.quantities[size.key] || 0) + qty;
      if (!Number.isSafeInteger(total)) {
        group.invalid = true;
        section.warnings.push(shade + ': component quantity exceeds the supported whole-piece range.');
        continue;
      }
      const weight = fabricQuantity(bpValue(row, 'weight'));
      if (!group.sourceWeights[size.key]) group.sourceWeights[size.key] = [];
      group.sourceWeights[size.key].push({ qty, weight: weight !== null && weight >= 0 ? weight : null });
      group.quantities[size.key] = total;
    }
  }
  const nextId = componentBatchAllocator(booking.number, bodyRows),
    colourOrder = Array.from(bodyByColour.keys());
  const result: Row[] = [];
  for (const [kind] of COMPONENT_KINDS) {
    if (!sections.has(kind)) continue;
    const section = sections.get(kind)!,
      colourIds = new Map<string, unknown[]>();
    section.sizes = Array.from(section.sizes.values() as Iterable<ComponentSize>).sort(compareComponentSizes);
    const groups: Row[] = Array.from(section.groups.values() as Iterable<Row>).sort((a, b) => {
      const aIndex = colourOrder.indexOf(a.colourKey),
        bIndex = colourOrder.indexOf(b.colourKey);
      return (aIndex < 0 ? Infinity : aIndex) - (bIndex < 0 ? Infinity : bIndex) || a.colourKey.localeCompare(b.colourKey) || a.fabricType.localeCompare(b.fabricType);
    });
    for (const group of groups)
      for (const [size, items] of Object.entries(group.sourceWeights) as [string, Row[]][]) {
        const active = items.filter((item) => item.qty > 0),
          pieces = productionSum(active.map((item) => item.qty));
        group.weights[size] = active.some((item) => item.weight === null)
          ? null
          : pieces > 0
            ? productionSum(active.map((item) => productionMultiply(item.qty, item.weight))) / pieces
            : (items.find((item) => item.weight !== null)?.weight ?? null);
      }
    section.separate = componentIsSeparate(booking, floor, kind);
    applyComponentAllowance(section, groups, booking, floor);
    for (const group of groups) {
      const separate = componentIsSeparate(booking, floor, kind, group.shade, group.fabricType),
        allBatches = bodyByColour.get(group.colourKey) || [];
      const batches = !separate && allBatches.some((batch) => batch.componentAnchor !== undefined) ? allBatches.filter((batch) => batch.componentAnchor) : allBatches;
      if (!batches.length) {
        section.warnings.push(group.shade + ': no matching Colour & Batch Info batches on this floor; no pieces were allocated.');
        continue;
      }
      if (group.invalid) continue;
      if (S.currentReportBatchRowsTruncated) {
        section.warnings.push('The body batch display is truncated. Component allocation requires the complete body batch list.');
        continue;
      }
      const modeKey = JSON.stringify([
        group.colourKey,
        separate ? 'separate' : 'together',
        separate && fabricDyeingChoice(booking, floor, 'component:' + kind + ':' + colourSelectionKey(group.fabricType), group.shade) === true ? group.fabricType : '',
      ]);
      if (!colourIds.has(modeKey)) colourIds.set(modeKey, batches.map((batch) => (separate ? nextId() : batch.id)));
      const ids = colourIds.get(modeKey)!,
        count = batches.length;
      batches.forEach((batch, index) =>
        section.rows.push({
          id: ids[index],
          bodyBatchId: batch.id,
          separate,
          shade: batch.shade,
          fabricType: group.fabricType,
          ld: batch.ld || '',
          reference: batch.reference || '',
          weights: copyReportData(group.weights),
          quantities: Object.fromEntries(
            Object.entries(group.quantities).map(([size, qty]) => [size, Math.floor((qty as number) / count) + (index < (qty as number) % count ? 1 : 0)])
          ),
        })
      );
    }
    section.weightLookup = new Map<string, Row>(groups.map((group) => [JSON.stringify([group.colourKey, group.fabricType.toLowerCase()]), group.weights]));
    const generatedIds = new Map<string, unknown>(
      section.rows.map((row: Row) => [JSON.stringify([colourSelectionKey(row.shade), row.bodyBatchId, row.fabricType]), row.id])
    );
    delete section.groups;
    overlayComponentRows(section, booking, floor);
    if (odSettings(kind, booking, floor).mode !== 'Need Declaration') applyTallBigComponentAllocation(section, booking, floor, bodyRows, nextId);
    const modeIds = new Map<string, unknown>();
    for (const row of section.rows) {
      const body = batchesForComponentRow(row, bodyByColour);
      const separate = row.odDeclared || componentIsSeparate(booking, floor, kind, row.shade, row.fabricType);
      if (!row.odDeclared && separate && (row.separate === false || bodyRows.some((batch) => batch.id === row.id))) {
        const key = JSON.stringify([colourSelectionKey(row.shade), row.bodyBatchId || row.id, row.fabricType]);
        if (!modeIds.has(key)) modeIds.set(key, generatedIds.get(key) || nextId());
        row.id = modeIds.get(key);
      } else if (!row.odDeclared && !separate && row.separate === true && body) row.id = body.id;
      row.separate = separate;
      row.weights = {
        ...(section.weightLookup.get(JSON.stringify([colourSelectionKey(row.shade), String(row.fabricType).toLowerCase()])) || {}),
        ...(row.weights || {}),
      };
      const savedKg = S.confirmedCaptureContext?.preserveSavedValues && row.manual && Number.isFinite(row.totalKg) ? row.totalKg : null;
      componentRowTotals(row);
      if (savedKg !== null) row.totalKg = savedKg;
      if (row.totalKg === null)
        section.warnings.push(
          row.shade +
            ' · ' +
            row.fabricType +
            ': enter Weight /Pcs for every size with pieces. Total Qty (kg) and combined machine loading cannot be calculated until weights are supplied.'
        );
    }
    section.separate = section.rows.length ? section.rows.every((row: Row) => row.separate) : componentIsSeparate(booking, floor, kind);
    section.someSeparate = section.rows.some((row: Row) => row.separate);
    delete section.weightLookup;
    section.warnings = Array.from(new Set(section.warnings));
    result.push(section);
  }
  return result;
}
export function batchesForComponentRow(row: Row, bodyByColour: Map<string, Row[]>): Row | undefined {
  const batches = bodyByColour.get(colourSelectionKey(row.shade)) || [];
  return batches.find((batch) => batch.id === (row.bodyBatchId || row.id));
}
/** A component section's Dyeing Type select, and its "Reset from BP Data" button (same type again). */
export async function changeComponentDyeingType(kind: string, value: string): Promise<boolean> {
  if (!S.reportDraft || !canEditReport() || !COMPONENT_KINDS.some(([key]) => key === kind) || !['Solid', 'YD'].includes(value)) return false;
  if (S.reportRowEditor) {
    toast('Save or cancel the row being edited before changing Dyeing Type.');
    refreshEditableReport();
    return false;
  }
  const before = copyReportData(S.reportDraft),
    number = S.reportDraft.number,
    floor = S.reportDraft.floor;
  S.reportDraft.manual.componentRows = { ...(S.reportDraft.manual.componentRows || {}), [kind]: null };
  S.reportDraft.manual.componentTypes = { ...(S.reportDraft.manual.componentTypes || {}), [kind]: value };
  S.reportDraft.dirty = true;
  setMutationBusy(true);
  try {
    const retained = await retainSavedReportDraft();
    if (S.currentViewingNumber === number && S.currentViewingFloor === floor) refreshEditableReport();
    toast(retained ? 'Dyeing Type saved.' : 'Dyeing Type staged. ' + reportSaveHint());
    return true;
  } catch (error) {
    if (S.currentViewingNumber === number && S.currentViewingFloor === floor) {
      S.reportDraft = before;
      refreshEditableReport();
    }
    showSaveError(error);
    return false;
  } finally {
    setMutationBusy(false);
  }
}
