'use client';

/* Batch Plan report body (old generateBlankBatchPlanHtml): the content of <article id="reportContent">, which
   the plan page renders with its toolbar. It shows S.ui.reportuiView, the snapshot openBatchPlanReport() /
   refreshEditableReport() build for S.currentViewingNumber, plus the row being edited.
   Disabled controls follow the old setMutationBusy: S.mutationBusy || !S.storageReady, and the confirmed
   plan lock (confirmedReportLocked()) for every report edit control.
   The full-view preview copies this content and removes everything marked data-preview-strip. */
import React, { useLayoutEffect, useRef } from 'react';
import {
  BatchApi,
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
} from '@/features/batch/lib';
import { cn } from '@/lib/cn';
import FloorOrderLinks from '@/features/batch/components/plan/FloorOrderLinks';
import { button, controlFont } from '../../ui/styles';
import { CcDyeingModeControl, OdControl, TallBigControl, TallBigDeclarationControl, dyeingControl, dyeingSelect } from './ReportControls';
import {
  ColourBatchEditableTable,
  ComponentEditableTable,
  EditableInstructionTable,
  FabricInfoEditableTable,
  GeneralInfoSection,
  calculationNote,
  headingActions,
  section as sectionClass,
  sectionHeading,
} from './ReportTables';
import { AddRowButton } from './RowEditing';
import { ReportEditPermission, ReportTable, bodyRow, grid, headingButton, text, useReportCanEdit, useReportFocus } from './reportShared';

type Editor = Row | null;

/** Colours of the status badge (old `.report-status-badge.pending/.tentative/.confirm`). */
const STATUS_BADGE: Record<string, string> = {
  pending:
    'border border-solid border-[#fde68a] bg-[#fef3c7] text-[#92400e] dark:border-[rgba(234,179,8,0.35)] dark:bg-[rgba(234,179,8,0.16)] dark:text-[#fde68a]',
  tentative:
    'border border-solid border-[#bae6fd] bg-[#e0f2fe] text-[#0369a1] dark:border-[rgba(59,130,246,0.35)] dark:bg-[rgba(59,130,246,0.16)] dark:text-[#93c5fd]',
  confirm:
    'border border-solid border-[#bbf7d0] bg-[#dcfce7] text-[#15803d] dark:border-[rgba(16,185,129,0.35)] dark:bg-[rgba(16,185,129,0.16)] dark:text-[#6ee7b7]',
};

/* Notices above the tables (old `.manual-report-notice`, `.internal-change-notice`, …). */
const AMBER_DARK = 'dark:border-[rgba(245,158,11,0.35)] dark:bg-[rgba(245,158,11,0.1)] dark:text-[#fdba74]';
const BLUE_DARK = 'dark:border-[#2a3346] dark:bg-[#1e2330] dark:text-[#cbd5e1]';
const NOTICE = {
  /** Draft / saved booking notice: not printed, dropped by the preview. */
  manual: cn('mb-3.5 rounded-[5px] border border-solid border-[#caddeb] bg-[#f2f8fc] px-3 py-[9px] text-[12px] text-[#315571] print:hidden', BLUE_DARK),
  /** Internal changes pending approval: printed and kept by the preview. */
  internal: cn('my-3.5 rounded-md border border-solid border-[#e7c15f] bg-[#fff2ce] px-3.5 py-3 text-[13px] leading-[1.5] text-[#79570c]', AMBER_DARK),
  readOnly: cn('my-3.5 rounded-md border border-solid border-[#f1d58b] bg-[#fff7df] px-3.5 py-3 text-[13px] leading-[1.5] text-[#76540f]', AMBER_DARK),
  review: cn('mb-3.5 rounded-[5px] border border-solid border-[#fed7aa] bg-[#fff7ed] px-[13px] py-[11px] text-[12px] text-[#9a3412]', AMBER_DARK),
  tentative: cn(
    'mb-3.5 whitespace-pre-wrap rounded-[5px] border border-solid border-[#caddeb] bg-[#edf6fc] px-3 py-2.5 text-[12px] text-[#23496b] [overflow-wrap:anywhere] print:break-inside-avoid',
    BLUE_DARK
  ),
};

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
    <ReportEditPermission.Provider value={BatchApi.has('actions.batchEdit')}>
      <ReportContent
        key={view.number + '|' + (view.floor ?? '') + '|' + view.review}
        view={view}
        editor={S.reportRowEditor}
        disabled={busy || view.locked}
        titleRef={titleRef}
      />
    </ReportEditPermission.Provider>
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
      <div className="mb-5 border-b-[3px] border-solid border-batch-primary pb-3 text-center print:mb-1.5 print:pb-1.5" ref={titleRef}>
        <h2 className="mb-1 text-[22px] font-bold text-[#122f4b] dark:[#reportContent_&]:text-[#f8fafc] print:text-[16px]">{view.factoryName}</h2>
        <h3 className="text-[15px] font-bold text-[#284a6c] dark:[#reportContent_&]:text-[#cbd5e1] print:text-[12px]">
          Batch Plan Report · Order / Booking No: {text(view.booking.number)}
          {view.floor ? ' · ' + view.floorName : ''}
        </h3>
        <FloorOrderLinks number={view.number} floor={view.floor} report />
        <div>
          <span
            className={cn(
              'mt-2 inline-block rounded-[20px] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.5px]',
              STATUS_BADGE[view.status.toLowerCase()]
            )}
          >
            Current Status: {view.status}
          </span>{' '}
          <span className="ml-2.5 text-[12px] text-batch-muted">
            Buyer: <strong>{text(view.booking.buyer)}</strong>
          </span>{' '}
          {view.revision ? <span className="ml-3 inline-block text-[12px] font-bold text-[#23496b] dark:text-[#94a3b8]">{view.revision}</span> : null}
        </div>
        {view.isBlank ? (
          <div className={cn('mt-3.5 rounded-md border border-solid border-[#fef3c7] bg-[#fffbeb] px-3.5 py-2.5 text-[12px] font-semibold text-[#92400e]', AMBER_DARK)}>
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

      <section className={sectionClass} data-report-section="">
        <h3 className={sectionHeading}>
          {'Fabric Info '}
          <AddRowButton kind="fabric" disabled={disabled} />
        </h3>
        <FabricInfoEditableTable fabrics={view.fabrics} editor={editor} disabled={disabled} locked={locked} />
      </section>

      <ColourBatchSection view={view} editor={editor} disabled={disabled} />

      <ComponentSections sections={view.sections} seq={view.seq} editor={editor} disabled={disabled} locked={locked} />

      <section className={sectionClass} data-report-section="">
        <h3 className={sectionHeading}>
          {'Instruction '}
          <AddRowButton kind="instruction" disabled={disabled} />
        </h3>
        <EditableInstructionTable rows={view.instructions.rows} fields={view.instructions.fields} editor={editor} disabled={disabled} locked={locked} />
      </section>
      <p className="mb-[11px] mt-5 text-right text-[11px] text-[#64748b] print:hidden" data-preview-strip="">
        Generated from Textile Planning Solution ERP · Timestamp: {view.timestamp}
      </p>
    </>
  );
}

/** Old reportManualNotice: read-only, internal change, re-confirm review, tentative reasons or draft notice. */
function ReportManualNotice({ notice }: { notice: ReportBodyNotice }) {
  const edit = (show: boolean) =>
    show ? (
      <button
        type="button"
        className={cn(button('secondary'), controlFont, 'ml-3 whitespace-nowrap px-2! py-1! text-[11px]! print:hidden')}
        data-edit-tentative=""
        onClick={() => openTentativeQuestionnaire()}
      >
        Edit Tentative Answers
      </button>
    ) : null;
  switch (notice.kind) {
    case 'locked':
      return (
        <div className={NOTICE.readOnly}>
          <strong>Confirmed plan is read-only.</strong> This order is in Need Re-Confirm List. Open it from that list to review and re-confirm the
          latest data.
        </div>
      );
    case 'confirm':
      return (
        <div className={notice.dirty ? NOTICE.internal : NOTICE.manual} data-preview-strip={notice.dirty ? undefined : ''}>
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
        <div className={NOTICE.review}>
          <strong>Reviewing latest uploaded plan.</strong> Confirmed BP Revised No: {notice.confirmedRevision} · Latest YB Revised No:{' '}
          {notice.latestRevision}. The previous confirmed plan stays saved until you click Re-Confirm Latest Plan. Row saves and machine choices
          here stay in this review draft.
        </div>
      );
    case 'tentative':
      return (
        <div className={NOTICE.tentative}>
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
        <div className={NOTICE.manual} data-preview-strip="">
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
    <section className={sectionClass} data-report-section="">
      <h3 className={sectionHeading}>
        {'Colour & Batch Info '}
        <span className={headingActions}>
          {view.bodyOd ? <OdControl od={view.bodyOd} seq={view.seq} disabled={disabled} /> : null}
          {view.tallBig ? <TallBigControl control={view.tallBig} seq={view.seq} disabled={disabled} /> : null}
          <CcDyeingModeControl mode={view.dyeingMode} seq={view.seq} disabled={disabled} />
          <AddRowButton kind="batch" disabled={disabled} />
          <button
            type="button"
            className={headingButton('primary')}
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
  const canEdit = useReportCanEdit();
  const { section, od, tallBig, table } = item;
  const kind = 'component:' + section.kind;
  const breakdown: Row[] = section.allowanceBreakdown || [];
  const errors: unknown[] = section.tallBigErrors || [];
  const warnings: unknown[] = section.warnings || [];
  return (
    <section className={sectionClass} data-report-section="" data-component-kind={section.kind}>
      <h3 className={sectionHeading}>
        <span>
          {text(section.title)}
          {section.separate ? (
            <>
              {' '}
              <small className="ml-1.5 rounded bg-[#fff5d5] px-[7px] py-[3px] text-[11px] text-[#875b00] dark:bg-[rgba(234,179,8,0.16)] dark:text-[#fde68a]">
                Separate
              </small>
            </>
          ) : null}
        </span>
        <span className={headingActions}>
          {od ? <OdControl od={od} seq={seq} disabled={disabled} /> : null}
          <TallBigDeclarationControl section={section} control={tallBig} seq={seq} disabled={disabled} />
          <label className={dyeingControl}>
            {'Dyeing Type '}
            <select
              key={seq}
              className={dyeingSelect}
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
          {section.manual && canEdit ? (
            <button
              type="button"
              className={headingButton('secondary')}
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
      <p className="my-[7px] text-[11px] text-[#64748b] print:hidden">
        Total Qty (kg) uses each size’s Weight /Pcs from BP Data. Flat Allowance is applied by colour and size before splitting whole pieces across
        batches. Edited quantities are final planned pieces; allowance is not added again. Changing Dyeing Type recalculates this section from BP
        Data.
      </p>
      {section.tallBigDeclared ? (
        <p className="my-2 bg-[#eff6ff] px-3 py-[9px] text-[12px] text-[#284f75] dark:bg-[rgba(59,130,246,0.1)] dark:text-[#93c5fd] print:hidden">
          Declared Tall/Big pieces are assigned to matching batches first. Remaining pieces use the colour’s No batches. Solid shares body batch
          numbers; YD and Separate retain their separate-number policy.
        </p>
      ) : null}
      {errors.length ? (
        <div
          className="my-2 border border-solid border-[#e7b9a7] bg-[#fff3ee] px-3 py-[9px] text-[12px] text-[#9d321b] dark:border-[rgba(239,68,68,0.35)] dark:bg-[rgba(239,68,68,0.1)] dark:text-[#fca5a5]"
          role="alert"
        >
          {errors.map((error, index) => (
            <div key={index}>{text(error)}</div>
          ))}
        </div>
      ) : null}
      {breakdown.length ? (
        <details className="my-2 text-[11px] text-[#52677e] dark:text-[#94a3b8] print:hidden">
          <summary>Flat Allowance breakdown</summary>
          <ReportTable headers={['Color', 'Size', 'BP pieces', 'Process Loss', 'Planned pieces']}>
            {breakdown.map((entry, index) => (
              <tr key={index} className={bodyRow}>
                <td className={grid.td}>{text(entry.shade)}</td>
                <td className={grid.td}>{text(entry.size)}</td>
                <td className={grid.td}>{text(entry.sourceQty)}</td>
                <td className={grid.td}>{text(entry.processLoss)}</td>
                <td className={grid.td}>{text(entry.plannedQty)}</td>
              </tr>
            ))}
          </ReportTable>
        </details>
      ) : null}
      {warnings.length ? (
        <div className={calculationNote}>
          {warnings.map((value, index) => (
            <div key={index}>{text(value)}</div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
