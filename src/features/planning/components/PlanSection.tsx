import { memo, useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import { ChevronDown, ChevronRight, Save } from 'lucide-react';
import InlineSpinner from '@/components/ui/InlineSpinner';
import DeptPlanSection from '@/features/planning/components/DeptPlanSection';
import { createDeptPlanLogic } from '@/features/planning/lib/dept-plan-logic';
import { ydKnitPlan, type Loose } from '@/features/planning/lib/order-plan-logic';
import { deptMetaOf, type OrderPageAction, type SectionDef } from '@/features/planning/lib/order-page-model';

/*
 * One plan section of the universal order page: a strip (title, pills, Order Status, Discard, Save, Hide/Unhide)
 * above today's table card (DeptPlanSection). Everything outside the card is marked data-c2-chrome.
 * Memoised: props are primitives or stable references, so editing one section re-renders only that section
 * (Delivery Floor and Lock share their rows, so both re-render on a delivery edit).
 */

export const ORDER_STATUSES = ['On Process', 'Pending', 'Tentative', 'Confirm', 'Completed'];

const NO_KNIT_PLAN = { start: '', end: '' };

const PILL = 'px-1.5 py-0.5 rounded-full text-[10px] font-bold border';
const PILL_ITEMS = `${PILL} bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40`;
const PILL_UNSAVED = `${PILL} bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800`;
const PILL_VIEW_ONLY = `${PILL} bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-transparent`;
const PILL_NOT_LATEST = `${PILL} bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800`;

const STRIP_BTN =
  'px-3 py-1 border border-gray-300 dark:border-[#2a3346] text-[11px] font-bold rounded hover:bg-gray-200 dark:hover:bg-[#283347] text-gray-700 dark:text-gray-300 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const SAVE_BTN =
  'px-3 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

export interface PlanSectionProps {
  def: SectionDef;
  orderNo: string;
  order: Loose;
  /** The saved plan (cross-department inputs, plan D1). */
  planData: Loose;
  rows: Loose[];
  status: string;
  /** Today's in-row admin flag (Admin or Approver), used by the locks and checks exactly as before. */
  isAdmin: boolean;
  /** The user may edit this section (plan D4 and D8). */
  editable: boolean;
  /** Tooltip of a view-only section. */
  readOnlyTitle: string | null;
  /** D8: an added section of a department without rows: Order Status and Save are off. */
  noItems: boolean;
  notInLatest: boolean;
  dirty: boolean;
  hidden: boolean;
  /** Highlighted after a failed Save Data check. */
  ring: boolean;
  loading: boolean;
  unitOptions: string[];
  processOptions: string[];
  /** A save is running (every Save is disabled). */
  saving: boolean;
  /** This section is part of the running save. */
  spinning: boolean;
  dispatch: Dispatch<OrderPageAction>;
  showToast: (message: string, type?: 'error' | 'success') => void;
  onSave: (key: string) => void;
  onDiscard: (key: string) => void;
  onToggleHidden: (key: string) => void;
  onBack: () => void;
}

function PlanSection({
  def,
  orderNo,
  order,
  planData,
  rows,
  status,
  isAdmin,
  editable,
  readOnlyTitle,
  noItems,
  notInLatest,
  dirty,
  hidden,
  ring,
  loading,
  unitOptions,
  processOptions,
  saving,
  spinning,
  dispatch,
  showToast,
  onSave,
  onDiscard,
  onToggleHidden,
  onBack,
}: PlanSectionProps) {
  const { key, dept } = def;
  const meta = deptMetaOf(dept);

  const setPlanItems = useCallback(
    (update: SetStateAction<Loose[]>) => dispatch({ type: 'rows', dept, update }),
    [dispatch, dept]
  );
  const setOrderStatus = useCallback(
    (update: SetStateAction<string>) => dispatch({ type: 'status', dept, update }),
    [dispatch, dept]
  );

  // Today's handlers and checks, built from this section's draft and the SAVED plan.
  const logic = useMemo(
    () =>
      createDeptPlanLogic({
        dept,
        orderNo,
        order,
        planData,
        planItems: rows,
        setPlanItems,
        orderStatus: status,
        setOrderStatus,
        isAdmin,
        showToast,
      }),
    [dept, orderNo, order, planData, rows, setPlanItems, status, setOrderStatus, isAdmin, showToast]
  );

  const ydBKnitPlan = useMemo(() => (dept === 'yd' ? ydKnitPlan(planData, order) : NO_KNIT_PLAN), [dept, planData, order]);

  const handleSave = useCallback(() => onSave(key), [onSave, key]);
  const statusDisabled = !editable || noItems;
  const notInLatestNote = `This order is not in the latest ${meta.label} file, so it is not listed on the ${meta.label} Plan page.`;
  const itemCount = `${rows.length} ${rows.length === 1 ? 'item' : 'items'}`;

  return (
    <section
      data-plan-section={key}
      data-route-section={def.isRoute ? '' : undefined}
      aria-label={def.title}
      className={`flex flex-col gap-1 rounded-sm scroll-mt-4 ${ring ? 'ring-2 ring-rose-300 dark:ring-rose-800' : ''}`}
    >
      <div
        data-c2-chrome
        className="bg-gray-100 dark:bg-[#1f2637] border border-gray-200 dark:border-[#2a3346] rounded-sm shadow-sm px-3 py-2 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs"
      >
        <div className="flex items-center flex-wrap gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => onToggleHidden(key)}
            aria-expanded={!hidden}
            className="flex items-center gap-1 font-bold text-gray-800 dark:text-gray-200 cursor-pointer"
          >
            {hidden ? <ChevronRight className="h-4 w-4 opacity-60" /> : <ChevronDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
            <span>{def.title}</span>
          </button>
          <span data-pill="items" className={PILL_ITEMS}>
            {itemCount}
          </span>
          {dirty && (
            <span data-pill="unsaved" className={PILL_UNSAVED}>
              Unsaved
            </span>
          )}
          {!editable && (
            <span data-pill="view-only" className={PILL_VIEW_ONLY} title={readOnlyTitle || undefined}>
              View only
            </span>
          )}
          {notInLatest && (
            <span data-pill="not-in-latest" className={PILL_NOT_LATEST} title={notInLatestNote}>
              Not in latest file
            </span>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-2 justify-end">
          {def.hasStatus && (
            <label className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Order Status</span>
              <select
                data-field="orderStatus"
                value={status}
                disabled={statusDisabled}
                title={!editable ? readOnlyTitle || undefined : undefined}
                onChange={(e) => setOrderStatus(e.target.value)}
                className="px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-white dark:bg-[#151921] text-[11px] font-bold text-gray-800 dark:text-gray-100 outline-none cursor-pointer focus:border-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          )}
          {editable && (
            <>
              <button
                type="button"
                data-action="discard"
                onClick={() => onDiscard(key)}
                disabled={!dirty || saving}
                className={STRIP_BTN}
              >
                Discard
              </button>
              <button
                type="button"
                data-action="save-section"
                onClick={handleSave}
                disabled={saving || noItems}
                className={SAVE_BTN}
              >
                {spinning ? <InlineSpinner size={12} /> : <Save className="h-3 w-3" />}
                {def.saveLabel}
              </button>
            </>
          )}
          <button type="button" data-action="toggle-section" onClick={() => onToggleHidden(key)} className={STRIP_BTN}>
            {hidden ? 'Unhide' : 'Hide'}
          </button>
        </div>
      </div>

      {(notInLatest || noItems) && (
        <div data-c2-chrome className="flex flex-col gap-1">
          {notInLatest && (
            <p
              data-note="not-in-latest"
              className="px-3 py-1.5 rounded-sm text-[11px] bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
            >
              {notInLatestNote}
            </p>
          )}
          {noItems && (
            <p
              data-note="no-items"
              className="px-3 py-1.5 rounded-sm text-[11px] bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
            >
              This order has no {meta.label} items.
            </p>
          )}
        </div>
      )}

      {!hidden && (
        <fieldset
          disabled={!editable}
          title={!editable ? readOnlyTitle || undefined : undefined}
          className="min-w-0 m-0 p-0 border-0 [&_:is(input,select,textarea):disabled]:opacity-60 [&_:is(input,select,textarea):disabled]:cursor-not-allowed"
        >
          <DeptPlanSection
            dept={dept}
            deptMeta={meta}
            orderNo={orderNo}
            order={order}
            planItems={rows}
            loading={loading}
            isAdmin={isAdmin}
            unitOptions={unitOptions}
            processOptions={processOptions}
            ydBKnitPlan={ydBKnitPlan}
            saving={saving}
            spinning={spinning}
            onBack={onBack}
            onSave={handleSave}
            logic={logic}
            columns={def.columns}
            readOnly={!editable}
            showFooterActions={def.isRoute}
          />
        </fieldset>
      )}
    </section>
  );
}

export default memo(PlanSection);
