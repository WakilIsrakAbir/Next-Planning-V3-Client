'use client';

/*
 * Data Management > Plan Check List: the criteria an order's Checkpoint & Planning Guide asks about (Yes/No per
 * order). Every change stays a draft on this page until Save Changes, which saves the whole list at once with the
 * version it is based on (lib/plan-check-list.ts). Validation is the server's: its message names the row.
 * Open to Admin and to users with the Plan Check List permission; anyone else gets "Access denied" and the API is
 * never called.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ListChecks,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useUnsavedChanges } from '@/lib/unsaved-changes';
import { batchHasMenu } from '@/features/batch/lib/batch-navigation';
import {
  PlanCheckListError,
  getCachedPlanCheckList,
  loadPlanCheckList,
  planCheckListErrorText,
  savePlanCheckList,
  type PlanCheckItem,
  type PlanCheckList,
  type PlanCheckSaveItem,
} from '@/features/management/lib/plan-check-list';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import InlineSpinner from '@/components/ui/InlineSpinner';

// The server's limit (Plan Check List service, MAX_CRITERIA).
const MAX_CRITERIA = 100;
// The name this page's unsaved work has in "Unsaved changes in: ..." (src/lib/unsaved-changes.ts).
const UNSAVED_LABEL = 'Plan Check List';

/** A row of the draft. The days are kept as typed; `key` follows the row when it moves. */
interface DraftRow {
  key: string;
  /** null for a row added on this page: the server gives it an id when it is saved. */
  id: string | null;
  name: string;
  startDays: string;
  endDays: string;
  active: boolean;
}

/** The message above the table: a refused save or load, or a save that someone else's save overtook. */
interface Notice {
  kind: 'error' | 'conflict';
  text: string;
  /** The row the server's message names ("Row 3 (CPB): ..."), highlighted while the message shows. */
  rowKey?: string;
}

function toRows(items: PlanCheckItem[]): DraftRow[] {
  const keys = new Set<string>();
  return items.map((item, index) => {
    let key = `id:${item.id}`;
    if (keys.has(key)) key = `${key}:${index}`;
    keys.add(key);
    return {
      key,
      id: typeof item.id === 'string' ? item.id : null,
      name: String(item.name ?? ''),
      startDays: String(item.startDays ?? ''),
      endDays: String(item.endDays ?? ''),
      active: item.active === true,
    };
  });
}

// Days are sent as numbers when they look like one (the server refuses decimals and values out of range with its
// own message); anything else is sent as typed, so the server names the row.
function daysValue(text: string): number | string {
  const trimmed = text.trim();
  return /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed;
}

function toPayload(rows: DraftRow[]): PlanCheckSaveItem[] {
  return rows.map((row) => {
    const item: PlanCheckSaveItem = { name: row.name, startDays: daysValue(row.startDays), endDays: daysValue(row.endDays), active: row.active };
    return row.id ? { id: row.id, ...item } : item;
  });
}

// What a save would store, names as the server stores them (trimmed, inner spaces collapsed).
function comparable(items: PlanCheckSaveItem[]): string {
  return JSON.stringify(
    items.map((item) => [item.id ?? null, String(item.name).trim().replace(/\s+/g, ' '), item.startDays, item.endDays, item.active])
  );
}

// "Row 3 (CPB): ..." -> the key of row 3 of the rows that were sent.
function namedRowKey(message: string, rows: DraftRow[]): string | undefined {
  const match = /^Row (\d+)\b/.exec(message);
  return match ? rows[Number(match[1]) - 1]?.key : undefined;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Bangladesh time (UTC+6, no daylight saving), as the server words "changed by <user> at <time>": 21-Nov-2026 14:05. */
function formatDhakaDateTime(iso: string | null): string {
  if (!iso) return '';
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '';
  const dhaka = new Date(time + 6 * 60 * 60 * 1000);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(dhaka.getUTCDate())}-${MONTHS[dhaka.getUTCMonth()]}-${dhaka.getUTCFullYear()} ${two(dhaka.getUTCHours())}:${two(dhaka.getUTCMinutes())}`;
}

function savedByText(list: PlanCheckList): string {
  const when = formatDhakaDateTime(list.updatedAt);
  if (list.updatedBy === 'system') return when ? `Standard list since ${when}` : 'Standard list';
  return `Last saved by ${list.updatedBy || 'unknown'}${when ? `, ${when}` : ''}`;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export default function PlanCheckListScreen() {
  // The dashboard renders pages only on the client (after the session check), so localStorage is readable here.
  const [allowed] = useState(() => batchHasMenu('dataManagement', 'planCheckList'));
  // The list as last loaded or saved (the draft's base). The shared copy shows at once; the latest is loaded on open.
  const [list, setList] = useState<PlanCheckList | null>(() => (allowed ? getCachedPlanCheckList() : null));
  const [rows, setRows] = useState<DraftRow[]>(() => (list ? toRows(list.items) : []));
  const [loading, setLoading] = useState(allowed); // the first load starts at once
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // A row added with "Add Criteria": its name box takes the focus when it appears.
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const addedRows = useRef(0);

  const canEdit = list?.canEdit === true;
  const busy = loading || saving;
  // While a load or a save runs nothing can be changed, so its answer never meets a newer draft.
  const editable = canEdit && !busy;
  const dirty = useMemo(() => list !== null && comparable(toPayload(rows)) !== comparable(list.items), [list, rows]);
  const usage = list?.usage;

  // Leaving with unsaved edits asks first (Sidebar links, Sign Out, closing or reloading the tab).
  useUnsavedChanges('plan-check-list', dirty ? [UNSAVED_LABEL] : []);

  useEffect(() => {
    // Without the permission the API is never called.
    if (!allowed) return undefined;
    let live = true;
    loadPlanCheckList({ fresh: true })
      .then((latest) => {
        if (!live) return;
        setList(latest);
        setRows(toRows(latest.items));
      })
      .catch((err: unknown) => {
        if (live) setNotice({ kind: 'error', text: planCheckListErrorText(err) });
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [allowed]);

  // One toast at a time: a newer toast restarts the timer, so an older timer never closes it early.
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((text: string | null) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = text === null ? null : setTimeout(() => setToast(null), 3500);
    setToast(text);
  }, []);

  const updateRow = (key: string, patch: Partial<DraftRow>) =>
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const moveRow = (index: number, step: -1 | 1) =>
    setRows((prev) => {
      const to = index + step;
      if (to < 0 || to >= prev.length) return prev;
      const next = prev.slice();
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

  const usedBy = (row: DraftRow): number => (row.id && usage ? Number(usage[row.id]) || 0 : 0);

  const rowName = (row: DraftRow): string =>
    row.name.trim() || list?.items.find((item) => item.id === row.id)?.name || 'this criterion';

  const addRow = () => {
    addedRows.current += 1;
    const key = `new:${addedRows.current}`;
    setRows((prev) => [...prev, { key, id: null, name: '', startDays: '0', endDays: '0', active: true }]);
    setFocusKey(key);
  };

  // Only this page changes; a criterion that orders set to Yes is deleted only after the user agrees.
  const removeRow = (row: DraftRow) => {
    const used = usedBy(row);
    if (
      used > 0 &&
      !window.confirm(
        `"${rowName(row)}" is set to Yes on ${plural(used, 'order', 'orders')}.\n\n` +
          'Delete it anyway? Those orders will show it as Removed. To keep it on them, set it Inactive instead.'
      )
    ) {
      return;
    }
    setRows((prev) => prev.filter((r) => r.key !== row.key));
  };

  // The draft becomes the server's standard list; nothing is saved until Save Changes.
  const resetToStandard = () => {
    if (!list) return;
    const standardIds = new Set(list.defaults.map((item) => item.id));
    const lost = rows.filter((row) => row.id !== null && !standardIds.has(row.id) && usedBy(row) > 0);
    const lines = ['Replace the list with the standard criteria?', '', 'Only this page changes: nothing is saved until you click Save Changes.'];
    if (lost.length > 0) {
      lines.push('', 'These criteria are set to Yes on orders and will be removed:');
      lost.forEach((row) => lines.push(`- ${rowName(row)} (${plural(usedBy(row), 'order', 'orders')})`));
    }
    if (!window.confirm(lines.join('\n'))) return;
    setRows(toRows(list.defaults));
    setNotice((prev) => (prev?.kind === 'error' ? null : prev));
  };

  const reload = () => {
    if (dirty && !window.confirm('Discard your unsaved changes and load the latest Plan Check List?')) return;
    setLoading(true);
    setNotice(null);
    loadPlanCheckList({ fresh: true })
      .then((latest) => {
        setList(latest);
        setRows(toRows(latest.items));
      })
      .catch((err: unknown) => setNotice({ kind: 'error', text: planCheckListErrorText(err) }))
      .finally(() => setLoading(false));
  };

  const save = () => {
    if (!list || !dirty || busy) return;
    const sent = rows;
    setSaving(true);
    setNotice(null);
    // An earlier "saved" toast must not stand next to this save's outcome.
    showToast(null);
    savePlanCheckList(toPayload(sent), list.version)
      .then((saved) => {
        setList(saved);
        setRows(toRows(saved.items));
        showToast('Plan Check List saved.');
      })
      .catch((err: unknown) => {
        const text = planCheckListErrorText(err, 'Could not save the Plan Check List.');
        // Someone saved first: the draft stays, Reload shows the latest list.
        // The server's 409 text asks to reload the page; the notice has its own Reload button.
        if (err instanceof PlanCheckListError && err.code === 'CONFLICT') {
          setNotice({ kind: 'conflict', text: text.replace('Reload the page to see the latest values.', 'Click Reload to see the latest values.') });
        }
        else setNotice({ kind: 'error', text, rowKey: namedRowKey(text, sent) });
      })
      .finally(() => setSaving(false));
  };

  if (!allowed) {
    return (
      <div className="card bg-base-100 border border-base-300 p-8 text-center max-w-xl mx-auto mt-10">
        <ShieldAlert className="w-8 h-8 mx-auto text-warning" />
        <h2 className="font-bold mt-3">Access denied</h2>
        <p className="text-xs text-base-content/60 mt-1">
          Plan Check List needs the Plan Check List permission (Data Management). Ask an Admin.
        </p>
      </div>
    );
  }

  const activeCount = rows.filter((row) => row.active).length;
  const columns = canEdit ? 6 : 5;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="toast toast-top toast-end z-50">
          <div className="alert alert-success text-xs font-bold text-white shadow-lg">
            <CheckCircle2 className="h-4 w-4" />
            <span>{toast}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-base-content/50 mb-1">Data Management › Plan Check List</div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-primary shrink-0" />
            Plan Check List
          </h2>
          <p className="text-xs text-base-content/60 mt-1 max-w-3xl">
            The criteria each order&apos;s Checkpoint &amp; Planning Guide asks about. When criteria are Yes, Knitting Start moves by
            the largest Start days among them and Knitting End by the largest End days.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button type="button" onClick={reload} disabled={busy} className="btn btn-outline btn-sm gap-2">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Reload
          </button>
          {canEdit && (
            <>
              <button
                type="button"
                onClick={resetToStandard}
                disabled={busy || !list || list.defaults.length === 0}
                className="btn btn-ghost btn-sm gap-2"
              >
                <RotateCcw className="h-4 w-4" /> Reset to Standard
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy || !dirty}
                className="btn btn-primary btn-sm font-bold shadow-md shadow-primary/25 gap-2"
              >
                {saving ? (
                  <>
                    <InlineSpinner size={12} /> Saving…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Save Changes
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* A refused save or load (the server's own message), or a save someone else's save overtook */}
      {notice && (
        <div
          role="alert"
          className={cn(
            'alert text-xs font-semibold py-2 flex flex-wrap items-center gap-2',
            notice.kind === 'conflict' ? 'alert-warning' : 'alert-error'
          )}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1 min-w-0">{notice.text}</span>
          {notice.kind === 'conflict' && (
            <button type="button" onClick={reload} disabled={busy} className="btn btn-xs">
              <RefreshCw className="h-3 w-3" /> Reload
            </button>
          )}
          <button type="button" onClick={() => setNotice(null)} className="btn btn-ghost btn-xs btn-square text-current hover:text-base-content focus-visible:text-base-content" aria-label="Close message">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Criteria */}
      <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-base-300 flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-sm">Criteria</span>
          <span className="text-xs text-base-content/60" data-testid="plan-check-list-status">
            {list ? (
              <>
                {plural(rows.length, 'criterion', 'criteria')} · {activeCount} active ·{' '}
                <span className={cn(dirty && 'font-bold text-base-content')}>{dirty ? 'Unsaved changes' : 'Saved'}</span> ·{' '}
                {savedByText(list)}
              </>
            ) : loading ? (
              'Loading…'
            ) : (
              'Not loaded'
            )}
          </span>
        </div>
        {list && !canEdit && (
          <div className="px-4 py-2 border-b border-base-300 text-xs text-base-content/60">
            View only: saving the Plan Check List needs the Plan Check List permission. Ask an Admin.
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead className="bg-base-200/60 text-xs">
              <tr>
                <th className="w-10">#</th>
                <th>Criteria Name</th>
                <th>Start (days)</th>
                <th>End (days)</th>
                <th>Active</th>
                {canEdit && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="text-xs">
              {!list ? (
                <tr>
                  <td colSpan={columns} className="p-8 text-center">
                    {loading ? (
                      <LoadingSpinner message="Loading Plan Check List..." size="sm" overlay={false} />
                    ) : (
                      <span className="text-base-content/60">The Plan Check List could not be loaded. Try Reload.</span>
                    )}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns} className="p-12 text-center text-base-content/60">
                    No criteria.{canEdit ? ' Add one, or Reset to Standard.' : ''}
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  const n = index + 1;
                  const used = usedBy(row);
                  const label = row.name.trim() || `row ${n}`;
                  const dim = !row.active && 'opacity-60';
                  return (
                    <tr key={row.key} className={cn(notice?.rowKey === row.key && 'bg-error/10')}>
                      <td className={cn('font-bold text-base-content/60', dim)}>{n}</td>
                      <td className={cn('min-w-44', dim)}>
                        {canEdit ? (
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => updateRow(row.key, { name: e.target.value })}
                            disabled={!editable}
                            // A row added with "Add Criteria" starts in its name box.
                            autoFocus={row.key === focusKey}
                            placeholder="Criteria name"
                            aria-label={`Criteria name, row ${n}`}
                            className="input input-bordered input-sm w-full text-xs"
                          />
                        ) : (
                          <span className="font-semibold">{row.name}</span>
                        )}
                        {used > 0 && (
                          <span className="block text-[10px] text-base-content/50 mt-0.5">Yes on {plural(used, 'order', 'orders')}</span>
                        )}
                      </td>
                      <td className={cn(dim)}>
                        {canEdit ? (
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={365}
                            step={1}
                            value={row.startDays}
                            onChange={(e) => updateRow(row.key, { startDays: e.target.value })}
                            disabled={!editable}
                            aria-label={`Start days, row ${n}`}
                            className="input input-bordered input-sm w-20 text-xs"
                          />
                        ) : (
                          row.startDays
                        )}
                      </td>
                      <td className={cn(dim)}>
                        {canEdit ? (
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={365}
                            step={1}
                            value={row.endDays}
                            onChange={(e) => updateRow(row.key, { endDays: e.target.value })}
                            disabled={!editable}
                            aria-label={`End days, row ${n}`}
                            className="input input-bordered input-sm w-20 text-xs"
                          />
                        ) : (
                          row.endDays
                        )}
                      </td>
                      <td>
                        {canEdit ? (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={row.active}
                              onChange={(e) => updateRow(row.key, { active: e.target.checked })}
                              disabled={!editable}
                              aria-label={`Active, row ${n}`}
                              className="toggle toggle-success toggle-xs"
                            />
                            <span className="text-[11px] font-bold">{row.active ? 'Active' : 'Inactive'}</span>
                          </label>
                        ) : (
                          <span className={cn('badge badge-sm font-bold', row.active ? 'badge-success' : 'badge-ghost')}>
                            {row.active ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="text-right">
                          <span className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => moveRow(index, -1)}
                              disabled={!editable || index === 0}
                              aria-label={`Move ${label} up`}
                              title="Move up"
                              className="btn btn-ghost btn-xs btn-square"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveRow(index, 1)}
                              disabled={!editable || index === rows.length - 1}
                              aria-label={`Move ${label} down`}
                              title="Move down"
                              className="btn btn-ghost btn-xs btn-square"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRow(row)}
                              disabled={!editable}
                              aria-label={`Delete ${label}`}
                              title="Delete"
                              className="btn btn-ghost btn-xs btn-square text-error"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {canEdit && (
          <div className="p-3 border-t border-base-300">
            <button
              type="button"
              onClick={addRow}
              disabled={busy || rows.length >= MAX_CRITERIA}
              title={rows.length >= MAX_CRITERIA ? `At most ${MAX_CRITERIA} criteria` : undefined}
              className="btn btn-outline btn-sm gap-1"
            >
              <Plus className="h-4 w-4" /> Add Criteria
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
