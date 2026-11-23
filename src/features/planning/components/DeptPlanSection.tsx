import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { Save } from 'lucide-react';
import InlineSpinner from '@/components/ui/InlineSpinner';
import { findUpstreamPlans, formatDateDisplay, formatExcelDate, withCurrentOption, type Loose } from '@/features/planning/lib/order-plan-logic';
import type { DeptPlanLogic } from '@/features/planning/lib/dept-plan-logic';
import { dayDiff, yarnToKnitStart } from '@/features/planning/lib/plan-extras';

// Port of the old `.resizable-table-input` CSS (index.html): one-row textarea that resizes both ways.
const RESIZABLE_INPUT_CLS =
  'resize min-w-[90px] min-h-[26px] h-[26px] leading-[1.25] align-middle box-border overflow-auto dark:bg-[#151921] dark:border-[#2a3346] dark:text-[#cbd5e1]';

interface DeptPlanSectionProps {
  dept: string;
  deptMeta: { name: string; label: string };
  orderNo: string;
  order: Loose;
  /** The saved plan the logic was built with (the rows' upstream Knitting / Dyeing plans). */
  planData: Loose;
  planItems: Loose[];
  loading: boolean;
  isAdmin: boolean;
  unitOptions: string[];
  processOptions: string[];
  ydBKnitPlan: { start: string; end: string };
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
  logic: DeptPlanLogic;
  /** Delivery only: show just the Floor columns or just the Lock columns (the universal page's two delivery tables). */
  columns?: 'floor' | 'lock';
  /** A view-only section: no Row 1 auto-fill cell tooltips. */
  readOnly?: boolean;
  /** Cancel and Save Planning Schedule in the footer (the section of the page's own department). */
  showFooterActions?: boolean;
  /** This section is the one being saved (spinner on its Save). Defaults to `saving`. */
  spinning?: boolean;
  /** The footer Save stores the whole Delivery plan (the delivery page's two tables). */
  footerSavesDept?: boolean;
  /** US-11 extra dates (Actual Yarn Date, LD Plan Date, Actual LD Date): sets one row's field, nothing else. */
  onExtraChange?: (index: number, field: string, value: string) => void;
}

const NO_EXTRA_CHANGE = () => {};

export default function DeptPlanSection({
  dept,
  deptMeta,
  orderNo,
  order,
  planData,
  planItems,
  loading,
  isAdmin,
  unitOptions,
  processOptions,
  ydBKnitPlan,
  saving,
  onBack: handleBack,
  onSave: handleSavePlanning,
  logic,
  columns,
  readOnly = false,
  showFooterActions = true,
  spinning = saving,
  footerSavesDept = false,
  onExtraChange = NO_EXTRA_CHANGE,
}: DeptPlanSectionProps) {
  const showFloor = columns !== 'lock';
  const showLock = columns !== 'floor';
  // Stable row handlers that call the latest logic: a row whose item did not change is not rendered again.
  const logicRef = useRef(logic);
  useLayoutEffect(() => {
    logicRef.current = logic;
  });
  const handlers = useMemo<RowHandlers>(
    () => ({
      handleYarnDateChange: (index, val) => logicRef.current.handleYarnDateChange(index, val),
      handleStartDateChange: (index, val) => logicRef.current.handleStartDateChange(index, val),
      handleEndDateChange: (index, val) => logicRef.current.handleEndDateChange(index, val),
      handlePlanTypeChange: (index, val) => logicRef.current.handlePlanTypeChange(index, val),
      handleUnitProcessChange: (index, field, val) => logicRef.current.handleUnitProcessChange(index, field, val),
      handleFloorChange: (index, field, val) => logicRef.current.handleFloorChange(index, field, val),
      handleYarnOkDateChange: (index, val) => logicRef.current.handleYarnOkDateChange(index, val),
      handleMatchingOptionDateChange: (index, val) => logicRef.current.handleMatchingOptionDateChange(index, val),
      handleCustomQtyChange: (index, field, val) => logicRef.current.handleCustomQtyChange(index, field, val),
      handleTextChange: (index, field, val) => logicRef.current.handleTextChange(index, field, val),
    }),
    []
  );

  return (
    <div className="bg-white dark:bg-[#151921] border border-gray-200 dark:border-[#2a3346] rounded-sm shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto custom-scrollbar w-full bg-white dark:bg-[#151921]">
        <table
          data-plan-table={dept}
          className={`w-full text-left whitespace-nowrap border-collapse ${columns ? 'min-w-[1300px]' : 'min-w-[1600px]'}`}
        >
          <thead className="bg-white dark:bg-[#151921] shadow-sm select-none">
            {/* Main Top Header Row */}
            <tr className="text-[10px] font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-[#1f2637] border-b border-gray-300 dark:border-[#2a3346]">
              {/* 1. KNITTING HEADERS */}
              {dept === 'knitting' && (
                <>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Color
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
                    FabricConstruction
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[60px]">
                    GSM
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[90px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-200 font-bold">
                    Yarn Date
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                    Actual Yarn Date
                  </th>
                  <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                    Knitting Planning
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[60px]">
                    Y-KS
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[60px]">
                    KS-KE
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                    Plan Type
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[120px]">
                    Knitting Limitation
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[120px]">
                    Remarks
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Grey Req.
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Knit Prod.
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px] text-orange-600 font-bold">
                    Knit. Bala.
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Yarn req.
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Allocated Qty
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Yarn bala.
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Allowance %
                  </th>
                </>
              )}

              {/* 2. DYEING HEADERS */}
              {dept === 'dyeing' && (
                <>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Color
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
                    Unit
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[110px]">
                    Process Name
                  </th>
                  <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                    Knitting Planning
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                    Knitting Plan Type
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                    LD Plan Date
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                    Actual LD Date
                  </th>
                  <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                    Dyeing Planning
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[60px]">
                    DS-DE
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                    Plan Type
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[120px]">
                    Dyeing Limitation
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[120px]">
                    Remarks
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    BP Qty
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Dyeing Prod.
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px] text-orange-600 font-bold">
                    Dyeing Bala.
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Knit Prod.
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Knit. Bala.
                  </th>
                </>
              )}

              {/* 3. YD (YARN DYEING) HEADERS (Exact Exp Parity) */}
              {dept === 'yd' && (
                <>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                    Booking Type
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    YDB
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[95px]">
                    YD Booking Date
                  </th>
                  <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                    YD Planning
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Plan Type
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[100px]">
                    YD Remarks
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[100px]">
                    Remarks
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                    Yarn Ok<br />Date
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[95px]">
                    Matching<br />Option Date
                  </th>
                  <th colSpan={3} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                    YD Planning (Floor)
                  </th>
                  <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-100 dark:bg-[#20293a]">
                    T&A YD Plan
                  </th>
                  <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-100 dark:bg-[#20293a]">
                    Knit Plan
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Barrier Qty.
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Workable Qty.
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    YD REQ.
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    DYED
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    YD BALANCE
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    YD Delivered
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[85px] text-red-600 font-bold">
                    YD DELIVERY BALANCE
                  </th>
                </>
              )}

              {/* 4. DELIVERY HEADERS */}
              {dept === 'delivery' && (
                <>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Color
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
                    FabricConstruction
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[60px]">
                    GSM
                  </th>
                  {showFloor && (
                    <>
                      <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                        Delivery Planning (Floor)
                      </th>
                      <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[60px]">
                        DelS-DelE
                      </th>
                      <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                        Plan Type (Floor)
                      </th>
                    </>
                  )}
                  {showLock && (
                    <>
                      <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                        Delivery Planning
                      </th>
                      <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[60px]">
                        LockS-LockE
                      </th>
                      <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                        Plan Type
                      </th>
                      <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[120px]">
                        Delivery Limitation
                      </th>
                      <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[120px]">
                        Remarks
                      </th>
                    </>
                  )}
                  {showFloor && (
                    <>
                      <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                        Dyeing Planning
                      </th>
                      <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                        Dyeing Plan Type
                      </th>
                    </>
                  )}
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    RequiredQtyKgs
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    NetReceivedQtyKgs
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    NetDeliveryQtyKgs
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px] text-orange-600 font-bold">
                    Deli. Bal.
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    RFD
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Slowmoving
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    FF Stock
                  </th>
                </>
              )}

              {/* 5. FINISHING & DEFAULT HEADERS */}
              {dept !== 'knitting' && dept !== 'dyeing' && dept !== 'yd' && dept !== 'delivery' && (
                <>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                    OrderNo
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Color
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    RequiredQtyKgs
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Buyer
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                    Unit
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
                    Process Name
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Grey Req.
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Knit Prod.
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Knit. Bala.
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    BP Qty
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Dyeing Prod.
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Dyeing Bala.
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    NetReceivedQtyKgs
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    NetDeliveryQtyKgs
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    RFD
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    Slowmoving
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                    FF Stock
                  </th>
                  <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                    Finishing Planning
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                    Plan Type
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[120px]">
                    Finishing Limitation
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[120px]">
                    Remarks
                  </th>
                </>
              )}
            </tr>

            {/* Sub-Header Row with Start Date / End Date labels */}
            <tr className="text-[9px] bg-gray-50 dark:bg-[#181f2c] border-b border-gray-300 dark:border-[#2a3346]">
              {dept === 'knitting' && (
                <>
                  <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                    Start Date
                  </th>
                  <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                    End Date
                  </th>
                </>
              )}

              {dept === 'dyeing' && (
                <>
                  <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                    Start Date
                  </th>
                  <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                    End Date
                  </th>
                  <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                    Start Date
                  </th>
                  <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                    End Date
                  </th>
                </>
              )}

              {dept === 'yd' && (
                <>
                  <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                    Start Date
                  </th>
                  <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                    End Date
                  </th>
                  <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                    YD Start
                  </th>
                  <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                    YD End
                  </th>
                  <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                    Plan Type
                  </th>
                  <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                    YD T&A<br />Start
                  </th>
                  <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                    YD T&A<br />End
                  </th>
                  <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                    Knit Start
                  </th>
                  <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                    Knit End
                  </th>
                </>
              )}

              {dept === 'delivery' && (
                <>
                  {showFloor && (
                    <>
                      <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                        Start Date
                      </th>
                      <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                        End Date
                      </th>
                    </>
                  )}
                  {showLock && (
                    <>
                      <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                        Start Date
                      </th>
                      <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                        End Date
                      </th>
                    </>
                  )}
                  {showFloor && (
                    <>
                      <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                        Start Date
                      </th>
                      <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                        End Date
                      </th>
                    </>
                  )}
                </>
              )}

              {dept !== 'knitting' && dept !== 'dyeing' && dept !== 'yd' && dept !== 'delivery' && (
                <>
                  <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                    Start Date
                  </th>
                  <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                    End Date
                  </th>
                </>
              )}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="text-[10px] bg-white dark:bg-[#151921] text-gray-700 dark:text-gray-300 divide-y divide-gray-200 dark:divide-[#2a3346]">
            {loading && planItems.length === 0 ? (
              <tr>
                <td colSpan={30} className="p-12 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <InlineSpinner size={22} className="text-emerald-500" />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                      Loading {deptMeta.name} items & milestones...
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Synchronizing order plan details from database
                    </span>
                  </div>
                </td>
              </tr>
            ) : planItems.length === 0 ? (
              <tr>
                <td colSpan={30} className="p-10 text-center text-gray-400 text-xs">
                  No {deptMeta.name} fabric items found for Order #{orderNo}.
                </td>
              </tr>
            ) : (
              planItems.map((item, idx) => (
                <DeptPlanRow
                  key={item.itemId || idx}
                  item={item}
                  idx={idx}
                  dept={dept}
                  orderNo={orderNo}
                  order={order}
                  planData={planData}
                  isAdmin={isAdmin}
                  unitOptions={unitOptions}
                  processOptions={processOptions}
                  ydBKnitPlan={ydBKnitPlan}
                  showFloor={showFloor}
                  showLock={showLock}
                  readOnly={readOnly}
                  handlers={handlers}
                  onExtraChange={onExtraChange}
                />
              ))
          )}
        </tbody>
        </table>
      </div>

      {/* Footer info & Save trigger */}
      <div className="p-3 bg-gray-50 dark:bg-[#181f2c] border-t border-gray-200 dark:border-[#2a3346] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <span className="text-gray-500 dark:text-gray-400">
          Total <strong className="text-gray-800 dark:text-gray-200">{planItems.length}</strong> fabric items ready for schedule synchronization.
        </span>
        {showFooterActions && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBack}
              className="btn btn-ghost btn-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              data-action="save"
              onClick={handleSavePlanning}
              disabled={saving}
              // Delivery: both tables' footer Save stores the whole Delivery plan, as today's single footer button did
              // (the strips' Save Floor and Save Lock save one group).
              title={footerSavesDept ? 'Saves Delivery Floor and Lock together' : undefined}
              className="btn btn-primary btn-xs font-bold gap-1.5 shadow-sm"
            >
              {spinning ? <InlineSpinner size={12} /> : <Save className="h-3 w-3" />}
              Save Planning Schedule
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type RowHandlers = Pick<
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
