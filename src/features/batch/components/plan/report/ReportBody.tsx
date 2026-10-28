'use client';

/* Batch Plan report body (old generateBlankBatchPlanHtml): the content of <article id="reportContent">, which
   the plan page renders with its toolbar. It shows S.ui.reportuiView, the snapshot openBatchPlanReport() /
   refreshEditableReport() build for S.currentViewingNumber, plus the row being edited.
   Disabled controls follow the old setMutationBusy: S.mutationBusy || !S.storageReady, and the confirmed
   plan lock (confirmedReportLocked()) for every report edit control. */
import React, { useLayoutEffect, useRef } from 'react';
import {
  S,
  changeComponentDyeingType,
  componentDyeingType,
  currentReportBooking,
  openMachineEvaluation,
  openTentativeQuestionnaire,
  useBatchVersion,
  type ReportBodyComponentSection,
  type ReportBodyNotice,
  type ReportBodyView,
  type Row,
} from '@/features/batch/engine';
import FloorOrderLinks from '../FloorOrderLinks';
import { CcDyeingModeControl, OdControl, TallBigControl, TallBigDeclarationControl } from './ReportControls';
import { ColourBatchEditableTable, ComponentEditableTable, EditableInstructionTable, FabricInfoEditableTable, GeneralInfoSection } from './ReportTables';
import { AddRowButton } from './RowEditing';
import { ReportTable, text, useReportFocus } from './reportShared';

type Editor = Row | null;

export default function ReportBody() {
  useBatchVersion();
  useReportFocus();
  const titleRef = useRef<HTMLDivElement>(null);
  const scrollReset = Number(S.ui.reportuiScrollReset) || 0;
  // A report opened with openBatchPlanReport starts at the top; a refresh keeps the scroll position.
  useLayoutEffect(() => {
    const article = titleRef.current?.closest('#reportContent');
    if (article) article.scrollTop = 0;
  }, [scrollReset]);

  const view = S.ui.reportuiView as ReportBodyView | undefined;
  if (!view || !S.currentViewingNumber || view.number !== S.currentViewingNumber || view.floor !== S.currentViewingFloor) return null;
  const busy = S.mutationBusy || !S.storageReady;
  return (
    <ReportContent
      key={view.number + '|' + (view.floor ?? '') + '|' + view.review}
      view={view}
      editor={S.reportRowEditor}
      disabled={busy || view.locked}
      titleRef={titleRef}
    />
  );
}

function ReportContent({
  view,
  editor,
  disabled,
  titleRef,
}: {
  view: ReportBodyView;
  editor: Editor;
  disabled: boolean;
  titleRef: React.RefObject<HTMLDivElement | null>;
}) {
  const locked = view.locked;
  return (
    <>
      <div className="report-title" ref={titleRef}>
        <h2>{view.factoryName}</h2>
        <h3>
          Batch Plan Report · Order / Booking No: {text(view.booking.number)}
          {view.floor ? ' · ' + view.floorName : ''}
        </h3>
        <FloorOrderLinks number={view.number} floor={view.floor} report />
        <div>
          <span className={'report-status-badge ' + view.status.toLowerCase()}>Current Status: {view.status}</span>{' '}
          <span className="report-buyer-note">
            Buyer: <strong>{text(view.booking.buyer)}</strong>
          </span>{' '}
          {view.revision ? <span className="report-revision">{view.revision}</span> : null}
        </div>
        {view.isBlank ? (
          <div className="report-warning-note">
            ⓘ Pending Batch Plan: Showing deduplicated fabric structure from Knitting Plan. Use the action buttons above to transition this booking
            to Tentative or Confirm.
          </div>
        ) : null}
      </div>

      <ReportManualNotice notice={view.notice} />
      <datalist id="reportMachineOptions">
        {view.machineOptions.map((value, index) => (
          <option key={index} value={value} />
        ))}
      </datalist>
      <GeneralInfoSection values={view.general.values} editor={editor} disabled={disabled} locked={locked} />

      <section className="section">
        <h3 className="colour-section-heading">
          {'Fabric Info '}
          <AddRowButton kind="fabric" disabled={disabled} />
        </h3>
        <FabricInfoEditableTable fabrics={view.fabrics} editor={editor} disabled={disabled} locked={locked} />
      </section>

      <ColourBatchSection view={view} editor={editor} disabled={disabled} />

      <ComponentSections sections={view.sections} seq={view.seq} editor={editor} disabled={disabled} locked={locked} />

      <section className="section">
        <h3 className="colour-section-heading">
          {'Instruction '}
          <AddRowButton kind="instruction" disabled={disabled} />
        </h3>
        <EditableInstructionTable rows={view.instructions.rows} fields={view.instructions.fields} editor={editor} disabled={disabled} locked={locked} />
      </section>
      <p className="print-note">Generated from Textile Planning Solution ERP · Timestamp: {view.timestamp}</p>
    </>
  );
}

/** Old reportManualNotice: read-only, internal change, re-confirm review, tentative reasons or draft notice. */
function ReportManualNotice({ notice }: { notice: ReportBodyNotice }) {
  const edit = (show: boolean) =>
    show ? (
      <button type="button" className="btn secondary tentative-edit-answers" data-edit-tentative="" onClick={() => openTentativeQuestionnaire()}>
        Edit Tentative Answers
      </button>
    ) : null;
  switch (notice.kind) {
    case 'locked':
      return (
        <div className="confirmed-readonly-notice">
          <strong>Confirmed plan is read-only.</strong> This order is in Need Re-Confirm List. Open it from that list to review and re-confirm the
          latest data.
        </div>
      );
    case 'confirm':
      return (
        <div className={notice.dirty ? 'internal-change-notice' : 'manual-report-notice'}>
          {notice.dirty ? (
            <>
              <strong>Internal changes pending approval.</strong>{' '}
            </>
          ) : null}
          Save Row stages edits. Use <strong>Internal change</strong> to approve them; No discards the edits and returns to Confirm List.
        </div>
      );
    case 'review':
      return (
        <div className="reconfirm-review-notice">
          <strong>Reviewing latest uploaded plan.</strong> Confirmed BP Revised No: {notice.confirmedRevision} · Latest YB Revised No:{' '}
          {notice.latestRevision}. The previous confirmed plan stays saved until you click Re-Confirm Latest Plan. Row saves and machine choices
          here stay in this review draft.
        </div>
      );
    case 'tentative':
      return (
        <div className="tentative-reason-notice">
          <strong>Why is it tentative?</strong>{' '}
          <span>
            {notice.summary}
            {/[.!?]$/.test(notice.summary) ? '' : '.'}
          </span>
          {edit(notice.edit)}
        </div>
      );
    default:
      return (
        <div className="manual-report-notice">
          {notice.retained
            ? 'Saved booking: manual row saves and machine choices are retained.'
            : 'Draft: Save Row stages changes. Save the booking as Tentative or Confirmed to retain them. Returning to the list discards unsaved manual changes.'}
          {edit(notice.edit)}
        </div>
      );
  }
}

/** Colour & Batch Info: OD BP, Tall/Big size, Dyeing Mode, Add Row, Machine Selection Evaluation and the table. */
const ColourBatchSection = React.memo(function ColourBatchSection({ view, editor, disabled }: { view: ReportBodyView; editor: Editor; disabled: boolean }) {
  return (
    <section className="section">
      <h3 className="colour-section-heading">
        {'Colour & Batch Info '}
        <span className="report-heading-actions">
          {view.bodyOd ? <OdControl od={view.bodyOd} seq={view.seq} disabled={disabled} /> : null}
          {view.tallBig ? <TallBigControl control={view.tallBig} seq={view.seq} disabled={disabled} /> : null}
          <CcDyeingModeControl mode={view.dyeingMode} seq={view.seq} disabled={disabled} />
          <AddRowButton kind="batch" disabled={disabled} />
          <button
            type="button"
            className="btn machine-evaluation-button"
            id="btnMachineEvaluation"
            disabled={!view.machineEvaluationCount}
            onClick={() => openMachineEvaluation()}
          >
            Machine Selection Evaluation
          </button>
        </span>
      </h3>
      <ColourBatchEditableTable batch={view.batch} seq={view.seq} editor={editor} disabled={disabled} locked={view.locked} />
    </section>
  );
});

/** Collar / Cuff / Hem / Placket sections (old renderComponentSections). */
const ComponentSections = React.memo(function ComponentSections({
  sections,
  seq,
  editor,
  disabled,
  locked,
}: {
  sections: ReportBodyComponentSection[];
  seq: number;
  editor: Editor;
  disabled: boolean;
  locked: boolean;
}) {
  return (
    <>
      {sections.map((item, index) => (
        <ComponentSection key={index + '|' + item.section.kind} item={item} seq={seq} editor={editor} disabled={disabled} locked={locked} />
      ))}
    </>
  );
});

function ComponentSection({
  item,
  seq,
  editor,
  disabled,
  locked,
}: {
  item: ReportBodyComponentSection;
  seq: number;
  editor: Editor;
  disabled: boolean;
  locked: boolean;
}) {
  const { section, od, tallBig, table } = item;
  const kind = 'component:' + section.kind;
  const breakdown: Row[] = section.allowanceBreakdown || [];
  const errors: unknown[] = section.tallBigErrors || [];
  const warnings: unknown[] = section.warnings || [];
  return (
    <section className="section component-section" data-component-kind={section.kind}>
      <h3 className="colour-section-heading">
        <span>
          {text(section.title)}
          {section.separate ? (
            <>
              {' '}
              <small className="component-separate-label">Separate</small>
            </>
          ) : null}
        </span>
        <span className="report-heading-actions">
          {od ? <OdControl od={od} seq={seq} disabled={disabled} /> : null}
          <TallBigDeclarationControl section={section} control={tallBig} seq={seq} disabled={disabled} />
          <label className="component-dyeing-control">
            {'Dyeing Type '}
            <select
              key={seq}
              data-component-dyeing={section.kind}
              aria-label={'Dyeing Type for ' + text(section.title)}
              disabled={disabled}
              defaultValue={section.dyeingType}
              onChange={(event) => void changeComponentDyeingType(section.kind, event.target.value)}
            >
              <option value="Solid">Solid</option>
              <option value="YD">YD</option>
            </select>
          </label>
          <AddRowButton kind={kind} disabled={disabled} />
          {section.manual ? (
            <button
              type="button"
              className="btn secondary report-add-row"
              data-reset-component={section.kind}
              disabled={disabled}
              onClick={() =>
                void changeComponentDyeingType(section.kind, componentDyeingType(currentReportBooking() as Row, S.currentViewingFloor, section.kind))
              }
            >
              Reset from BP Data
            </button>
          ) : null}
        </span>
      </h3>
      <ComponentEditableTable section={section} table={table} editor={editor} disabled={disabled} locked={locked} />
      <p className="component-note">
        Total Qty (kg) uses each size’s Weight /Pcs from BP Data. Flat Allowance is applied by colour and size before splitting whole pieces across
        batches. Edited quantities are final planned pieces; allowance is not added again. Changing Dyeing Type recalculates this section from BP
        Data.
      </p>
      {section.tallBigDeclared ? (
        <p className="tall-big-allocation-note">
          Declared Tall/Big pieces are assigned to matching batches first. Remaining pieces use the colour’s No batches. Solid shares body batch
          numbers; YD and Separate retain their separate-number policy.
        </p>
      ) : null}
      {errors.length ? (
        <div className="tall-big-errors" role="alert">
          {errors.map((error, index) => (
            <div key={index}>{text(error)}</div>
          ))}
        </div>
      ) : null}
      {breakdown.length ? (
        <details className="allowance-summary">
          <summary>Flat Allowance breakdown</summary>
          <ReportTable headers={['Color', 'Size', 'BP pieces', 'Process Loss', 'Planned pieces']}>
            {breakdown.map((entry, index) => (
              <tr key={index}>
                <td>{text(entry.shade)}</td>
                <td>{text(entry.size)}</td>
                <td>{text(entry.sourceQty)}</td>
                <td>{text(entry.processLoss)}</td>
                <td>{text(entry.plannedQty)}</td>
              </tr>
            ))}
          </ReportTable>
        </details>
      ) : null}
      {warnings.length ? (
        <div className="batch-calculation-note">
          {warnings.map((value, index) => (
            <div key={index}>{text(value)}</div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
