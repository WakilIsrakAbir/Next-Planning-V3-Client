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
} from '@/features/batch/engine';
import KnittingBadge from './KnittingBadge';
import { BatchTallBigSelect } from './ReportControls';
import { GeneralInput, InstructionInput, ReportRowActions, RowInput } from './RowEditing';
import { ReportTable, text } from './reportShared';

type Editor = Row | null;

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
  const editing = editor?.kind === 'general';
  const actions = generalInfoActions(locked);
  return (
    <section className="section">
      <h3 className="colour-section-heading">
        {'General Info '}
        {actions === 'save' ? (
          <span className="report-heading-actions report-add-row">
            <button type="button" className="btn success" data-general-action="save" disabled={disabled} onClick={() => handleGeneralInfoAction('save')}>
              Save
            </button>
            <button type="button" className="btn secondary" data-general-action="cancel" disabled={disabled} onClick={() => handleGeneralInfoAction('cancel')}>
              Cancel
            </button>
          </span>
        ) : actions === 'edit' ? (
          <button type="button" className="btn secondary report-add-row" data-general-action="edit" disabled={disabled} onClick={() => handleGeneralInfoAction('edit')}>
            Edit
          </button>
        ) : null}
      </h3>
      <div className="table-wrap">
        <table className="info-table">
          <tbody>
            {GENERAL_INFO_ROWS.map((fields, rowIndex) => (
              <tr key={rowIndex}>
                {fields.map(([key, label], index) => (
                  <React.Fragment key={key}>
                    <th>{label}</th>
                    <td colSpan={fields.length === 3 ? 3 : fields.length === 5 && index === 0 ? 3 : undefined}>
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
      <tr key={index} className={editing ? 'report-row-editing' : fabric.manual ? 'report-row-manual' : undefined}>
        {FABRIC_ROW_FIELDS.map(([field, label]) => (
          <td key={field}>
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
      <tr key="new" className="report-row-editing">
        {FABRIC_ROW_FIELDS.map(([field, label]) => (
          <td key={field}>
            <RowInput field={field} label={label} locked={locked} />
          </td>
        ))}
        <ReportRowActions kind="fabric" index={fabrics.length} editing manual editor={editor} locked={locked} disabled={disabled} />
      </tr>
    );
  if (!rows.length)
    rows.push(
      <tr key="empty">
        <td colSpan={FABRIC_ROW_FIELDS.length + 1} className="placeholder-cell">
          No uploaded Knitting Plan fabric data for this booking. Use Add Row to enter it manually.
        </td>
      </tr>
    );
  return (
    <ReportTable className="grid-table report-edit-table fabric-info-table" headers={[...FABRIC_ROW_FIELDS.map(([, label]) => label), 'Action']}>
      {rows}
    </ReportTable>
  );
});

/* ---------- Colour & Batch Info ---------- */
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
      <tr key={index} className={editing ? 'report-row-editing' : row.manual ? 'report-row-manual' : undefined}>
        {fields.map(([field, label], column) => {
          if (field === 'tallBig')
            return (
              <td key={field}>
                {editing ? (
                  <RowInput field={field} label={label} locked={locked} automaticTallBig={automaticTallBig} />
                ) : (
                  <BatchTallBigSelect row={row} index={index} seq={seq} disabled={disabled} automatic={automaticTallBig} />
                )}
              </td>
            );
          if (field === 'knitStatus')
            return (
              <td key={field} className="print-hide-knit">
                <KnittingBadge state={readiness?.[index]} summary />
              </td>
            );
          const cell = cells[index][column];
          return (
            <td key={field} className={field === 'loading' ? 'loading-val' : field === 'machineLabel' ? 'mc-accent' : undefined}>
              {editing && !calculated[column] ? (
                <RowInput field={field} label={label} locked={locked} automaticTallBig={automaticTallBig} />
              ) : field === 'shade' ? (
                <strong>{cell.display}</strong>
              ) : (
                cell.display
              )}
              {cell.knitNote ? (
                <div className="fabric-knit-note">
                  <KnittingBadge state={cell.knitNote} />
                </div>
              ) : null}
              {field === 'machineLabel' && row.assignmentError ? <div className="row-edit-error">Unassigned: {text(row.assignmentError)}</div> : null}
            </td>
          );
        })}
        <ReportRowActions kind="batch" index={index} editing={editing} manual={row.manual} editor={editor} locked={locked} disabled={disabled} />
      </tr>
    );
  });
  if (editor?.kind === 'batch' && editor.isNew)
    htmlRows.push(
      <tr key="new" className="report-row-editing">
        {fields.map(([field, label], column) => (
          <td key={field} className={field === 'knitStatus' ? 'print-hide-knit' : undefined}>
            {calculated[column] ? 'Auto' : <RowInput field={field} label={label} locked={locked} automaticTallBig={automaticTallBig} />}
          </td>
        ))}
        <ReportRowActions kind="batch" index={rows.length} editing manual editor={editor} locked={locked} disabled={disabled} />
      </tr>
    );
  if (!htmlRows.length)
    htmlRows.push(
      <tr key="empty">
        <td colSpan={fields.length + 1} className="placeholder-cell">
          No batch rows. Use Add Row to enter one manually.
        </td>
      </tr>
    );
  // Old: table(...).replace('<th>Knit Status</th>', '<th class="print-hide-knit">Knit Status</th>') (first one only).
  const knitHeader = fields.findIndex(([, label]) => label === 'Knit Status');
  const headers = [...fields.map(([, label], index) => (index === knitHeader ? { label, className: 'print-hide-knit' } : label)), 'Action'];
  return (
    <>
      <ReportTable className="grid-table report-edit-table" headers={headers}>
        {htmlRows}
      </ReportTable>
      {readiness ? (
        <p className="knit-allocation-note">
          Knit Status uses the latest Knit Prod. for this order, floor, Color, FabricConstruction and GSM. Earlier listed batches reserve production
          first. CC production requires a separate check.
        </p>
      ) : null}
      {warnings.length ? (
        <div className="batch-calculation-note">
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
      <tr key={isNew ? 'new' : index} className={editing ? 'report-row-editing' : section.manual ? 'report-row-manual' : undefined}>
        {fields.map(([field, label]) => {
          if (field === 'tallBig') return <td key={field}>{tallBig}</td>;
          const size = field.startsWith('qty:') ? field.slice(4) : null;
          const value = size !== null ? (row.quantities?.[size] ?? 0) : (row[field] ?? '');
          return (
            <td key={field}>
              {editing ? <RowInput field={field} label={label} locked={locked} /> : text(value)}
              {editing && size !== null ? (
                <label className="component-weight-input">
                  {'kg/pc '}
                  <RowInput field={'weight:' + size} label={'Weight /Pcs for ' + label} locked={locked} fallback={row.weights?.[size] ?? ''} />
                </label>
              ) : null}
            </td>
          );
        })}
        <td>{editing ? 'Auto' : text(row.totalPcs ?? 0)}</td>
        <td title={text(row.totalKg ?? 'Weight /Pcs is missing')}>{editing ? 'Auto' : row.totalKg === null ? 'Weight missing' : kgText(row.totalKg || 0)}</td>
        <ReportRowActions kind={kind} index={index} editing={!!editing} manual={section.manual} editor={editor} locked={locked} disabled={disabled} />
      </tr>
    );
  };
  const sectionRows: Row[] = section.rows || [];
  const rows = sectionRows.map((row, index) => render(row, index, false, table.rowTallBig[index] ?? 'No'));
  if (editorHere && editor?.isNew) rows.push(render({}, sectionRows.length, true, table.newRowTallBig));
  if (!rows.length)
    rows.push(
      <tr key="empty">
        <td colSpan={fields.length + 3} className="placeholder-cell">
          No component batches could be allocated. Review BP Data, or use Add Row.
        </td>
      </tr>
    );
  if (table.totals)
    rows.push(
      <tr key="total" className="component-total">
        <td colSpan={table.totals.span}>Allocated pieces</td>
        {table.totals.sizes.map((qty, index) => (
          <td key={index}>{text(qty)}</td>
        ))}
        {editorHere ? (
          <>
            <td></td>
            <td></td>
            <td></td>
          </>
        ) : null}
        <td>{text(table.totals.pieces)}</td>
        <td>{table.totals.kg === null ? 'Weight missing' : kgText(table.totals.kg)}</td>
        <td className="report-row-actions"></td>
      </tr>
    );
  return (
    <ReportTable className="grid-table report-edit-table" headers={[...fields.map(([, label]) => label), 'Total Qty (pcs)', 'Total Qty (kg)', 'Action']}>
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
      <tr key={isNew ? 'new' : index} className={editing ? 'report-row-editing' : undefined}>
        {fields.map(([field]) => (
          <td key={field}>{editing ? <InstructionInput field={field} locked={locked} /> : text(row[field])}</td>
        ))}
        <ReportRowActions kind={kind} index={index} editing={!!editing} manual={false} editor={editor} locked={locked} disabled={disabled} />
      </tr>
    );
  };
  const html = rows.map((row, index) => render(row, index));
  if (editor?.kind === kind && editor.isNew) html.push(render({}, rows.length, true));
  if (!html.length)
    html.push(
      <tr key="empty">
        <td colSpan={3} className="placeholder-cell">
          No instructions. Use Add Row to enter one.
        </td>
      </tr>
    );
  return (
    <ReportTable className="grid-table report-edit-table instruction-table" headers={['SL No', 'Details', 'Action']}>
      {html}
    </ReportTable>
  );
});
