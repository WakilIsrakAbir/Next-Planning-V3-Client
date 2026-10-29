'use client';

/* Dialogs of the Batch Plan report: Machine Selection Evaluation, Tall/Big declaration and OD BP declaration
   (old #machineEvaluationDialog, #tallBigDeclarationDialog, #odDeclarationDialog). Each is shown while its
   context is set (S.machineEvaluationContext, S.tallBigDeclarationContext, S.odDeclarationContext) and keeps
   the old keyboard handling (Escape closes, Tab stays inside). Focus moves as the engine asks
   (requestReportFocus). Buttons and selects are disabled while a save runs or the data is not ready. */
import React, { useEffect, useRef } from 'react';
import {
  BatchApi,
  S,
  changeODBatchCount,
  changeTallBigDeclarationColour,
  closeMachineEvaluation,
  closeODDeclaration,
  closeTallBigDeclaration,
  colourSelectionKey,
  compareComponentSizes,
  componentSize,
  confirmedReportLocked,
  fabricQuantity,
  floorLabel,
  inputODColour,
  inputODQuantity,
  inputTallBigDeclaration,
  kgText,
  loadMachineForColour,
  nextTallBigDeclaration,
  oneDecimalQty,
  previousTallBigDeclaration,
  productionSum,
  renderMachineEvaluationRows,
  saveODDeclaration,
  saveTallBigDeclaration,
  selectMachineEvaluationColour,
  useBatchVersion,
  type ComponentSize,
  type Row,
} from '@/features/batch/lib';
import { cn } from '@/lib/cn';
import { button, controlFont, dialog } from '../../ui/styles';
import { calculationNote } from './ReportTables';
import { rowInput } from './RowEditing';
import { CONTROL_FONT, DialogTable, FIELD_STATES, bodyRow, dialogCell, text, trapDialogTab, useReportFocus } from './reportShared';

/* Machine Selection Evaluation and Tall/Big popups (old `.machine-evaluation-overlay`, `.machine-evaluation-popup`
   and its `.machine-popup-*` parts). */
const POPUP = {
  overlay: 'fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(17,42,70,.35)] p-[18px] dark:bg-black/65 print:hidden',
  panel:
    'flex max-h-[90vh] w-[1400px] flex-col overflow-hidden rounded-[7px] border border-solid border-[#c9d8e8] bg-white shadow-[0_8px_30px_rgba(17,42,70,.3)] ' +
    'dark:border-[#2a3346] dark:bg-[#181c25] dark:text-[#e2e8f0] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)]',
  header: 'flex items-center justify-between gap-3.5 bg-[#edf4fb] px-[18px] py-3.5 dark:bg-[#151921]',
  title: 'text-[16px] font-bold text-[#173756] dark:text-[#f8fafc]',
  controls: 'px-[18px] py-2.5 text-[12px]',
  select: cn('max-w-[65vw] rounded border border-solid border-[#c9d8e8] bg-white p-[5px]', CONTROL_FONT, FIELD_STATES),
  note: 'mt-1.5 text-[11px] text-[#64748b]',
  table: 'min-h-20 overflow-auto px-4',
  status: 'min-h-[35px] px-[18px] py-2.5 text-[12px] text-[#23496b] dark:text-[#94a3b8]',
};
const secondaryButton = cn(button('secondary'), controlFont);

/** Row colours of the evaluation table (old `.machine-selected td`, `.machine-recommended td`). */
const MACHINE_ROW = {
  selected: '[&>td]:bg-[#e5f6ee] [&>td]:font-semibold dark:[&>td]:bg-[rgba(16,185,129,0.18)]',
  recommended: '[&>td]:bg-[#eef6ff] dark:[&>td]:bg-[rgba(59,130,246,0.12)]',
};

/** Number input of the Tall/Big table (old `.tall-big-popup input[type=number]`). */
const DECLARE_INPUT = cn('w-[110px] rounded border border-solid border-[#b6c3d0] bg-white p-1.5', CONTROL_FONT, FIELD_STATES);

/** Current step of the Tall/Big dialog (old `.tall-big-steps .active`). */
const STEP_ACTIVE = 'rounded bg-[#e6f0fa] px-3 py-[7px] font-bold text-[#174d7c] dark:bg-[rgba(16,185,129,0.15)] dark:text-[#6ee7b7]';

/** Inputs of the OD preview (old `.report-row-input` outside the report: the cell's 16px text). */
const OD_INPUT = rowInput();

/** The OD batch count select had no style rule: the browser's own select. */
const BROWSER_SELECT = cn('rounded-none border border-solid border-[#767676] bg-white p-0', CONTROL_FONT, FIELD_STATES);

export default function ReportDialogs() {
  useBatchVersion();
  useReportFocus();
  return (
    <>
      <MachineEvaluationDialog />
      <TallBigDeclarationDialog />
      <ODDeclarationDialog />
    </>
  );
}

/* ---------- Machine Selection Evaluation ---------- */
const MACHINE_HEADERS = [
  'Machine',
  'Floor',
  'Capacity (kg)',
  'Batches',
  'Qty / Batch (kg)',
  'Maximum Loading',
  'Actual Loading',
  'Eligibility',
  'Selection Remarks',
  'Action',
];

function MachineEvaluationDialog() {
  useBatchVersion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const context = S.machineEvaluationContext;
  if (!context) return null;
  const busy = S.mutationBusy || !S.storageReady;
  const evaluations = S.currentReportMachineEvaluations;
  const index = Number(S.ui.reportuiMachineIndex) || 0;
  const table = renderMachineEvaluationRows(index);
  const locked = confirmedReportLocked();
  const canEdit = BatchApi.has('actions.batchEdit');
  return (
    <div
      id="machineEvaluationDialog"
      className={POPUP.overlay}
      aria-hidden="false"
      ref={overlayRef}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeMachineEvaluation();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeMachineEvaluation();
        }
        trapDialogTab(event, overlayRef.current, 'button,select');
      }}
    >
      <div className={cn(POPUP.panel, 'max-w-full')} role="dialog" aria-modal="true" aria-labelledby="machineEvaluationTitle">
        <div className={POPUP.header}>
          <h3 id="machineEvaluationTitle" className={POPUP.title}>
            {'Machine Selection Evaluation · ' + text(context.number) + ' · ' + floorLabel(context.floor)}
          </h3>
          <button type="button" className={secondaryButton} id="btnCloseMachineEvaluation" onClick={() => closeMachineEvaluation()}>
            Close ✕
          </button>
        </div>
        <div className={POPUP.controls}>
          <label>
            {'Colour: '}
            <select
              id="machineEvaluationColour"
              className={POPUP.select}
              aria-label="Colour for machine evaluation"
              value={String(index)}
              disabled={busy}
              onChange={(event) => selectMachineEvaluationColour(event.target.value)}
            >
              {evaluations.map((value, i) => (
                <option key={i} value={i}>
                  {(value.shade || 'Blank colour') + (value.groupLabel ? ' · ' + value.groupLabel : '')}
                </option>
              ))}
            </select>
          </label>
          <p className={POPUP.note}>
            Green: applied machine. Blue: algorithm recommendation. Load MC applies this colour&apos;s choice. Draft choices are retained when the booking
            is saved as Tentative or Confirmed.
          </p>
        </div>
        <div id="machineEvaluationRows" className={POPUP.table}>
          {table ? (
            <>
              {table.error ? <p className={cn(calculationNote, 'mb-3')}>{table.error}</p> : null}
              <DialogTable wide headers={MACHINE_HEADERS}>
                {table.rows.map(({ row, display, remarks, highlight }, i) => (
                  <tr key={i} className={cn(bodyRow, highlight && MACHINE_ROW[highlight])}>
                    <td className={dialogCell}>{text(row.machine?.label || row.id)}</td>
                    <td className={dialogCell}>{text(row.machine?.floor || '')}</td>
                    <td className={dialogCell}>{text(display?.capacityKg)}</td>
                    <td className={dialogCell}>{text(display?.batches)}</td>
                    <td className={dialogCell} title={'Unrounded: ' + text(row.batchQuantityKg)}>
                      {text(display?.batchQuantityKg)}
                    </td>
                    <td className={dialogCell}>{text(display?.maximumLoadingPercent)}</td>
                    <td className={dialogCell} title={'Unrounded: ' + text(row.actualLoadingPercent)}>
                      {text(display?.actualLoadingPercent)}
                    </td>
                    <td className={dialogCell}>{text(display?.eligibility)}</td>
                    <td className={dialogCell}>{remarks}</td>
                    <td className={dialogCell}>
                      {canEdit ? (
                        <button
                          type="button"
                          className={cn(button('primary'), controlFont, 'whitespace-nowrap px-2! py-[5px]! text-[11.5px]!')}
                          data-load-mc-id={String(row.id)}
                          data-mc-eligible={String(row.eligible)}
                          title={text(row.eligible ? 'Apply this machine to this colour and save' : row.remarks)}
                          disabled={!row.eligible || busy || locked}
                          onClick={() => void loadMachineForColour(String(row.id))}
                        >
                          Load MC
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </DialogTable>
            </>
          ) : null}
        </div>
        <p id="machineEvaluationStatus" className={POPUP.status} role="status">
          {text(context.status)}
        </p>
      </div>
    </div>
  );
}

/* ---------- Tall/Big declaration ---------- */
function TallBigDeclarationDialog() {
  useBatchVersion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const context = S.tallBigDeclarationContext;
  if (!context) return null;
  const busy = S.mutationBusy || !S.storageReady;
  const body = context.kind === 'body';
  const step = String(context.step);
  const big = step === 'Big';
  const renderSeq = Number(S.ui.reportuiTallBigRender) || 0;
  // After typing, the old input listener wrote the remaining kg without formatting until the next render.
  const typed = S.ui.reportuiTallBigTyped !== undefined && S.ui.reportuiTallBigTyped === S.ui.reportuiTallBigRender;
  const pools: Row[] = context.pools || [];
  const batches = (context.bodyRows as Row[]).filter((row) => colourSelectionKey(row.shade) === context.colourKey),
    matching = batches.filter((row) => row.tallBig === step);
  const inputDisabled = busy || (!body && !matching.length);
  const close = () => {
    if (!S.mutationBusy) closeTallBigDeclaration();
  };

  const rows: React.ReactNode[] = [];
  pools.forEach((pool, index) => {
    if (pool.colourKey !== context.colourKey) return;
    const declared: Row = context.quantities[pool.colourKey].fabrics[pool.fabricKey];
    if (body) {
      const tall = declared.Tall?.kg || 0,
        bigKg = declared.Big?.kg || 0;
      rows.push(
        <tr key={index} className={bodyRow}>
          <td className={dialogCell}>{text(pool.fabricName)}</td>
          <td className={dialogCell}>{text(pool.fabricType)}</td>
          <td className={dialogCell}>{kgText(pool.quantities.kg)}</td>
          {big ? <td className={dialogCell}>{text(tall)}</td> : null}
          <td className={dialogCell}>
            <input
              key={renderSeq}
              type="number"
              className={DECLARE_INPUT}
              min="0"
              step="any"
              data-declare-pool={index}
              data-declare-size="kg"
              defaultValue={text(declared[step]?.kg ?? 0)}
              aria-label={step + ' kg for ' + text(pool.fabricName)}
              disabled={inputDisabled}
              onChange={(event) => inputTallBigDeclaration(index, 'kg', event.target.value)}
            />
          </td>
          <td className={dialogCell} data-declare-remaining={index} data-declare-remaining-size="kg">
            {typed ? String(pool.quantities.kg - tall - bigKg) : kgText(productionSum([pool.quantities.kg, -tall, -bigKg]))}
          </td>
        </tr>
      );
      return;
    }
    Object.keys(pool.quantities)
      .sort((a, b) => compareComponentSizes(componentSize({ CCSize: a }) as ComponentSize, componentSize({ CCSize: b }) as ComponentSize))
      .forEach((size) => {
        const value = declared[step]?.[size] ?? 0,
          remaining = pool.quantities[size] - (declared.Tall?.[size] || 0) - (declared.Big?.[size] || 0);
        rows.push(
          <tr key={index + '|' + size} className={bodyRow}>
            <td className={dialogCell}>{text(pool.fabricType)}</td>
            <td className={dialogCell}>{size}</td>
            <td className={dialogCell}>{text(pool.quantities[size])}</td>
            {big ? <td className={dialogCell}>{text(declared.Tall?.[size] || 0)}</td> : null}
            <td className={dialogCell}>
              <input
                key={renderSeq}
                type="number"
                className={DECLARE_INPUT}
                min="0"
                step="1"
                data-declare-pool={index}
                data-declare-size={size}
                defaultValue={text(value)}
                aria-label={step + ' pieces for ' + text(pool.fabricType) + ' ' + size}
                disabled={inputDisabled}
                onChange={(event) => inputTallBigDeclaration(index, size, event.target.value)}
              />
            </td>
            <td className={dialogCell} data-declare-remaining={index} data-declare-remaining-size={size}>
              {text(remaining)}
            </td>
          </tr>
        );
      });
  });
  const headers = body
    ? ['Fabric', 'Fabrication', 'Available kg', ...(big ? ['Tall kg'] : []), step + ' kg', 'Regular kg']
    : ['FabricType', 'Size', 'Planned pcs', ...(big ? ['Tall pcs'] : []), step + ' pcs', 'Remaining pcs'];
  const batchesText = body
    ? 'Declare ' + step + ' kg for this colour’s main fabrics. Batch labels will be selected automatically.'
    : step +
      ' batches: ' +
      (matching.map((row) => row.id).join(', ') || 'None for this colour. Keep ' + step + ' pieces at 0.') +
      ' · No batches: ' +
      (batches
        .filter((row) => row.tallBig === 'No')
        .map((row) => row.id)
        .join(', ') || 'None');

  return (
    <div
      id="tallBigDeclarationDialog"
      className={POPUP.overlay}
      aria-hidden="false"
      ref={overlayRef}
      onClick={(event) => {
        if (event.target === event.currentTarget && !S.mutationBusy) closeTallBigDeclaration();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (!S.mutationBusy) closeTallBigDeclaration();
        }
        trapDialogTab(event, overlayRef.current, 'button,select,input', true);
      }}
    >
      <section className={cn(POPUP.panel, 'max-w-[1000px]')} role="dialog" aria-modal="true" aria-labelledby="tallBigDeclarationTitle">
        <div className={POPUP.header}>
          <h3 id="tallBigDeclarationTitle" className={POPUP.title}>
            {body ? 'Colour & Batch Info · Declare Tall/Big fabric quantities' : text(context.title) + ' · Declare Tall/Big sizes'}
          </h3>
          <button type="button" className={secondaryButton} id="btnCloseTallBigDeclaration" disabled={busy} onClick={close}>
            Cancel ✕
          </button>
        </div>
        <div className={POPUP.controls}>
          <label>
            {'Colour: '}
            <select
              id="tallBigDeclarationColour"
              className={POPUP.select}
              aria-label="Colour for Tall/Big size declaration"
              value={text(context.colourKey)}
              disabled={busy}
              onChange={(event) => changeTallBigDeclarationColour(event.target.value)}
            >
              {(context.colours as Row[]).map((colour, i) => (
                <option key={i} value={colour.key}>
                  {text(colour.shade)}
                </option>
              ))}
            </select>
          </label>
          <div className="my-2.5 flex items-center gap-2 text-[#62758a] dark:text-[#94a3b8]">
            <span id="tallBigStepTall" className={step === 'Tall' ? STEP_ACTIVE : undefined}>
              1. Tall quantities
            </span>
            <span>→</span>
            <span id="tallBigStepBig" className={big ? STEP_ACTIVE : undefined}>
              2. Big quantities
            </span>
          </div>
          <p id="tallBigDeclarationBatches" className={POPUP.note}>
            {batchesText}
          </p>
          <p id="tallBigDeclarationHelp" className={POPUP.note}>
            {body
              ? 'Declare Tall kg, then Big kg, for each fabric with non-zero GSM. Blank or zero GSM fabrics are accessories and are excluded. Remaining kg creates regular batches. Batch quantities, machines and loading follow the existing rules.'
              : 'Enter final planned whole pieces, including Flat Allowance. Tall and Big pieces are deducted first; the remaining pieces use this colour’s No batches.'}
          </p>
        </div>
        <div id="tallBigDeclarationRows" className={POPUP.table}>
          <DialogTable wide headers={headers}>
            {rows}
          </DialogTable>
        </div>
        <p id="tallBigDeclarationError" className="mt-2.5 min-h-4 px-[18px] py-2.5 text-[12px] text-[#b91c1c] dark:text-[#f87171]" role="alert">
          {text(context.error)}
        </p>
        <div className={cn(dialog.actions, 'px-[18px] py-3')}>
          <button
            type="button"
            className={secondaryButton}
            id="btnTallBigPrevious"
            hidden={step === 'Tall'}
            disabled={busy}
            onClick={() => previousTallBigDeclaration()}
          >
            ← Tall
          </button>
          <button type="button" className={cn(button('primary'), controlFont)} id="btnTallBigNext" hidden={big} disabled={busy} onClick={() => nextTallBigDeclaration()}>
            Next: Big →
          </button>
          <button
            type="button"
            className={cn(button('success'), controlFont)}
            id="btnSaveTallBigDeclaration"
            hidden={step === 'Tall'}
            disabled={busy}
            onClick={() => void saveTallBigDeclaration()}
          >
            Save Quantities
          </button>
        </div>
      </section>
    </div>
  );
}

/* ---------- OD BP declaration ---------- */
type ODField = { key: string; label: string; unit: string };
type ODRender = { ok: boolean; kind?: string; fields?: ODField[]; totals?: number[] };

function ODDeclarationDialog() {
  useBatchVersion();
  const context = S.odDeclarationContext;
  if (!context) return null;
  return <ODDeclarationPanel context={context} />;
}

function ODDeclarationPanel({ context }: { context: Row }) {
  useBatchVersion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  // Old change listener on #odDeclarationPreview: a valid kg is written back with one decimal place.
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const onChange = (event: Event) => {
      const input = event.target as HTMLInputElement;
      if (!input.matches?.('[data-od-qty-row]') || fabricQuantity(input.value) === null) return;
      input.value = oneDecimalQty(input.value);
      inputODQuantity(Number(input.dataset.odQtyRow), input.dataset.odQtyFabric || '', input.value, false);
    };
    preview.addEventListener('change', onChange);
    return () => preview.removeEventListener('change', onChange);
  }, []);

  const busy = S.mutationBusy || !S.storageReady;
  const body = context.kind === 'body';
  const od = S.ui.reportuiOd as ODRender | null | undefined;
  const renderSeq = Number(S.ui.reportuiOdRender) || 0;
  const fields = od?.fields || [];
  const preview: Row[] = context.preview || [];
  const close = () => {
    if (!S.mutationBusy) closeODDeclaration();
  };
  return (
    <div
      id="odDeclarationDialog"
      className={dialog.overlay}
      aria-hidden="false"
      ref={overlayRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !S.mutationBusy) {
          event.preventDefault();
          closeODDeclaration();
        }
        trapDialogTab(event, overlayRef.current, 'button,select,input');
      }}
    >
      <section className={cn(dialog.panel, 'w-[1000px]!')} role="dialog" aria-modal="true" aria-labelledby="odDeclarationTitle">
        <h3 id="odDeclarationTitle" className={dialog.title}>{(body ? 'Colour & Batch Info' : text(context.kind) + ' Batch Info') + ' · Semi Bleach / RFD OD BP'}</h3>
        <div id="odDeclarationTotals">
          {od?.fields ? (
            <>
              <DialogTable headers={fields.map((f) => f.label + ' (' + f.unit + ')')}>
                <tr className={bodyRow}>
                  {(od.totals || []).map((qty, index) => (
                    <td key={index} className={dialogCell}>{od.kind === 'body' ? oneDecimalQty(qty) : kgText(qty)}</td>
                  ))}
                </tr>
              </DialogTable>
              {od.kind === 'body' ? (
                <p className="my-[7px] text-[11px] text-[#64748b]">
                  Edit each batch’s fabric kg below. Each colour’s fabric total may vary by ±10 kg from its available quantity. Quantities use one
                  decimal place. Changing the batch count resets quantities to an equal split.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
        <p className="my-4">
          <label>
            {'No of batch '}
            <select
              id="odBatchCount"
              className={BROWSER_SELECT}
              aria-label="Number of OD batches"
              value={text(context.count)}
              disabled={busy}
              onChange={(event) => changeODBatchCount(event.target.value)}
            >
              {Array.from({ length: 20 }, (_, i) => (
                <option key={i} value={String(i + 1)}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
        </p>
        <div id="odDeclarationPreview" ref={previewRef}>
          {od?.ok ? (
            <DialogTable headers={['Batch', 'OD Colour', ...(body ? [] : ['FabricType']), ...fields.map((f) => f.label + ' (' + f.unit + ')')]}>
              {preview.map((row, rowIndex) => (
                <tr key={rowIndex} className={bodyRow}>
                  <td className={dialogCell}>{text(row.id)}</td>
                  <td className={dialogCell}>
                    <input
                      className={OD_INPUT}
                      data-od-colour={row.odBatchIndex}
                      aria-label={'OD Colour for ' + text(row.id)}
                      value={String(context.colours[row.odBatchIndex] || '')}
                      placeholder="Enter colour"
                      onChange={(event) => inputODColour(row.odBatchIndex, event.target.value)}
                    />
                  </td>
                  {body ? null : <td className={dialogCell}>{text(row.fabricType)}</td>}
                  {fields.map((field) => (
                    <td key={field.key} className={dialogCell}>
                      {body ? (
                        <input
                          key={renderSeq}
                          type="number"
                          min="0"
                          step="0.1"
                          className={OD_INPUT}
                          data-od-qty-row={rowIndex}
                          data-od-qty-fabric={field.key}
                          aria-label={field.label + ' kg for ' + text(row.id)}
                          defaultValue={oneDecimalQty(context.quantityEdits?.[row.rowKey]?.[field.key] ?? row.quantities[field.key] ?? 0)}
                          disabled={!((row.quantities[field.key] || 0) > 0)}
                          onChange={(event) => inputODQuantity(rowIndex, field.key, event.target.value)}
                        />
                      ) : (
                        kgText(row.quantities[field.key] || 0)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </DialogTable>
          ) : null}
        </div>
        <p id="odDeclarationError" className={dialog.error} role="alert">
          {text(context.error)}
        </p>
        <div className={dialog.actions}>
          <button id="btnODSave" className={cn(button('success'), controlFont)} type="button" disabled={busy || !od?.ok} onClick={() => void saveODDeclaration()}>
            OK
          </button>
          <button id="btnODCancel" className={secondaryButton} type="button" disabled={busy} onClick={close}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
