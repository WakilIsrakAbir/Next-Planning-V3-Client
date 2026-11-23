import { memo } from 'react';
import { findUpstreamPlans, formatDateDisplay, formatExcelDate, withCurrentOption, type Loose } from '@/features/planning/lib/order-plan-logic';
import type { DeptPlanLogic } from '@/features/planning/lib/dept-plan-logic';
import { dayDiff, yarnToKnitStart } from '@/features/planning/order-page/lib/plan-extras';

// Port of the old `.resizable-table-input` CSS (index.html): one-row textarea that resizes both ways.
const RESIZABLE_INPUT_CLS =
  'resize min-w-[90px] min-h-[26px] h-[26px] leading-[1.25] align-middle box-border overflow-auto dark:bg-[#151921] dark:border-[#2a3346] dark:text-[#cbd5e1]';

export type RowHandlers = Pick<
  DeptPlanLogic,
  | 'handleYarnDateChange'
  | 'handleStartDateChange'
  | 'handleEndDateChange'
  | 'handlePlanTypeChange'
  | 'handleUnitProcessChange'
  | 'handleFloorChange'
  | 'handleYarnOkDateChange'
  | 'handleMatchingOptionDateChange'
  | 'handleCustomQtyChange'
  | 'handleTextChange'
>;

interface DeptPlanRowProps {
  item: Loose;
  idx: number;
  dept: string;
  orderNo: string;
  order: Loose;
  /** The saved plan: the upstream Knitting / Dyeing rows of this row. */
  planData: Loose;
  isAdmin: boolean;
  unitOptions: string[];
  processOptions: string[];
  ydBKnitPlan: { start: string; end: string };
  showFloor: boolean;
  showLock: boolean;
  /** A view-only section: no per-cell tooltips, so the section's "View only" reason shows instead. */
  readOnly: boolean;
  handlers: RowHandlers;
  onExtraChange: (index: number, field: string, value: string) => void;
}

// The delivery fields one of the two delivery tables does not show (the Floor table hides the Lock fields and the
// Lock table the Floor fields): a change of only those fields leaves that table's row as it is.
const LOCK_ONLY_FIELDS = ['startDate', 'endDate', 'planType', 'limitation', 'remarks'];
const FLOOR_ONLY_FIELDS = ['floorStartDate', 'floorEndDate', 'floorPlanType'];

function sameRowProps(prev: DeptPlanRowProps, next: DeptPlanRowProps): boolean {
  for (const key of Object.keys(next) as Array<keyof DeptPlanRowProps>) {
    if (key !== 'item' && prev[key] !== next[key]) return false;
  }
  if (prev.item === next.item) return true;
  if (next.dept !== 'delivery' || next.showFloor === next.showLock) return false;
  const hidden = next.showFloor ? LOCK_ONLY_FIELDS : FLOOR_ONLY_FIELDS;
  const keys = new Set([...Object.keys(prev.item || {}), ...Object.keys(next.item || {})]);
  for (const key of keys) {
    if (!hidden.includes(key) && prev.item?.[key] !== next.item?.[key]) return false;
  }
  return true;
}

// One item row of the table (memoised: typing in one row renders that row only).
const DeptPlanRow = memo(function DeptPlanRow({
  item,
  idx,
  dept,
  orderNo,
  order,
  planData,
  isAdmin,
  unitOptions,
  processOptions,
  ydBKnitPlan,
  showFloor,
  showLock,
  readOnly,
  handlers,
  onExtraChange,
}: DeptPlanRowProps) {
  const {
    handleYarnDateChange,
    handleStartDateChange,
    handleEndDateChange,
    handlePlanTypeChange,
    handleUnitProcessChange,
    handleFloorChange,
    handleYarnOkDateChange,
    handleMatchingOptionDateChange,
    handleCustomQtyChange,
    handleTextChange,
  } = handlers;
  const { knitItem, dyeItem, isKnitTypeSelected, isDyeTypeSelected } = findUpstreamPlans(planData, item);

  // Gating checks matching Exp detailed-view.js:
  const isUnitProcessReady =
    dept !== 'dyeing' ||
    (Boolean(item.unit) && item.unit !== 'Select' && Boolean(item.processName) && item.processName !== 'Select');

  // Old HEAD: Dyeing / Delivery stay editable for Admin/Approver, or when this row already has a saved plan,
  // even if the upstream (Knitting / Dyeing) plan type is blank.
  const isDyeAllowed = isAdmin || isKnitTypeSelected || Boolean(item.hasExistingPlan);
  const isDeliveryAllowed = isAdmin || isDyeTypeSelected || Boolean(item.hasExistingPlan);
  const isDyeKnitLocked = dept === 'dyeing' && !isDyeAllowed;
  const isDeliDyeLocked = dept === 'delivery' && !isDeliveryAllowed;
  // Old detailed-view.js: Delivery Start / End / Plan Type stay locked while the Dyeing start date is blank.
  const deliDyeStart = String(dyeItem?.startDate || dyeItem?.planStart || '').trim();
  const isDeliDyeStartMissing = dept === 'delivery' && (!deliDyeStart || deliDyeStart === '-');
  const isSavedConfirmed = item.planType === 'Confirm';
  const isNonAdminLocked = isSavedConfirmed && !isAdmin;

  const isDyeInputsDisabled = !isUnitProcessReady || isDyeKnitLocked || isNonAdminLocked;
  const isDeliInputsDisabled = isDeliDyeLocked || isNonAdminLocked || isDeliDyeStartMissing;
  // Delivery floor inputs only follow the Dyeing-plan gate (old app never locked them for Confirm).
  const isDeliFloorDisabled = isDeliDyeLocked;
  const isInputsDisabled =
    dept === 'dyeing'
      ? isDyeInputsDisabled
      : dept === 'delivery'
      ? isDeliInputsDisabled
      : isNonAdminLocked;

  const inputDisabledClass = isInputsDisabled
    ? 'bg-gray-100 dark:bg-gray-800/60 opacity-60 cursor-not-allowed text-gray-400'
    : 'bg-white dark:bg-[#151921]';
  const floorDisabledClass = isDeliFloorDisabled
    ? 'bg-gray-100 dark:bg-gray-800/60 opacity-60 cursor-not-allowed text-gray-400'
    : 'bg-blue-50/70 dark:bg-blue-950/20';

  // A view-only section shows no cell tooltip (the lock reasons and the Row 1 auto-fill hint): the section's
  // "View only" reason on its fieldset applies to every cell.
  const disabledTitle = readOnly
    ? undefined
    : dept === 'dyeing' && isDyeKnitLocked
      ? 'Knitting Plan type selection is mandatory to input Dyeing plan'
      : dept === 'dyeing' && !isUnitProcessReady
      ? 'Unit & Process Name must be selected before planning'
      : dept === 'delivery' && isDeliDyeLocked
      ? 'Dyeing Plan type selection is mandatory to input Delivery plan'
      : isNonAdminLocked
      ? 'Only Admin can modify Confirmed plan'
      : dept === 'delivery' && isDeliDyeStartMissing
      ? 'Dyeing plan is missing for this item'
      : undefined;
  const floorDisabledTitle = isDeliFloorDisabled && !readOnly
    ? 'Dyeing Plan type selection is mandatory to input Delivery plan'
    : undefined;

  return (
    <tr
      data-row={idx}
      className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 border-b border-gray-200 dark:border-[#2a3346] transition-colors"
    >
      {/* ==========================================================
          1. KNITTING ROWS
         ========================================================== */}
      {dept === 'knitting' && (
        <>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-bold text-gray-800 dark:text-gray-100">
            {item.itemData?.Color || item.Color || '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[100px]">
            {item.itemData?.FabricConstruction || item.FabricConstruction || '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[60px] font-mono">
            {item.itemData?.GSM || item.GSM || '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-yellow-50 dark:bg-yellow-900/10">
            <input
              data-field="yarnDate"
              type="date"
              value={item.yarnDate || ''}
              onChange={(e) => handleYarnDateChange(idx, e.target.value)}
              title={idx === 0 && !readOnly ? '⚡ Changing Row 1 Yarn Date auto-fills all items' : undefined}
              className="row-yarn-date p-1 border border-yellow-300 dark:border-yellow-700/50 rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-yellow-50/70 dark:bg-[#151921] text-yellow-950 dark:text-yellow-100 font-semibold"
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
            <input
              data-field="actualYarnDate"
              type="date"
              value={item.actualYarnDate || ''}
              onChange={(e) => onExtraChange(idx, 'actualYarnDate', e.target.value)}
              className="row-actualYarnDate p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
            <input
              data-field="startDate"
              type="date"
              value={item.startDate || ''}
              min={item.yarnDate || undefined}
              disabled={isInputsDisabled}
              title={disabledTitle}
              onChange={(e) => handleStartDateChange(idx, e.target.value)}
              className={`row-start-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none ${inputDisabledClass}`}
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
            <input
              data-field="endDate"
              type="date"
              value={item.endDate || ''}
              min={item.startDate || item.yarnDate || undefined}
              disabled={isInputsDisabled}
              title={disabledTitle}
              onChange={(e) => handleEndDateChange(idx, e.target.value)}
              className={`row-end-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none ${inputDisabledClass}`}
            />
          </td>
          <td data-day="yks" className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono min-w-[60px]">
            {yarnToKnitStart(item)}
          </td>
          <td data-day="kske" className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono min-w-[60px]">
            {dayDiff(item.startDate, item.endDate)}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
            <select
              data-field="planType"
              value={item.planType || ''}
              disabled={isInputsDisabled}
              title={disabledTitle}
              onChange={(e) => handlePlanTypeChange(idx, e.target.value)}
              className={`row-plan-type p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none cursor-pointer font-bold ${inputDisabledClass}`}
            >
              <option value="">Select</option>
              <option value="Confirm">Confirm</option>
              <option value="Tentative">Tentative</option>
            </select>
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
            <textarea
              data-field="limitation"
              rows={1}
              value={item.limitation || ''}
              onChange={(e) => handleTextChange(idx, 'limitation', e.target.value)}
              placeholder="Limitation"
              className={`row-limitation ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
            <textarea
              data-field="remarks"
              rows={1}
              value={item.remarks || ''}
              onChange={(e) => handleTextChange(idx, 'remarks', e.target.value)}
              placeholder="Notes"
              className={`row-remarks ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.GreyReq ?? item.GreyReq ?? '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.KnitProd ?? item.KnitProd ?? 0}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono text-orange-600 font-bold">
            {item.itemData?.KnitBala ?? item.KnitBala ?? '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.YarnReq ?? item.YarnReq ?? '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.AllocatedQty ?? item.AllocatedQty ?? '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.YarnBala ?? item.YarnBala ?? '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.Allowance ?? item.Allowance ?? '—'}
          </td>
        </>
      )}

      {/* ==========================================================
          2. DYEING ROWS
         ========================================================== */}
      {dept === 'dyeing' && (
        <>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-bold text-gray-800 dark:text-gray-100">
            {item.itemData?.Color || item.Color || '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
            <select
              data-field="unit"
              value={item.unit || ''}
              onChange={(e) => handleUnitProcessChange(idx, 'unit', e.target.value)}
              className="row-unit p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-full focus:border-blue-500 outline-none cursor-pointer bg-white dark:bg-[#151921]"
            >
              <option value="">Select</option>
              {withCurrentOption(unitOptions, item.unit).map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[110px]">
            {/* US-12: a select of the Dropdown Master Setup Dyeing Processes; a stored value not in the list stays an option. */}
            <select
              data-field="processName"
              value={item.processName || ''}
              onChange={(e) => handleUnitProcessChange(idx, 'processName', e.target.value)}
              className="row-process p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-full focus:border-blue-500 outline-none cursor-pointer bg-white dark:bg-[#151921]"
            >
              <option value="">Select</option>
              {withCurrentOption(processOptions, item.processName).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
            {formatDateDisplay(knitItem?.startDate || knitItem?.planStart)}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
            {formatDateDisplay(knitItem?.endDate || knitItem?.planEnd)}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px] font-semibold">
            {knitItem?.planType || '-'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
            <input
              data-field="ldPlanDate"
              type="date"
              value={item.ldPlanDate || ''}
              onChange={(e) => onExtraChange(idx, 'ldPlanDate', e.target.value)}
              className="row-ldPlanDate p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
            <input
              data-field="actualLdDate"
              type="date"
              value={item.actualLdDate || ''}
              onChange={(e) => onExtraChange(idx, 'actualLdDate', e.target.value)}
              className="row-actualLdDate p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
            <input
              data-field="startDate"
              type="date"
              value={item.startDate || ''}
              disabled={isDyeInputsDisabled}
              title={disabledTitle}
              onChange={(e) => handleStartDateChange(idx, e.target.value)}
              className={`row-start-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none ${inputDisabledClass}`}
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
            <input
              data-field="endDate"
              type="date"
              value={item.endDate || ''}
              min={item.startDate || undefined}
              disabled={isDyeInputsDisabled}
              title={disabledTitle}
              onChange={(e) => handleEndDateChange(idx, e.target.value)}
              className={`row-end-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none ${inputDisabledClass}`}
            />
          </td>
          <td data-day="dsde" className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono min-w-[60px]">
            {dayDiff(item.startDate, item.endDate)}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
            <select
              data-field="planType"
              value={item.planType || ''}
              disabled={isDyeInputsDisabled}
              title={disabledTitle}
              onChange={(e) => handlePlanTypeChange(idx, e.target.value)}
              className={`row-plan-type p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none cursor-pointer font-bold ${inputDisabledClass}`}
            >
              <option value="">Select</option>
              <option value="Confirm">Confirm</option>
              <option value="Tentative">Tentative</option>
            </select>
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
            <textarea
              data-field="limitation"
              rows={1}
              value={item.limitation || ''}
              disabled={!isUnitProcessReady}
              onChange={(e) => handleTextChange(idx, 'limitation', e.target.value)}
              placeholder="Limitation"
              className={`row-limitation ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none ${
                !isUnitProcessReady ? 'bg-gray-100 opacity-60 cursor-not-allowed' : 'bg-white'
              }`}
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
            <textarea
              data-field="remarks"
              rows={1}
              value={item.remarks || ''}
              disabled={!isUnitProcessReady}
              onChange={(e) => handleTextChange(idx, 'remarks', e.target.value)}
              placeholder="Notes"
              className={`row-remarks ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none ${
                !isUnitProcessReady ? 'bg-gray-100 opacity-60 cursor-not-allowed' : 'bg-white'
              }`}
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.BPQty ?? item.BPQty ?? '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.DyeingProd ?? item.DyeingProd ?? 0}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono text-orange-600 font-bold">
            {item.itemData?.DyeingBala ?? item.DyeingBala ?? '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.KnitProd ?? item.KnitProd ?? 0}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.KnitBala ?? item.KnitBala ?? '—'}
          </td>
        </>
      )}

      {/* ==========================================================
          3. YD (YARN DYEING) ROWS (Exact Exp Parity)
         ========================================================== */}
      {dept === 'yd' && (
        <>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px] font-semibold">
            {item.itemData?.['Booking Type'] || item['Booking Type'] || '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px] font-mono">
            {item.itemData?.YDB || item.YDB || '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[95px]">
            {formatExcelDate(item.itemData?.['YD Booking Date'] || item['YD Booking Date'])}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
            <input
              data-field="startDate"
              type="date"
              value={item.startDate || ''}
              onChange={(e) => handleStartDateChange(idx, e.target.value)}
              className="row-start-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
            <input
              data-field="endDate"
              type="date"
              value={item.endDate || ''}
              min={item.startDate || undefined}
              onChange={(e) => handleEndDateChange(idx, e.target.value)}
              className="row-end-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
            <select
              data-field="planType"
              value={item.planType || ''}
              onChange={(e) => handlePlanTypeChange(idx, e.target.value)}
              className="row-plan-type p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none cursor-pointer bg-white dark:bg-[#151921]"
            >
              <option value="">Select</option>
              <option value="Confirm">Confirm</option>
              <option value="Tentative">Tentative</option>
            </select>
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[100px]">
            <textarea
              data-field="limitation"
              rows={1}
              placeholder="Limitation"
              value={item.limitation || ''}
              onChange={(e) => handleTextChange(idx, 'limitation', e.target.value)}
              className={`row-limitation ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[100px]">
            <textarea
              data-field="remarks"
              rows={1}
              placeholder="Remarks"
              value={item.remarks || ''}
              onChange={(e) => handleTextChange(idx, 'remarks', e.target.value)}
              className={`row-remarks ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
            <input
              data-field="yarnOkDate"
              type="date"
              value={item.yarnOkDate || ''}
              onChange={(e) => handleYarnOkDateChange(idx, e.target.value)}
              className="row-yarn-ok-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[95px]">
            <input
              data-field="matchingOptionDate"
              type="date"
              value={item.matchingOptionDate || ''}
              onChange={(e) => handleMatchingOptionDateChange(idx, e.target.value)}
              className="row-matching-option-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
            <input
              data-field="floorStartDate"
              type="date"
              value={item.floorStartDate || ''}
              onChange={(e) => handleFloorChange(idx, 'floorStartDate', e.target.value)}
              className="row-floor-start p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
            <input
              data-field="floorEndDate"
              type="date"
              value={item.floorEndDate || ''}
              min={item.floorStartDate || undefined}
              onChange={(e) => handleFloorChange(idx, 'floorEndDate', e.target.value)}
              className="row-floor-end p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
            <select
              data-field="floorPlanType"
              value={item.floorPlanType || ''}
              onChange={(e) => handleFloorChange(idx, 'floorPlanType', e.target.value)}
              className="row-floor-plan p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none cursor-pointer bg-white dark:bg-[#151921]"
            >
              <option value="">Select</option>
              <option value="Confirm">Confirm</option>
              <option value="Tentative">Tentative</option>
            </select>
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
            {formatExcelDate(item.itemData?.['YD T&A Start'])}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
            {formatExcelDate(item.itemData?.['YD T&A End'])}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
            {formatExcelDate(ydBKnitPlan.start)}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
            {formatExcelDate(ydBKnitPlan.end)}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
            <input
              data-field="barrierQty"
              type="number"
              value={item.barrierQty !== undefined && item.barrierQty !== null ? item.barrierQty : ''}
              onChange={(e) => handleCustomQtyChange(idx, 'barrierQty', e.target.value)}
              className="row-barrier-qty w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] outline-none text-center bg-white dark:bg-[#151921]"
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
            <input
              data-field="workableQty"
              type="number"
              value={item.workableQty !== undefined && item.workableQty !== null ? item.workableQty : ''}
              onChange={(e) => handleCustomQtyChange(idx, 'workableQty', e.target.value)}
              className="row-workable-qty w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] outline-none text-center bg-white dark:bg-[#151921]"
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.['YD REQ.'] ?? '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.DYED ?? 0}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.['YD BALANCE'] ?? '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.['YD Delivered'] ?? 0}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono text-red-600 font-bold">
            {item.itemData?.['YD DELIVERY BALANCE'] ?? '—'}
          </td>
        </>
      )}

      {/* ==========================================================
          4. DELIVERY ROWS
         ========================================================== */}
      {dept === 'delivery' && (
        <>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-bold text-gray-800 dark:text-gray-100">
            {item.itemData?.Color || item.Color || '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[100px]">
            {item.itemData?.FabricConstruction || item.FabricConstruction || '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[60px] font-mono">
            {item.itemData?.GSM || item.GSM || '—'}
          </td>
          {showFloor && (
            <>
              <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-blue-50/40 dark:bg-transparent">
                <input
                  data-field="floorStartDate"
                  type="date"
                  value={item.floorStartDate || ''}
                  disabled={isDeliFloorDisabled}
                  title={floorDisabledTitle}
                  onChange={(e) => handleFloorChange(idx, 'floorStartDate', e.target.value)}
                  className={`row-floor-start p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[95px] focus:border-blue-500 outline-none ${floorDisabledClass}`}
                />
              </td>
              <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-blue-50/40 dark:bg-transparent">
                <input
                  data-field="floorEndDate"
                  type="date"
                  value={item.floorEndDate || ''}
                  min={item.floorStartDate || undefined}
                  disabled={isDeliFloorDisabled}
                  title={floorDisabledTitle}
                  onChange={(e) => handleFloorChange(idx, 'floorEndDate', e.target.value)}
                  className={`row-floor-end p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[95px] focus:border-blue-500 outline-none ${floorDisabledClass}`}
                />
              </td>
              <td data-day="delsdele" className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono min-w-[60px]">
                {dayDiff(item.floorStartDate, item.floorEndDate)}
              </td>
              <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                <select
                  data-field="floorPlanType"
                  value={item.floorPlanType || ''}
                  disabled={isDeliFloorDisabled}
                  title={floorDisabledTitle}
                  onChange={(e) => handleFloorChange(idx, 'floorPlanType', e.target.value)}
                  className={`row-floor-plan p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none cursor-pointer ${isDeliFloorDisabled ? floorDisabledClass : 'bg-white dark:bg-[#151921]'}`}
                >
                  <option value="">Select</option>
                  <option value="Confirm">Confirm</option>
                  <option value="Tentative">Tentative</option>
                </select>
              </td>
            </>
          )}
          {showLock && (
            <>
              <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                <input
                  data-field="startDate"
                  type="date"
                  value={item.startDate || ''}
                  disabled={isDeliInputsDisabled}
                  title={disabledTitle}
                  onChange={(e) => handleStartDateChange(idx, e.target.value)}
                  className={`row-start-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none ${inputDisabledClass}`}
                />
              </td>
              <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                <input
                  data-field="endDate"
                  type="date"
                  value={item.endDate || ''}
                  min={item.startDate || undefined}
                  disabled={isDeliInputsDisabled}
                  title={disabledTitle}
                  onChange={(e) => handleEndDateChange(idx, e.target.value)}
                  className={`row-end-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none ${inputDisabledClass}`}
                />
              </td>
              <td data-day="lockslocke" className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono min-w-[60px]">
                {dayDiff(item.startDate, item.endDate)}
              </td>
              <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                <select
                  data-field="planType"
                  value={item.planType || ''}
                  disabled={isDeliInputsDisabled}
                  title={disabledTitle}
                  onChange={(e) => handlePlanTypeChange(idx, e.target.value)}
                  className={`row-plan-type p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none cursor-pointer font-bold ${inputDisabledClass}`}
                >
                  <option value="">Select</option>
                  <option value="Confirm">Confirm</option>
                  <option value="Tentative">Tentative</option>
                </select>
              </td>
              <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
                <textarea
                  data-field="limitation"
                  rows={1}
                  value={item.limitation || ''}
                  onChange={(e) => handleTextChange(idx, 'limitation', e.target.value)}
                  placeholder="Limitation"
                  className={`row-limitation ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
                />
              </td>
              <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
                <textarea
                  data-field="remarks"
                  rows={1}
                  value={item.remarks || ''}
                  onChange={(e) => handleTextChange(idx, 'remarks', e.target.value)}
                  placeholder="Notes"
                  className={`row-remarks ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
                />
              </td>
            </>
          )}
          {showFloor && (
            <>
              <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                {formatDateDisplay(dyeItem?.startDate || dyeItem?.planStart)}
              </td>
              <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                {formatDateDisplay(dyeItem?.endDate || dyeItem?.planEnd)}
              </td>
              <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px] font-semibold">
                {dyeItem?.planType || '-'}
              </td>
            </>
          )}
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.RequiredQtyKgs ?? item.RequiredQtyKgs ?? '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.NetReceivedQtyKgs ?? item.NetReceivedQtyKgs ?? 0}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.NetDeliveryQtyKgs ?? item.NetDeliveryQtyKgs ?? 0}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono text-orange-600 font-bold">
            {item.itemData?.DeliBal ?? item.DeliBal ?? '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.RFD ?? item.RFD ?? 0}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.Slowmoving ?? item.Slowmoving ?? 0}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.FFStock ?? item.FFStock ?? 0}
          </td>
        </>
      )}

      {/* ==========================================================
          5. FINISHING & DEFAULT ROWS
         ========================================================== */}
      {dept !== 'knitting' && dept !== 'dyeing' && dept !== 'yd' && dept !== 'delivery' && (
        <>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px] font-mono">
            {item.itemData?.OrderNo ?? item.OrderNo ?? orderNo}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-bold text-gray-800 dark:text-gray-100">
            {item.itemData?.Color || item.Color || '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.RequiredQtyKgs ?? item.RequiredQtyKgs ?? '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
            {item.itemData?.Buyer ?? item.Buyer ?? order.buyer ?? '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
            <select
              data-field="unit"
              value={item.unit || ''}
              onChange={(e) => handleUnitProcessChange(idx, 'unit', e.target.value)}
              className="row-unit p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-full focus:border-blue-500 outline-none cursor-pointer bg-white dark:bg-[#151921]"
            >
              <option value="">Select</option>
              {withCurrentOption(unitOptions, item.unit).map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
            <select
              data-field="processName"
              value={item.processName || ''}
              onChange={(e) => handleUnitProcessChange(idx, 'processName', e.target.value)}
              className="row-process p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-full focus:border-blue-500 outline-none cursor-pointer bg-white dark:bg-[#151921]"
            >
              <option value="">Select</option>
              {withCurrentOption(processOptions, item.processName).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.GreyReq ?? item.GreyReq ?? '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.KnitProd ?? item.KnitProd ?? 0}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.KnitBala ?? item.KnitBala ?? '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.BPQty ?? item.BPQty ?? '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.DyeingProd ?? item.DyeingProd ?? 0}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.DyeingBala ?? item.DyeingBala ?? '—'}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.NetReceivedQtyKgs ?? item.NetReceivedQtyKgs ?? 0}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.NetDeliveryQtyKgs ?? item.NetDeliveryQtyKgs ?? 0}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.RFD ?? item.RFD ?? 0}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.Slowmoving ?? item.Slowmoving ?? 0}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
            {item.itemData?.FFStock ?? item.FFStock ?? 0}
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
            <input
              data-field="startDate"
              type="date"
              value={item.startDate || ''}
              onChange={(e) => handleStartDateChange(idx, e.target.value)}
              className="row-start-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
            <input
              data-field="endDate"
              type="date"
              value={item.endDate || ''}
              min={item.startDate || undefined}
              onChange={(e) => handleEndDateChange(idx, e.target.value)}
              className="row-end-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none bg-white dark:bg-[#151921]"
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
            <select
              data-field="planType"
              value={item.planType || ''}
              onChange={(e) => handlePlanTypeChange(idx, e.target.value)}
              className="row-plan-type p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none cursor-pointer bg-white dark:bg-[#151921]"
            >
              <option value="">Select</option>
              <option value="Confirm">Confirm</option>
              <option value="Tentative">Tentative</option>
            </select>
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
            <textarea
              data-field="limitation"
              rows={1}
              value={item.limitation || ''}
              onChange={(e) => handleTextChange(idx, 'limitation', e.target.value)}
              placeholder="Limitation"
              className={`row-limitation ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
            />
          </td>
          <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
            <textarea
              data-field="remarks"
              rows={1}
              value={item.remarks || ''}
              onChange={(e) => handleTextChange(idx, 'remarks', e.target.value)}
              placeholder="Notes"
              className={`row-remarks ${RESIZABLE_INPUT_CLS} w-full p-1 border border-gray-300 rounded text-[10px] focus:border-blue-500 outline-none bg-white`}
            />
          </td>
        </>
      )}
    </tr>
  );
}, sameRowProps);

export default DeptPlanRow;
