'use client';

/* Editable tables of the report (old generalInfoTable, fabricInfoEditableTable, colourBatchEditableTable,
   componentEditableTable and editableInstructionTable). They render the snapshot built by the engine
   (ReportBodyView) and the row being edited; they are memoised, so typing in the edited row only re-renders
   its inputs. `disabled` is the old setMutationBusy rule (save running, data not ready, or plan locked). */
import React from 'react';
import {
  FABRIC_ROW_FIELDS,
  GENERAL_INFO_ROWS,
  generalInfoActions,
  handleGeneralInfoAction,
  kgText,
  oneDecimalQty,
  type ReportBodyBatchTable,
  type ReportBodyComponentTable,
  type ReportBodyField,
  type Row,
} from '@/features/batch/lib';
import { cn } from '@/lib/cn';
import { button, controlFont, placeholderCell } from '../../ui/styles';
import KnittingBadge from './KnittingBadge';
import { BatchTallBigSelect } from './ReportControls';
import { GeneralInput, InstructionInput, ReportRowActions, RowInput, actionsCell, rowError } from './RowEditing';
import {
  ReportTable,
  bodyRow,
  editRowClass,
  grid,
  headingButton,
  info,
  reportLayout,
  reportTableWrap,
  text,
  useReportCanEdit,
} from './reportShared';

type Editor = Row | null;

/** A report section and its heading (old `.section` and `.section h3.colour-section-heading`). */
export const section = 'mt-5 print:mt-2';
export const sectionHeading =
  'mb-2 flex flex-wrap items-center justify-between gap-3 border-l-4 border-solid border-batch-primary bg-[#edf3f9] px-[9px] py-[5px] ' +
  'text-[13.5px] font-bold text-[#15395c] dark:[#reportContent_&]:bg-[#1e2330] dark:[#reportContent_&]:text-[#e2e8f0] print:break-after-avoid';
/** The buttons and selects at the right of a section heading (old `.report-heading-actions`). */
export const headingActions = 'flex flex-wrap items-center gap-2';

/** A row with the edit state of the old `.report-row-editing` / `.report-row-manual` classes. */
function editRow(editing: boolean, manual: unknown): { className: string; 'data-report-row-editing'?: string } {
  return { className: cn(bodyRow, editRowClass(editing, manual)), 'data-report-row-editing': editing ? '' : undefined };
}

/** The cell of an empty table (old `.placeholder-cell`). */
const emptyCell = cn(grid.td, placeholderCell);

/** Notes under Colour & Batch Info (old `.knit-allocation-note`, `.batch-calculation-note`). */
const KNIT_NOTE = 'mt-2 text-[11px] leading-[1.5] text-[#60738a] dark:text-[#94a3b8] print:hidden';
export const calculationNote =
  'mt-2 rounded-[5px] border border-solid border-[#fed7aa] bg-[#fff7ed] px-3 py-[9px] text-[12px] text-[#9a3412] ' +
  'dark:border-[rgba(245,158,11,0.35)] dark:bg-[rgba(245,158,11,0.1)] dark:text-[#fdba74]';

/* ---------- General Info ---------- */
export const GeneralInfoSection = React.memo(function GeneralInfoSection({
  values,
  editor,
  disabled,
  locked,
}: {
  values: Row;
  editor: Editor;
  disabled: boolean;
  locked: boolean;
}) {
  const canEdit = useReportCanEdit();
  const editing = editor?.kind === 'general';
  const actions = canEdit ? generalInfoActions(locked) : null;
  return (
    <section className={section} data-report-section="">
      <h3 className={sectionHeading}>
        {'General Info '}
        {actions === 'save' ? (
          <span className={cn(headingActions, 'px-2.5 py-1.5 text-[11.5px] print:hidden')}>
            <button
              type="button"
              className={cn(button('success'), controlFont)}
              data-general-action="save"
              disabled={disabled}
              onClick={() => handleGeneralInfoAction('save')}
            >
              Save
            </button>
            <button
              type="button"
              className={cn(button('secondary'), controlFont)}
              data-general-action="cancel"
              disabled={disabled}
              onClick={() => handleGeneralInfoAction('cancel')}
            >
              Cancel
            </button>
          </span>
        ) : actions === 'edit' ? (
          <button type="button" className={headingButton('secondary')} data-general-action="edit" disabled={disabled} onClick={() => handleGeneralInfoAction('edit')}>
            Edit
          </button>
        ) : null}
      </h3>
      <div className={reportTableWrap} data-report-table-wrap="">
        <table className={reportLayout.info}>
          <tbody>
            {GENERAL_INFO_ROWS.map((fields, rowIndex) => (
              <tr key={rowIndex} className={bodyRow}>
                {fields.map(([key, label], index) => (
                  <React.Fragment key={key}>
                    <th className={info.th}>{label}</th>
                    <td className={info.td} colSpan={fields.length === 3 ? 3 : fields.length === 5 && index === 0 ? 3 : undefined}>
                      {editing ? <GeneralInput field={key} label={label} locked={locked} /> : text(values[key] || '—')}
                    </td>
                  </React.Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
});

/* ---------- Fabric Info ---------- */
export const FabricInfoEditableTable = React.memo(function FabricInfoEditableTable({
  fabrics,
  editor,
  disabled,
  locked,
}: {
  fabrics: Row[];
  editor: Editor;
  disabled: boolean;
  locked: boolean;
}) {
  const rows = fabrics.map((fabric, index) => {
    const editing = editor?.kind === 'fabric' && editor.index === index && !editor.isNew;
    return (
      <tr key={index} {...editRow(editing, fabric.manual)}>
        {FABRIC_ROW_FIELDS.map(([field, label]) => (
          <td key={field} className={grid.td}>
            {editing ? (
              <RowInput field={field} label={label} locked={locked} />
            ) : ['name', 'gsm', 'type'].includes(field) ? (
              <strong>{text(fabric[field])}</strong>
            ) : (
              text(field === 'greigeQty' ? oneDecimalQty(fabric[field]) : fabric[field])
            )}
          </td>
        ))}
        <ReportRowActions kind="fabric" index={index} editing={editing} manual={fabric.manual} editor={editor} locked={locked} disabled={disabled} />
      </tr>
    );
  });
  if (editor?.kind === 'fabric' && editor.isNew)
    rows.push(
      <tr key="new" {...editRow(true, true)}>
        {FABRIC_ROW_FIELDS.map(([field, label]) => (
          <td key={field} className={grid.td}>
            <RowInput field={field} label={label} locked={locked} />
          </td>
        ))}
        <ReportRowActions kind="fabric" index={fabrics.length} editing manual editor={editor} locked={locked} disabled={disabled} />
      </tr>
    );
  if (!rows.length)
    rows.push(
      <tr key="empty" className={bodyRow}>
        <td colSpan={FABRIC_ROW_FIELDS.length + 1} className={emptyCell}>
          No uploaded Knitting Plan fabric data for this booking. Use Add Row to enter it manually.
        </td>
      </tr>
    );
  return (
    <ReportTable layout={reportLayout.fabric} edit headers={[...FABRIC_ROW_FIELDS.map(([, label]) => label), 'Action']}>
      {rows}
    </ReportTable>
  );
});

/* ---------- Colour & Batch Info ---------- */
/** Value colours of the batch table (old `.loading-val`, `.mc-accent`). */
const VALUE_CELL: Record<string, string> = {
  loading: 'font-bold text-[#c53a32] dark:text-[#f87171]',
  machineLabel: 'font-bold text-[#155db2] dark:text-[#34d399]',
};

export const ColourBatchEditableTable = React.memo(function ColourBatchEditableTable({
  batch,
  seq,
  editor,
  disabled,
  locked,
}: {
  batch: ReportBodyBatchTable;
  seq: number;
  editor: Editor;
  disabled: boolean;
  locked: boolean;
}) {
  const { fields, rows, warnings, calculated, cells, readiness, automaticTallBig } = batch;
  const htmlRows = rows.map((row, index) => {
    const editing = editor?.kind === 'batch' && editor.index === index && !editor.isNew;
    return (
      <tr key={index} {...editRow(editing, row.manual)}>
        {fields.map(([field, label], column) => {
          if (field === 'tallBig')
            return (
              <td key={field} className={grid.td}>
                {editing ? (
                  <RowInput field={field} label={label} locked={locked} automaticTallBig={automaticTallBig} />
                ) : (
                  <BatchTallBigSelect row={row} index={index} seq={seq} disabled={disabled} automatic={automaticTallBig} />
                )}
              </td>
            );
          if (field === 'knitStatus')
            return (
              <td key={field} className={cn(grid.td, 'print:hidden')}>
                <KnittingBadge state={readiness?.[index]} summary />
              </td>
            );
          const cell = cells[index][column];
          return (
            <td key={field} className={cn(grid.td, VALUE_CELL[field])}>
              {editing && !calculated[column] ? (
                <RowInput field={field} label={label} locked={locked} automaticTallBig={automaticTallBig} />
              ) : field === 'shade' ? (
                <strong>{cell.display}</strong>
              ) : (
                cell.display
              )}
              {cell.knitNote ? (
                <div className="mt-[5px] print:hidden">
                  <KnittingBadge state={cell.knitNote} />
                </div>
              ) : null}
              {field === 'machineLabel' && row.assignmentError ? <div className={rowError}>Unassigned: {text(row.assignmentError)}</div> : null}
            </td>
          );
        })}
        <ReportRowActions kind="batch" index={index} editing={editing} manual={row.manual} editor={editor} locked={locked} disabled={disabled} />
      </tr>
    );
  });
  if (editor?.kind === 'batch' && editor.isNew)
    htmlRows.push(
      <tr key="new" {...editRow(true, true)}>
        {fields.map(([field, label], column) => (
          <td key={field} className={cn(grid.td, field === 'knitStatus' && 'print:hidden')}>
            {calculated[column] ? 'Auto' : <RowInput field={field} label={label} locked={locked} automaticTallBig={automaticTallBig} />}
          </td>
        ))}
        <ReportRowActions kind="batch" index={rows.length} editing manual editor={editor} locked={locked} disabled={disabled} />
      </tr>
    );
  if (!htmlRows.length)
    htmlRows.push(
      <tr key="empty" className={bodyRow}>
        <td colSpan={fields.length + 1} className={emptyCell}>
          No batch rows. Use Add Row to enter one manually.
        </td>
      </tr>
    );
  // Old: table(...).replace('<th>Knit Status</th>', '<th class="print-hide-knit">Knit Status</th>') (first one only).
  const knitHeader = fields.findIndex(([, label]) => label === 'Knit Status');
  const headers = [...fields.map(([, label], index) => (index === knitHeader ? { label, className: 'print:hidden' } : label)), 'Action'];
  return (
    <>
      <ReportTable edit headers={headers}>
        {htmlRows}
      </ReportTable>
      {readiness ? (
        <p className={KNIT_NOTE}>
          Knit Status uses the latest Knit Prod. for this order, floor, Color, FabricConstruction and GSM. Earlier listed batches reserve production
          first. CC production requires a separate check.
        </p>
      ) : null}
      {warnings.length ? (
        <div className={calculationNote}>
          {warnings.map((warning, index) => (
            <div key={index}>{text(warning)}</div>
          ))}
        </div>
      ) : null}
    </>
  );
});

/* ---------- component sections ---------- */
const NEW_SIZE_FIELDS = ['newSize', 'newSizeQty', 'newSizeWeight'];

/** Weight /Pcs input under a size quantity (old `.component-weight-input`; its input is narrower). */
const WEIGHT_LABEL = 'mt-[5px] block text-[10px] text-[#60748a] dark:text-[#94a3b8] [&_input]:min-w-[65px]';

/** Allocated pieces row (old `.component-total`; in dark mode its cells were filled inside #reportContent). */
const TOTAL_ROW = cn(bodyRow, 'bg-[#edf4fb] font-bold dark:odd:bg-[#1e2330]');
const TOTAL_CELL = cn(grid.td, 'dark:[#reportContent_&]:bg-[#1e2330]');

export function ComponentEditableTable({
  section,
  table,
  editor,
  disabled,
  locked,
}: {
  section: Row;
  table: ReportBodyComponentTable;
  editor: Editor;
  disabled: boolean;
  locked: boolean;
}) {
  const kind = 'component:' + section.kind,
    editorHere = editor?.kind === kind;
  const fields: ReportBodyField[] = table.fields.filter(([field]) => editorHere || !NEW_SIZE_FIELDS.includes(field));
  const render = (row: Row, index: number, isNew: boolean, tallBig: string) => {
    const editing = editorHere && editor?.index === index && (isNew || !editor?.isNew);
    return (
      <tr key={isNew ? 'new' : index} {...editRow(editing, section.manual)}>
        {fields.map(([field, label]) => {
          if (field === 'tallBig')
            return (
              <td key={field} className={grid.td}>
                {tallBig}
              </td>
            );
          const size = field.startsWith('qty:') ? field.slice(4) : null;
          const value = size !== null ? (row.quantities?.[size] ?? 0) : (row[field] ?? '');
          return (
            <td key={field} className={grid.td}>
              {editing ? <RowInput field={field} label={label} locked={locked} /> : text(value)}
              {editing && size !== null ? (
                <label className={WEIGHT_LABEL}>
                  {'kg/pc '}
                  <RowInput field={'weight:' + size} label={'Weight /Pcs for ' + label} locked={locked} fallback={row.weights?.[size] ?? ''} />
                </label>
              ) : null}
            </td>
          );
        })}
        <td className={grid.td}>{editing ? 'Auto' : text(row.totalPcs ?? 0)}</td>
        <td className={grid.td} title={text(row.totalKg ?? 'Weight /Pcs is missing')}>
          {editing ? 'Auto' : row.totalKg === null ? 'Weight missing' : kgText(row.totalKg || 0)}
        </td>
        <ReportRowActions kind={kind} index={index} editing={!!editing} manual={section.manual} editor={editor} locked={locked} disabled={disabled} />
      </tr>
    );
  };
  const sectionRows: Row[] = section.rows || [];
  const rows = sectionRows.map((row, index) => render(row, index, false, table.rowTallBig[index] ?? 'No'));
  if (editorHere && editor?.isNew) rows.push(render({}, sectionRows.length, true, table.newRowTallBig));
  if (!rows.length)
    rows.push(
      <tr key="empty" className={bodyRow}>
        <td colSpan={fields.length + 3} className={emptyCell}>
          No component batches could be allocated. Review BP Data, or use Add Row.
        </td>
      </tr>
    );
  if (table.totals)
    rows.push(
      <tr key="total" className={TOTAL_ROW}>
        <td colSpan={table.totals.span} className={TOTAL_CELL}>
          Allocated pieces
        </td>
        {table.totals.sizes.map((qty, index) => (
          <td key={index} className={TOTAL_CELL}>
            {text(qty)}
          </td>
        ))}
        {editorHere ? (
          <>
            <td className={TOTAL_CELL}></td>
            <td className={TOTAL_CELL}></td>
            <td className={TOTAL_CELL}></td>
          </>
        ) : null}
        <td className={TOTAL_CELL}>{text(table.totals.pieces)}</td>
        <td className={TOTAL_CELL}>{table.totals.kg === null ? 'Weight missing' : kgText(table.totals.kg)}</td>
        <td className={cn(actionsCell, 'dark:[#reportContent_&]:bg-[#1e2330]')} data-preview-strip=""></td>
      </tr>
    );
  return (
    <ReportTable edit headers={[...fields.map(([, label]) => label), 'Total Qty (pcs)', 'Total Qty (kg)', 'Action']}>
      {rows}
    </ReportTable>
  );
}

/* ---------- Instruction ---------- */
export const EditableInstructionTable = React.memo(function EditableInstructionTable({
  rows,
  fields,
  editor,
  disabled,
  locked,
}: {
  rows: Row[];
  fields: ReportBodyField[];
  editor: Editor;
  disabled: boolean;
  locked: boolean;
}) {
  const kind = 'instruction';
  const render = (row: Row, index: number, isNew = false) => {
    const editing = editor?.kind === kind && editor.index === index && (isNew || !editor.isNew);
    return (
      <tr key={isNew ? 'new' : index} {...editRow(!!editing, false)}>
        {fields.map(([field]) => (
          <td key={field} className={grid.td}>
            {editing ? <InstructionInput field={field} locked={locked} /> : text(row[field])}
          </td>
        ))}
        <ReportRowActions kind={kind} index={index} editing={!!editing} manual={false} editor={editor} locked={locked} disabled={disabled} />
      </tr>
    );
  };
  const html = rows.map((row, index) => render(row, index));
  if (editor?.kind === kind && editor.isNew) html.push(render({}, rows.length, true));
  if (!html.length)
    html.push(
      <tr key="empty" className={bodyRow}>
        <td colSpan={3} className={emptyCell}>
          No instructions. Use Add Row to enter one.
        </td>
      </tr>
    );
  return (
    <ReportTable layout={reportLayout.instruction} edit headers={['SL No', 'Details', 'Action']}>
      {html}
    </ReportTable>
  );
});
