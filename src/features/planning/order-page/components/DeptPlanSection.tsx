import { useLayoutEffect, useMemo, useRef } from 'react';
import { Save } from 'lucide-react';
import InlineSpinner from '@/components/ui/InlineSpinner';
import type { Loose } from '@/features/planning/lib/order-plan-logic';
import type { DeptPlanLogic } from '@/features/planning/lib/dept-plan-logic';
import DeptPlanRow, { type RowHandlers } from './DeptPlanRow';

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
