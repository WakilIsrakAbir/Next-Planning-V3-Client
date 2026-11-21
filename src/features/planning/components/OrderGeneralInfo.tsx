import { memo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatExcelDate, type Loose } from '@/features/planning/lib/order-plan-logic';

/*
 * The order page's General Information card (unchanged), under a strip with Hide/Unhide. Its Order Status select is
 * the Order Status of the page's own department. Memoised: typing in a plan section does not re-render it.
 */

interface OrderGeneralInfoProps {
  order: Loose;
  displayQty: Loose;
  orderStatus: string;
  onStatusChange: (status: string) => void;
  hidden: boolean;
  onToggleHidden: (key: string) => void;
}

function OrderGeneralInfo({ order, displayQty, orderStatus, onStatusChange, hidden, onToggleHidden }: OrderGeneralInfoProps) {
  return (
    <div data-general-info className="flex flex-col gap-1">
      <div
        data-c2-chrome
        className="bg-gray-100 dark:bg-[#1f2637] border border-gray-200 dark:border-[#2a3346] rounded-sm shadow-sm px-3 py-2 flex items-center justify-between gap-2 text-xs"
      >
        <button
          type="button"
          onClick={() => onToggleHidden('general')}
          aria-expanded={!hidden}
          className="flex items-center gap-1 font-bold text-gray-800 dark:text-gray-200 cursor-pointer"
        >
          {hidden ? <ChevronRight className="h-4 w-4 opacity-60" /> : <ChevronDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          <span>General Information</span>
        </button>
        <button
          type="button"
          data-action="toggle-section"
          onClick={() => onToggleHidden('general')}
          className="px-3 py-1 border border-gray-300 dark:border-[#2a3346] text-[11px] font-bold rounded hover:bg-gray-200 dark:hover:bg-[#283347] text-gray-700 dark:text-gray-300 transition cursor-pointer"
        >
          {hidden ? 'Unhide' : 'Hide'}
        </button>
      </div>
      {!hidden && (
        <div className="bg-white dark:bg-[#151921] border border-gray-200 dark:border-[#2a3346] p-3 md:p-4 rounded-sm shadow-sm shrink-0 w-full max-w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-2.5">
            {/* Column 1 */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  EWO No.
                </span>
                <input
                  type="text"
                  readOnly
                  value={order.orderNo || ''}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none font-mono"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Booking No.
                </span>
                <input
                  type="text"
                  readOnly
                  value={order.orderNo || ''}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none font-mono"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Booking Date
                </span>
                <input
                  type="text"
                  readOnly
                  value={formatExcelDate(order.bookingDate)}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Gmt Unit
                </span>
                <input
                  type="text"
                  readOnly
                  value={order.gmtUnit || order.bookingUnit || ''}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none font-semibold"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Floor
                </span>
                <input
                  type="text"
                  readOnly
                  value={order.floor || order.unit || ''}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Final Conf.
                </span>
                <input
                  type="text"
                  readOnly
                  value={order.finalConfirmation || ''}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none font-semibold"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  BP Status
                </span>
                <input
                  type="text"
                  readOnly
                  value={formatExcelDate(order.bpStatus)}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  PMC
                </span>
                <input
                  type="text"
                  readOnly
                  value={order.pmc || ''}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Order Status
                </span>
                <select
                  data-field="orderStatus"
                  value={orderStatus}
                  onChange={(e) => onStatusChange(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-white dark:bg-[#151921] text-[11px] font-bold text-gray-800 dark:text-gray-100 outline-none cursor-pointer focus:border-emerald-500"
                >
                  <option value="On Process">On Process</option>
                  <option value="Pending">Pending</option>
                  <option value="Tentative">Tentative</option>
                  <option value="Confirm">Confirm</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Column 2 */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Buyer
                </span>
                <input
                  type="text"
                  readOnly
                  value={order.buyer || 'N/A'}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] font-bold text-emerald-700 dark:text-emerald-400 outline-none"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Buyer Team
                </span>
                <input
                  type="text"
                  readOnly
                  value={order.buyerTeam || ''}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Booked By
                </span>
                <input
                  type="text"
                  readOnly
                  value={order.bookedBy || order.bookingBy || ''}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Style
                </span>
                <input
                  type="text"
                  readOnly
                  value={order.style || ''}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Order Qty (Kg)
                </span>
                <input
                  type="text"
                  readOnly
                  value={displayQty}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] font-mono font-bold text-gray-800 dark:text-gray-200 outline-none"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Event Day
                </span>
                <input
                  type="text"
                  readOnly
                  value={order.eventDay || ''}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  1st Ship Date
                </span>
                <input
                  type="text"
                  readOnly
                  value={formatExcelDate(order.ship1)}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Last Ship Date
                </span>
                <input
                  type="text"
                  readOnly
                  value={formatExcelDate(order.shipLast)}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Yarn Date
                </span>
                <input
                  type="text"
                  readOnly
                  value={formatExcelDate(order.yarnDate)}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
                />
              </div>
            </div>

            {/* Column 3: Dates & Fabric Notes */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Deli. Start Date
                </span>
                <input
                  type="text"
                  readOnly
                  value={formatExcelDate(order.deliStart)}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Deli. End Date
                </span>
                <input
                  type="text"
                  readOnly
                  value={formatExcelDate(order.deliEnd)}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Knit Start Date
                </span>
                <input
                  type="text"
                  readOnly
                  value={formatExcelDate(order.knitStart)}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Knit End Date
                </span>
                <input
                  type="text"
                  readOnly
                  value={formatExcelDate(order.knitEnd)}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Dye Start Date
                </span>
                <input
                  type="text"
                  readOnly
                  value={formatExcelDate(order.dyeStart)}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
                />
              </div>

              <div className="flex items-center">
                <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                  Dye End Date
                </span>
                <input
                  type="text"
                  readOnly
                  value={formatExcelDate(order.dyeEnd)}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
                />
              </div>

              <div className="p-1 bg-gray-100 dark:bg-[#1f2637] text-center font-bold text-xs mt-1 border border-gray-200 dark:border-[#2a3346] text-gray-700 dark:text-gray-300">
                Fabric Notes
              </div>
              <textarea
                readOnly
                value={order.fabricNotes || ''}
                className="w-full h-11 p-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[10px] text-gray-700 dark:text-gray-200 outline-none resize-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(OrderGeneralInfo);
