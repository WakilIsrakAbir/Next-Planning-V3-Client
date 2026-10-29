'use client';

/* Dialogs of the Batch Plan report: Machine Selection Evaluation, Tall/Big declaration and OD BP declaration
   (old #machineEvaluationDialog, #tallBigDeclarationDialog, #odDeclarationDialog). Each is shown while its
   context is set (S.machineEvaluationContext, S.tallBigDeclarationContext, S.odDeclarationContext) and keeps
   the old keyboard handling (Escape closes, Tab stays inside). Focus moves as the engine asks
   (requestReportFocus). Buttons and selects are disabled while a save runs or the data is not ready. */
import React, { useEffect, useRef } from 'react';
import {
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
import { ReportTable, text, trapDialogTab, useReportFocus } from './reportShared';

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
  return (
    <div
      id="machineEvaluationDialog"
      className="machine-evaluation-overlay"
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
      <div className="machine-evaluation-popup" role="dialog" aria-modal="true" aria-labelledby="machineEvaluationTitle">
        <div className="machine-popup-header">
          <h3 id="machineEvaluationTitle">{'Machine Selection Evaluation · ' + text(context.number) + ' · ' + floorLabel(context.floor)}</h3>
          <button type="button" className="btn secondary" id="btnCloseMachineEvaluation" onClick={() => closeMachineEvaluation()}>
            Close ✕
          </button>
        </div>
        <div className="machine-popup-controls">
          <label>
            {'Colour: '}
            <select
              id="machineEvaluationColour"
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
          <p>
            Green: applied machine. Blue: algorithm recommendation. Load MC applies this colour&apos;s choice. Draft choices are retained when the booking
            is saved as Tentative or Confirmed.
          </p>
        </div>
        <div id="machineEvaluationRows" className="machine-popup-table">
          {table ? (
            <>
              {table.error ? <p className="batch-calculation-note">{table.error}</p> : null}
              <ReportTable headers={MACHINE_HEADERS}>
                {table.rows.map(({ row, display, remarks, className }, i) => (
                  <tr key={i} className={className || undefined}>
                    <td>{text(row.machine?.label || row.id)}</td>
                    <td>{text(row.machine?.floor || '')}</td>
                    <td>{text(display?.capacityKg)}</td>
                    <td>{text(display?.batches)}</td>
                    <td title={'Unrounded: ' + text(row.batchQuantityKg)}>{text(display?.batchQuantityKg)}</td>
                    <td>{text(display?.maximumLoadingPercent)}</td>
                    <td title={'Unrounded: ' + text(row.actualLoadingPercent)}>{text(display?.actualLoadingPercent)}</td>
                    <td>{text(display?.eligibility)}</td>
                    <td>{remarks}</td>
                    <td>
                      <button
                        type="button"
                        className="btn load-mc-button"
                        data-load-mc-id={String(row.id)}
                        data-mc-eligible={String(row.eligible)}
                        title={text(row.eligible ? 'Apply this machine to this colour and save' : row.remarks)}
                        disabled={!row.eligible || busy || locked}
                        onClick={() => void loadMachineForColour(String(row.id))}
                      >
                        Load MC
                      </button>
                    </td>
                  </tr>
                ))}
              </ReportTable>
            </>
          ) : null}
        </div>
        <p id="machineEvaluationStatus" className="machine-popup-status" role="status">
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
        <tr key={index}>
          <td>{text(pool.fabricName)}</td>
          <td>{text(pool.fabricType)}</td>
          <td>{kgText(pool.quantities.kg)}</td>
          {big ? <td>{text(tall)}</td> : null}
          <td>
            <input
              key={renderSeq}
              type="number"
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
          <td data-declare-remaining={index} data-declare-remaining-size="kg">
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
          <tr key={index + '|' + size}>
            <td>{text(pool.fabricType)}</td>
            <td>{size}</td>
            <td>{text(pool.quantities[size])}</td>
            {big ? <td>{text(declared.Tall?.[size] || 0)}</td> : null}
            <td>
              <input
                key={renderSeq}
                type="number"
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
            <td data-declare-remaining={index} data-declare-remaining-size={size}>
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
      className="machine-evaluation-overlay"
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
      <section className="machine-evaluation-popup tall-big-popup" role="dialog" aria-modal="true" aria-labelledby="tallBigDeclarationTitle">
        <div className="machine-popup-header">
          <h3 id="tallBigDeclarationTitle">
            {body ? 'Colour & Batch Info · Declare Tall/Big fabric quantities' : text(context.title) + ' · Declare Tall/Big sizes'}
          </h3>
          <button type="button" className="btn secondary" id="btnCloseTallBigDeclaration" disabled={busy} onClick={close}>
            Cancel ✕
          </button>
        </div>
        <div className="machine-popup-controls">
          <label>
            {'Colour: '}
            <select
              id="tallBigDeclarationColour"
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
          <div className="tall-big-steps">
            <span id="tallBigStepTall" className={step === 'Tall' ? 'active' : undefined}>
              1. Tall quantities
            </span>
            <span>→</span>
            <span id="tallBigStepBig" className={big ? 'active' : undefined}>
              2. Big quantities
            </span>
          </div>
          <p id="tallBigDeclarationBatches">{batchesText}</p>
          <p id="tallBigDeclarationHelp">
            {body
              ? 'Declare Tall kg, then Big kg, for each fabric with non-zero GSM. Blank or zero GSM fabrics are accessories and are excluded. Remaining kg creates regular batches. Batch quantities, machines and loading follow the existing rules.'
              : 'Enter final planned whole pieces, including Flat Allowance. Tall and Big pieces are deducted first; the remaining pieces use this colour’s No batches.'}
          </p>
        </div>
        <div id="tallBigDeclarationRows" className="machine-popup-table">
          <ReportTable headers={headers}>{rows}</ReportTable>
        </div>
        <p id="tallBigDeclarationError" className="machine-popup-status tentative-error" role="alert">
          {text(context.error)}
        </p>
        <div className="tentative-actions">
          <button
            type="button"
            className={'btn secondary' + (step === 'Tall' ? ' hidden' : '')}
            id="btnTallBigPrevious"
            disabled={busy}
            onClick={() => previousTallBigDeclaration()}
          >
            ← Tall
          </button>
          <button type="button" className={'btn' + (big ? ' hidden' : '')} id="btnTallBigNext" disabled={busy} onClick={() => nextTallBigDeclaration()}>
            Next: Big →
          </button>
          <button
            type="button"
            className={'btn success' + (step === 'Tall' ? ' hidden' : '')}
            id="btnSaveTallBigDeclaration"
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
      className="tentative-overlay"
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
      <section className="tentative-panel" style={{ width: '1000px' }} role="dialog" aria-modal="true" aria-labelledby="odDeclarationTitle">
        <h3 id="odDeclarationTitle">{(body ? 'Colour & Batch Info' : text(context.kind) + ' Batch Info') + ' · Semi Bleach / RFD OD BP'}</h3>
        <div id="odDeclarationTotals">
          {od?.fields ? (
            <>
              <ReportTable headers={fields.map((f) => f.label + ' (' + f.unit + ')')}>
                <tr>
                  {(od.totals || []).map((qty, index) => (
                    <td key={index}>{od.kind === 'body' ? oneDecimalQty(qty) : kgText(qty)}</td>
                  ))}
                </tr>
              </ReportTable>
              {od.kind === 'body' ? (
                <p className="component-note">
                  Edit each batch’s fabric kg below. Each colour’s fabric total may vary by ±10 kg from its available quantity. Quantities use one
                  decimal place. Changing the batch count resets quantities to an equal split.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
        <p>
          <label>
            {'No of batch '}
            <select
              id="odBatchCount"
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
            <ReportTable headers={['Batch', 'OD Colour', ...(body ? [] : ['FabricType']), ...fields.map((f) => f.label + ' (' + f.unit + ')')]}>
              {preview.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td>{text(row.id)}</td>
                  <td>
                    <input
                      className="report-row-input"
                      data-od-colour={row.odBatchIndex}
                      aria-label={'OD Colour for ' + text(row.id)}
                      value={String(context.colours[row.odBatchIndex] || '')}
                      placeholder="Enter colour"
                      onChange={(event) => inputODColour(row.odBatchIndex, event.target.value)}
                    />
                  </td>
                  {body ? null : <td>{text(row.fabricType)}</td>}
                  {fields.map((field) => (
                    <td key={field.key}>
                      {body ? (
                        <input
                          key={renderSeq}
                          type="number"
                          min="0"
                          step="0.1"
                          className="report-row-input"
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
            </ReportTable>
          ) : null}
        </div>
        <p id="odDeclarationError" className="tentative-error" role="alert">
          {text(context.error)}
        </p>
        <div className="tentative-actions">
          <button id="btnODSave" className="btn success" type="button" disabled={busy || !od?.ok} onClick={() => void saveODDeclaration()}>
            OK
          </button>
          <button id="btnODCancel" className="btn secondary" type="button" disabled={busy} onClick={close}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
