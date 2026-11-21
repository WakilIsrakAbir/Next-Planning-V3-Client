'use client';

/*
 * Checkpoint & Planning Guide card of the order page (SPEC C4): Yes/No for the Plan Check List criteria and the
 * guide dates YD / Knit / Dye / Floor / Lock, saved per order with its own Save Guide (and through the page's
 * Save Data, see `onSaveExtraChange`). Anyone who can open the order page may edit it (D12). It is a guide only:
 * it never changes plan rows, the Order's T&A fields or any validation (D13). State: usePlanningGuide.
 */

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  RefreshCw,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';
import InlineSpinner from '@/components/ui/InlineSpinner';
import { cn } from '@/lib/cn';
import type { PlanGuide } from '@/features/planning/lib/plan-guide-api';
import {
  usePlanningGuide,
  type GuideCriterion,
  type GuideOrder,
  type GuideRowView,
  type PlanningGuide,
  type SaveExtra,
} from '@/features/planning/lib/use-planning-guide';

export interface PlanningGuideCardProps {
  orderNo: string;
  /** The order from the FULL detail answer (its T&A values); null while that answer is loading. */
  order: GuideOrder | null;
  /** The `guide` of the same detail answer (null before the first save). */
  guide: PlanGuide | null | undefined;
  /**
   * Receives the guide's Save Data step `{key: 'guide', label: 'Planning Guide', isDirty, save}` whenever it changes
   * (it changes when isDirty does), and null when the card goes away.
   */
  onSaveExtraChange?: (extra: SaveExtra | null) => void;
  /** Called with the guide as the server stored it, after a save and after Reload. */
  onGuideChange?: (guide: PlanGuide) => void;
}

// Hide / Show of the card, remembered in this browser.
const HIDDEN_KEY = 'planningGuideCard.hidden';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TOAST_MS = 3800;

// Same look as the order page's other controls (OrderPlanningScreen.tsx).
const LABEL_CLS = 'w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate';
const SELECT_CLS =
  'flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-white dark:bg-[#151921] text-[11px] font-bold text-gray-800 dark:text-gray-100 outline-none cursor-pointer focus:border-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed';
const DATE_CLS =
  'p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[110px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]';
const HEADING_CLS =
  'p-1 bg-gray-100 dark:bg-[#1f2637] text-center font-bold text-xs border border-gray-200 dark:border-[#2a3346] text-gray-700 dark:text-gray-300';
const CELL_CLS = 'p-2 border-r border-gray-300 dark:border-[#2a3346]';
const EMERALD_PILL =
  'px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 text-[10px] font-bold';
const AMBER_PILL =
  'px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[10px] font-bold';
const GRAY_PILL =
  'px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-[#283347] text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-[#2a3346] text-[9px] font-bold uppercase';

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

function writeHidden(hidden: boolean): void {
  try {
    if (hidden) localStorage.setItem(HIDDEN_KEY, '1');
    else localStorage.removeItem(HIDDEN_KEY);
  } catch {
    /* ignore */
  }
}

/** 'YYYY-MM-DD' as '12-Oct-2026' (split, never `new Date(text)`); '—' when blank. */
function isoToDisplay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return '—';
  return `${match[3]}-${MONTHS[Number(match[2]) - 1] ?? match[2]}-${match[1]}`;
}

/** Bangladesh time (UTC+6, no daylight saving), as the server words it: 21-Nov-2026 14:05. */
function formatDhakaDateTime(iso: string): string {
  if (!iso) return '';
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '';
  const dhaka = new Date(time + 6 * 60 * 60 * 1000);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(dhaka.getUTCDate())}-${MONTHS[dhaka.getUTCMonth()]}-${dhaka.getUTCFullYear()} ${two(dhaka.getUTCHours())}:${two(dhaka.getUTCMinutes())}`;
}

function savedText(stored: PlanGuide | null): string {
  if (!stored) return 'Not saved yet';
  const when = formatDhakaDateTime(stored.updatedAt);
  return `Saved by ${stored.updatedBy || 'unknown'}${when ? `, ${when}` : ''}`;
}

/** The card, started again for every order number. */
export default function PlanningGuideCard(props: PlanningGuideCardProps) {
  return <GuideCard key={props.orderNo} {...props} />;
}

function GuideCard({ orderNo, order, guide, onSaveExtraChange, onGuideChange }: PlanningGuideCardProps) {
  const g = usePlanningGuide({ orderNo, order, guide, onGuideChange });
  const [hidden, setHidden] = useState(readHidden);
  const [toast, setToast] = useState('');
  const bodyId = useId();

  // The page gets the guide's Save Data step whenever it changes, and null when the card goes away.
  const reportExtra = useRef(onSaveExtraChange);
  useLayoutEffect(() => {
    reportExtra.current = onSaveExtraChange;
  });
  useEffect(() => {
    reportExtra.current?.(g.extra);
  }, [g.extra]);
  useEffect(() => () => reportExtra.current?.(null), []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const busy = g.saving || g.reloading;

  const toggleHidden = () => {
    const next = !hidden;
    setHidden(next);
    writeHidden(next);
  };

  // A failed save shows its message on the card (g.notice).
  const saveGuide = () => {
    setToast('');
    g.save().then(
      () => setToast(`Planning Guide saved for Order #${orderNo}.`),
      () => undefined
    );
  };

  const discard = () => {
    if (window.confirm('Discard your unsaved Planning Guide changes?')) g.discard();
  };

  const reload = () => {
    if (g.dirty && !window.confirm('Discard your unsaved Planning Guide changes and load the latest Planning Guide?')) return;
    void g.reload();
  };

  return (
    <section
      data-planning-guide=""
      aria-label="Checkpoint & Planning Guide"
      className="bg-white dark:bg-[#151921] border border-gray-200 dark:border-[#2a3346] rounded-sm shadow-sm overflow-hidden flex flex-col"
    >
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div className="alert alert-success shadow-lg text-xs font-bold py-2.5 px-4 rounded border">
            <CheckCircle2 className="h-4 w-4" />
            <span>{toast}</span>
          </div>
        </div>
      )}

      {/* Strip */}
      <div className="bg-gray-100 dark:bg-[#1f2637] p-2 font-bold text-gray-800 dark:text-gray-200 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-[#2a3346]">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={toggleHidden}
            aria-expanded={!hidden}
            aria-controls={bodyId}
            title={hidden ? 'Show the Planning Guide' : 'Hide the Planning Guide'}
            className="text-gray-500 dark:text-gray-400 hover:text-blue-600 transition p-0.5 cursor-pointer"
          >
            {hidden ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <ClipboardCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>Checkpoint &amp; Planning Guide</span>
          <span className={EMERALD_PILL} data-testid="guide-yes-count">
            {g.yesIds.length} Yes
          </span>
          {g.dirty && <span className={AMBER_PILL}>Unsaved</span>}
          <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400" data-testid="guide-saved-by">
            {savedText(g.stored)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {g.dirty && (
            <button type="button" onClick={discard} disabled={busy} className="btn btn-ghost btn-xs font-semibold gap-1">
              <RotateCcw className="h-3 w-3" /> Discard
            </button>
          )}
          <button
            type="button"
            data-action="save-guide"
            onClick={saveGuide}
            disabled={!g.ready || busy}
            className="btn btn-primary btn-xs font-bold gap-1.5 shadow-sm"
          >
            {g.saving ? <InlineSpinner size={12} /> : <Save className="h-3 w-3" />}
            Save Guide
          </button>
        </div>
      </div>

      {!hidden && (
        <div id={bodyId} className="p-3 md:p-4 flex flex-col gap-3">
          {g.notice && (
            <div
              role="alert"
              className={cn(
                'alert text-xs font-semibold py-2 flex flex-wrap items-center gap-2 rounded-sm',
                g.notice.kind === 'conflict' ? 'alert-warning' : 'alert-error'
              )}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1 min-w-0">{g.notice.text}</span>
              {g.notice.kind === 'conflict' && (
                <button type="button" onClick={reload} disabled={busy} className="btn btn-xs gap-1">
                  {g.reloading ? <InlineSpinner size={12} /> : <RefreshCw className="h-3 w-3" />} Reload
                </button>
              )}
              <button type="button" onClick={g.dismissNotice} className="btn btn-ghost btn-xs btn-square" aria-label="Close message">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {!g.ready ? (
            <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
              <InlineSpinner size={14} className="text-emerald-500" />
              Loading the order&apos;s T&amp;A dates…
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4">
              <Checkpoints g={g} />
              <GuideDates g={g} />
            </div>
          )}

          <p className="text-[10px] text-gray-500 dark:text-gray-400 italic">
            Guide only: it does not change the Knitting plan, its validations or the T&amp;A dates.
          </p>
        </div>
      )}
    </section>
  );
}

function Checkpoints({ g }: { g: PlanningGuide }) {
  let content: React.ReactNode;
  if (g.list) {
    content =
      g.criteria.length === 0 ? (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">The Plan Check List has no active criteria.</p>
      ) : (
        // Two columns while the criteria sit above the dates; one column beside them (xl), so each select stays wide.
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-x-6 gap-y-2">
          {g.criteria.map((criterion) => (
            <CriterionRow key={criterion.id} g={g} criterion={criterion} />
          ))}
        </div>
      );
  } else if (g.listError) {
    content = (
      <div role="alert" className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-red-600 dark:text-red-400">
        <span>{g.listError}</span>
        <button type="button" onClick={g.retryList} disabled={g.retryingList} className="btn btn-xs gap-1">
          {g.retryingList ? <InlineSpinner size={12} /> : <RefreshCw className="h-3 w-3" />} Retry
        </button>
      </div>
    );
  } else {
    content = (
      <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
        <InlineSpinner size={14} className="text-emerald-500" />
        Loading the Plan Check List…
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className={HEADING_CLS}>Checkpoints</div>
      {content}
    </div>
  );
}

function CriterionRow({ g, criterion }: { g: PlanningGuide; criterion: GuideCriterion }) {
  const days = `+${criterion.startDays}/+${criterion.endDays}`;
  const badgeTitle =
    criterion.status === 'inactive'
      ? 'Inactive in the Plan Check List: it does not add lead time. Set it to No to take it off this order.'
      : 'No longer in the Plan Check List: it does not add lead time. Set it to No to take it off this order.';
  return (
    <div className="flex items-center" data-criterion={criterion.id}>
      <span
        className={LABEL_CLS}
        title={`${criterion.name}: Yes adds up to ${criterion.startDays} days to Knit Start and ${criterion.endDays} days to Knit End`}
      >
        {criterion.name}
      </span>
      <select
        aria-label={`${criterion.name}: Yes or No`}
        value={criterion.yes ? 'Yes' : 'No'}
        onChange={(e) => g.setYes(criterion.id, e.target.value === 'Yes')}
        className={SELECT_CLS}
      >
        <option value="No">No</option>
        <option value="Yes">Yes</option>
      </select>
      {criterion.status !== 'active' && (
        <span className={cn(GRAY_PILL, 'ml-1.5 shrink-0')} title={badgeTitle}>
          {criterion.status === 'inactive' ? 'Inactive' : 'Removed'}
        </span>
      )}
      <span className="ml-1.5 w-[44px] shrink-0 text-right text-[10px] font-mono text-gray-400">{days}</span>
    </div>
  );
}

function GuideDates({ g }: { g: PlanningGuide }) {
  const leadShown = g.lead.startDays > 0 || g.lead.endDays > 0;
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className={HEADING_CLS}>Planning Guide</div>
      {g.noTna && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">No T&amp;A in the General file for this order.</p>
      )}
      <div className="overflow-x-auto custom-scrollbar w-full">
        <table data-guide-table="" className="w-full text-left whitespace-nowrap border-collapse border border-gray-300 dark:border-[#2a3346]">
          <thead className="select-none">
            <tr className="text-[10px] font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-[#1f2637] border-b border-gray-300 dark:border-[#2a3346]">
              <th className={cn(CELL_CLS, 'text-center')}>Guide</th>
              <th className={cn(CELL_CLS, 'text-center')}>Start</th>
              <th className={cn(CELL_CLS, 'text-center')}>End</th>
              <th className="p-2">Source</th>
            </tr>
          </thead>
          <tbody className="text-[10px] bg-white dark:bg-[#151921] text-gray-700 dark:text-gray-300 divide-y divide-gray-200 dark:divide-[#2a3346]">
            {g.rows.map((row) => (
              <tr
                key={row.row}
                data-guide-row={row.row}
                className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 border-b border-gray-200 dark:border-[#2a3346] transition-colors"
              >
                <td className={cn(CELL_CLS, 'text-center font-bold text-gray-800 dark:text-gray-100')}>{row.label}</td>
                <DateCell g={g} row={row} edge="start" />
                <DateCell g={g} row={row} edge="end" />
                <td className="p-2 align-top whitespace-normal min-w-[180px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-gray-500 dark:text-gray-400">{row.source}</span>
                    {row.row === 'knit' && leadShown && (
                      <span className={EMERALD_PILL} title={g.leadTooltip} data-guide-lead="">
                        +{g.lead.startDays}d / +{g.lead.endDays}d Checklist Lead Time
                      </span>
                    )}
                    {row.edited && (
                      <span className={GRAY_PILL} title="Differs from the T&A dates (edited by hand)">
                        Edited
                      </span>
                    )}
                  </div>
                  {row.changed && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300" data-guide-hint={row.row}>
                      <span>
                        T&amp;A / Check List changed since saved: now {isoToDisplay(row.liveStart)} to {isoToDisplay(row.liveEnd)}
                      </span>
                      <button
                        type="button"
                        onClick={() => g.applyRow(row.row)}
                        aria-label={`Apply the new ${row.label} dates`}
                        className="btn btn-xs"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {g.knitStartAfterEnd && (
        <p
          role="status"
          className="flex items-center gap-1.5 px-2 py-1 rounded-sm text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Knit Start ({isoToDisplay(g.dates.knitStart)}) is after Knit End ({isoToDisplay(g.dates.knitEnd)}). Check the Knit
          dates; the guide can still be saved.
        </p>
      )}
    </div>
  );
}

function DateCell({ g, row, edge }: { g: PlanningGuide; row: GuideRowView; edge: 'start' | 'end' }) {
  const key = edge === 'start' ? row.startKey : row.endKey;
  const value = edge === 'start' ? row.start : row.end;
  const raw = edge === 'start' ? row.rawStart : row.rawEnd;
  const name = `${row.label} ${edge === 'start' ? 'Start' : 'End'}`;
  return (
    <td className={cn(CELL_CLS, 'text-center align-top')}>
      <input type="date" aria-label={name} value={value} onChange={(e) => g.setDate(key, e.target.value)} className={DATE_CLS} />
      {raw && (
        <div className="mt-0.5 text-[9px] text-gray-500 dark:text-gray-400 whitespace-normal" title="The T&A value is not a date, so this cell starts blank and gets no lead days">
          T&amp;A: {raw}
        </div>
      )}
    </td>
  );
}
