'use client';

/* Batch Plan register (old #batchPlanListView), in the plan lists' look (DepartmentPlanningScreen): the top part
   (unit tabs, status tabs with counts and the all-units search, buyer pills) and the order table with column
   filters and the shared pagination. It shows the register as built by the last renderBatchRegister()
   (S.ui.planflowRegister), like the old page showed the last rendered HTML.
   Fixed layout: the register fills the Batch page; the top part and the pagination stay put and only the table
   rows scroll. "Auto" (the default page size) shows as many orders as fit in the table area: the register
   measures it (useFitRows) and stores the row count in S (setRegisterAutoRows), which paginateRegister cuts. */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Search, X } from 'lucide-react';
import Pagination from '@/components/ui/Pagination';
import { useFitRows } from '@/lib/use-fit-rows';
import {
  S,
  buyerPillNames,
  changeGlobalSearch,
  clearGlobalSearch,
  nextRegisterPage,
  openRegisterBooking,
  previousRegisterPage,
  renderBatchRegister,
  selectBuyerFilter,
  selectStatusTab,
  setColumnSearch,
  setRegisterAutoRows,
  setRegisterPageSize,
  useBatchVersion,
} from '@/features/batch/lib';
import type { BatchRegisterView } from '@/features/batch/lib';
import { cn } from '@/lib/cn';
import { listStatusTab, listTabCount } from '../ui/styles';
import FloorOrderLinks from './FloorOrderLinks';
import UnitTabs from './UnitTabs';

const STATUS_TABS = [
  { status: 'Pending', id: 'btnTabPending', label: 'PENDING LIST', countId: 'countPending' },
  { status: 'Confirm', id: 'btnTabConfirm', label: 'CONFIRM LIST', countId: 'countConfirm' },
  { status: 'Tentative', id: 'btnTabTentative', label: 'TENTATIVE LIST', countId: 'countTentative' },
  { status: 'NeedReconfirm', id: 'btnTabNeedReconfirm', label: 'NEED RE-CONFIRM LIST', countId: 'countNeedReconfirm' },
] as const;

// The register before the first renderBatchRegister() (old initial markup).
const EMPTY_REGISTER: BatchRegisterView = {
  counts: { Pending: 0, Confirm: 0, Tentative: 0, NeedReconfirm: 0 },
  showReconfirm: false,
  showSaveAudit: false,
  savedByHeading: 'Tentative By',
  searching: false,
  scopeNote: 'All orders',
  resultCount: 'Showing 0 orders',
  pageInfo: 'Page 1 of 1',
  previousDisabled: true,
  nextDisabled: true,
  total: 0,
  page: 1,
  totalPages: 1,
  pageSize: 10,
  empty: false,
  rows: [],
};

// Natural height of a register row (eye button + padding, as in the plan lists); "Auto" stretches rows slightly
// to fill the table area.
const ROW_HEIGHT = 40;

/* Buyer pills (the plan lists' buyer chips; old .buyer-btn, .buyer-btn.active). */
const BUYER_PILL = 'flex-none cursor-pointer whitespace-nowrap rounded border border-solid px-3 py-1 text-xs transition';
const BUYER_PILL_IDLE =
  'border-gray-300 bg-gray-100 text-gray-700 hover:bg-emerald-50/50 ' +
  'dark:border-[#2a3346] dark:bg-[#1f2637] dark:text-gray-300 dark:hover:bg-[#283347]';
const BUYER_PILL_ACTIVE = 'border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/20';

/* Carousel arrows of the buyer pills (old .carousel-btn). */
const CAROUSEL_BUTTON =
  'flex h-[26px] w-[26px] flex-none cursor-pointer items-center justify-center rounded border border-solid border-gray-300 bg-white text-gray-600 ' +
  'shadow-sm transition hover:bg-emerald-50 hover:text-emerald-700 ' +
  'dark:border-[#2a3346] dark:bg-[#151921] dark:text-gray-300 dark:hover:bg-[#1f2637] dark:hover:text-emerald-400';

/* Register table cells (the plan lists' table). The table keeps separate borders so the sticky heading keeps its lines. */
const HEAD_CELL = 'border-0 border-b border-r border-solid border-gray-300 p-2 text-[11px] font-bold dark:border-[#2a3346]';
const HEAD_TEXT = 'text-gray-700 dark:text-gray-200';
const FILTER_CELL = 'border-0 border-b border-r border-solid border-gray-300 bg-white p-1 dark:border-[#2a3346] dark:bg-[#151921]';
const BODY_CELL = 'border-0 border-b border-r border-solid border-gray-200 p-2 align-middle dark:border-[#2a3346]';

/* Column search inputs (old .col-search-input). */
const COLUMN_SEARCH =
  'w-full rounded border border-solid border-gray-300 bg-gray-50 p-1 text-[10px] font-normal text-gray-800 outline-none ' +
  'placeholder:text-gray-400 focus:border-emerald-500 dark:border-[#2a3346] dark:bg-[#181f2c] dark:text-gray-100 dark:placeholder:text-gray-500';

export default function BatchRegister() {
  useBatchVersion();
  const view = (S.ui.planflowRegister as BatchRegisterView | undefined) || EMPTY_REGISTER;
  const scrollPaneRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const buyers = buyerPillNames();
  const scrollReset = Number(S.ui.planflowScrollReset) || 0;

  // The table area: "Auto" shows as many orders as fit in it, so the page neither scrolls nor leaves an empty band.
  const fit = useFitRows(scrollPaneRef, ROW_HEIGHT);
  // Measured before the browser paints, so the register is cut to the fitted rows before it shows.
  useLayoutEffect(() => {
    if (fit) setRegisterAutoRows(fit.rows);
  }, [fit]);
  const auto = S.registerPageSize === 'auto';
  const rowStyle = auto && fit ? { height: fit.rowHeight } : undefined;

  // selectFloor: the order list starts at the top again (old registerScrollPane.scrollTop = 0).
  useEffect(() => {
    if (scrollPaneRef.current) scrollPaneRef.current.scrollTop = 0;
  }, [scrollReset]);

  // Saved lists add the user/date audit columns, the Need Re-Confirm list the revision columns.
  const savedHidden = !view.showSaveAudit && 'hidden';
  const reconfirmHidden = !view.showReconfirm && 'hidden';
  const tableClass = cn(
    'w-full border-separate border-spacing-0 whitespace-nowrap text-left',
    view.showReconfirm ? 'min-w-[1450px]' : view.showSaveAudit ? 'min-w-[1100px]' : 'min-w-[900px]'
  );

  return (
    <div id="batchPlanListView" className="flex min-h-0 flex-1 flex-col gap-3 text-[11px] print:hidden">
      {/* TOP PART: unit tabs, status tabs & all-units search, buyer pills (stays put) */}
      <div className="flex flex-none flex-col gap-2 rounded-sm border border-solid border-gray-200 bg-white p-2 shadow-sm dark:border-[#2a3346] dark:bg-[#151921]">
        <UnitTabs kind="plan" variant="list" />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1 sm:gap-2">
            {STATUS_TABS.map((tab) => {
              const active = S.activeStatusTab === tab.status;
              return (
                <button
                  type="button"
                  key={tab.status}
                  className={listStatusTab(active)}
                  data-status={tab.status}
                  id={tab.id}
                  onClick={() => selectStatusTab(tab.status)}
                >
                  {tab.label}{' '}
                  <span className={listTabCount(active)} id={tab.countId}>
                    {view.counts[tab.status]}
                  </span>
                </button>
              );
            })}
          </div>
          <RegisterSearch />
        </div>

        {/* HORIZONTAL BUYER FILTER CAROUSEL */}
        <div className="flex items-center gap-1.5 border-0 border-t border-solid border-gray-100 pt-2 dark:border-[#2a3346]">
          <button
            type="button"
            className={CAROUSEL_BUTTON}
            id="btnScrollBuyerLeft"
            title="Scroll left"
            onClick={() => pillsRef.current?.scrollBy({ left: -220, behavior: 'smooth' })}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <div
            className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            id="buyerPillsContainer"
            ref={pillsRef}
          >
            {['ALL', ...buyers].map((buyer) => {
              const active = S.activeBuyerFilter === buyer;
              return (
                <button
                  type="button"
                  key={buyer}
                  className={cn(BUYER_PILL, active ? BUYER_PILL_ACTIVE : BUYER_PILL_IDLE, active || buyer === 'ALL' ? 'font-bold' : 'font-medium')}
                  data-buyer={buyer}
                  onClick={() => selectBuyerFilter(buyer)}
                >
                  {buyer === 'ALL' ? 'ALL BUYERS' : buyer}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className={CAROUSEL_BUTTON}
            id="btnScrollBuyerRight"
            title="Scroll right"
            onClick={() => pillsRef.current?.scrollBy({ left: 220, behavior: 'smooth' })}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ORDER TABLE: fills the rest of the page; only its rows scroll, the pagination stays at the bottom */}
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-sm border border-solid border-gray-300 bg-white shadow-sm dark:border-[#2a3346] dark:bg-[#151921]">
        {/* Saved lists include user/date audit columns; headings remain frozen (old .freeze-pane). */}
        <div
          className="custom-scrollbar min-h-0 w-full flex-1 overflow-auto overscroll-contain"
          id="registerScrollPane"
          tabIndex={0}
          aria-label="Batch Plan orders"
          ref={scrollPaneRef}
        >
          <table className={tableClass}>
            <colgroup id="registerColumns">
              <col className="w-[64px]" />
              <col className={view.showSaveAudit ? 'w-[220px]' : 'w-[260px]'} />
              <col className={view.showSaveAudit ? 'w-[150px]' : 'w-[240px]'} />
              <col className={view.showSaveAudit ? 'w-[180px]' : 'w-auto'} />
              {view.showSaveAudit && (
                <>
                  <col className="w-[180px]" />
                  <col className="w-[220px]" />
                </>
              )}
              {view.showReconfirm && (
                <>
                  <col className="w-[175px]" />
                  <col className="w-[175px]" />
                </>
              )}
            </colgroup>
            <thead className="sticky top-0 z-20 select-none bg-gray-100 shadow-sm dark:bg-[#1f2637]">
              <tr>
                <th className={cn(HEAD_CELL, HEAD_TEXT, 'text-center')}>Manage</th>
                <th className={cn(HEAD_CELL, HEAD_TEXT, 'text-left')}>Order/Booking No.</th>
                <th className={cn(HEAD_CELL, HEAD_TEXT, 'text-center')}>Booking Date</th>
                <th className={cn(HEAD_CELL, 'text-left text-blue-700 dark:text-blue-400')}>Buyer</th>
                <th id="registerSavedByHeading" className={cn(HEAD_CELL, HEAD_TEXT, 'text-left', savedHidden)}>
                  {view.savedByHeading}
                </th>
                <th className={cn(HEAD_CELL, HEAD_TEXT, 'text-left', savedHidden)}>Last Save</th>
                <th className={cn(HEAD_CELL, HEAD_TEXT, 'text-left', reconfirmHidden)}>Latest YB Revised No</th>
                <th className={cn(HEAD_CELL, HEAD_TEXT, 'text-left', reconfirmHidden)}>Confirmed BP Revised No</th>
              </tr>
              <tr>
                <th className={FILTER_CELL}></th>
                <th className={FILTER_CELL}>
                  <input
                    type="text"
                    id="colSearchOrder"
                    className={COLUMN_SEARCH}
                    placeholder="Search No..."
                    value={S.columnSearch.order}
                    onChange={(event) => setColumnSearch('order', event.target.value)}
                  />
                </th>
                <th className={FILTER_CELL}>
                  <input
                    type="text"
                    id="colSearchDate"
                    className={COLUMN_SEARCH}
                    placeholder="Search Date..."
                    value={S.columnSearch.date}
                    onChange={(event) => setColumnSearch('date', event.target.value)}
                  />
                </th>
                <th className={FILTER_CELL}>
                  <input
                    type="text"
                    id="colSearchBuyer"
                    className={COLUMN_SEARCH}
                    placeholder="Search Buyer..."
                    value={S.columnSearch.buyer}
                    onChange={(event) => setColumnSearch('buyer', event.target.value)}
                  />
                </th>
                <th className={cn(FILTER_CELL, savedHidden)}></th>
                <th className={cn(FILTER_CELL, savedHidden)}></th>
                <th className={cn(FILTER_CELL, reconfirmHidden)}></th>
                <th className={cn(FILTER_CELL, reconfirmHidden)}></th>
              </tr>
            </thead>
            <tbody id="batchRegisterRows" className="text-[11px] text-gray-700 dark:text-gray-300">
              {view.rows.map((row, index) => (
                <tr
                  key={row.number + '|' + (row.bookingFloor || '') + '|' + index}
                  style={rowStyle}
                  className="bg-white transition-colors hover:bg-emerald-50/50 dark:bg-[#151921] dark:hover:bg-emerald-950/20"
                >
                  <td className={cn(BODY_CELL, 'text-center')}>
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center rounded border-0 bg-emerald-100 px-3 py-1 text-emerald-700 shadow-sm transition hover:bg-emerald-600 hover:text-white"
                      data-booking={row.number}
                      data-booking-floor={row.bookingFloor}
                      title={row.title}
                      onClick={() => openRegisterBooking(row.number, row.bookingFloor)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                  <td className={BODY_CELL}>
                    {/* One line per order: the unit name and the same-order unit buttons follow the number. */}
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">{row.number}</span>
                      {row.unitName && <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{row.unitName}</span>}
                      {row.floorLinks && <FloorOrderLinks number={row.number} />}
                    </div>
                  </td>
                  <td className={cn(BODY_CELL, 'text-center')}>{row.date}</td>
                  <td className={cn(BODY_CELL, 'font-medium text-gray-800 dark:text-gray-200')}>{row.buyer}</td>
                  {view.showSaveAudit && (
                    <>
                      <td className={BODY_CELL}>{row.savedBy}</td>
                      <td className={BODY_CELL} title={row.lastSaveTitle}>
                        {row.lastSave}
                      </td>
                    </>
                  )}
                  {view.showReconfirm && (
                    <>
                      <td className={BODY_CELL}>{row.latestRevision}</td>
                      <td className={BODY_CELL}>{row.confirmedRevision}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div id="tableEmptyState" className={cn('px-5 py-10 text-center text-[12px] text-gray-500 dark:text-gray-400', !view.empty && 'hidden')}>
            No matching bookings found in this list.
          </div>
        </div>

        {/* The plan lists' pagination: rows per page (Auto, 10–100, All), Prev / Page X of Y / Next */}
        <Pagination
          currentPage={view.page}
          totalPages={view.totalPages}
          totalItems={view.total}
          limit={view.pageSize}
          onPageChange={(page) => (page < view.page ? previousRegisterPage() : nextRegisterPage())}
          onLimitChange={(limit) => setRegisterPageSize(String(limit))}
          autoRows={fit?.rows ?? S.registerAutoRows}
          isAuto={auto}
          onShowAll={() => setRegisterPageSize('All')}
          isAll={S.registerPageSize === 'All'}
        />
      </div>
    </div>
  );
}

/* The all-units search box (old #globalSearchInput): the text is the search term (S.globalSearch) and the
   list is built again on Enter or Search, as before. */
function RegisterSearch() {
  const [value, setValue] = useState(() => S.globalSearch);
  return (
    <div className="flex min-w-[260px] max-w-[440px] flex-1 items-center gap-1 rounded border border-solid border-emerald-200 bg-emerald-50/70 p-1 px-2 shadow-sm dark:border-[#2a3346] dark:bg-[#1e2330]">
      <Search className="ml-1 h-3.5 w-3.5 flex-none text-emerald-600 dark:text-emerald-400" />
      <input
        type="text"
        id="globalSearchInput"
        className="min-w-0 flex-1 rounded border border-solid border-emerald-300 bg-white px-2 py-1 text-xs text-gray-800 outline-none placeholder:text-gray-400 focus:border-emerald-500 dark:border-[#2a3346] dark:bg-[#151921] dark:text-gray-100 dark:placeholder:text-gray-500"
        placeholder="Search Booking No. / Buyer in all units..."
        title="Searches every unit you may open; each result names its unit"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          changeGlobalSearch(event.target.value);
        }}
        onKeyUp={(event) => {
          if (event.key === 'Enter') renderBatchRegister();
        }}
      />
      <button
        type="button"
        className="cursor-pointer whitespace-nowrap rounded border-0 bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow transition hover:bg-emerald-700"
        id="btnRunSearch"
        onClick={() => renderBatchRegister()}
      >
        Search
      </button>
      <button
        type="button"
        className="inline-flex cursor-pointer items-center self-stretch rounded border-0 bg-gray-200 px-2 py-1 text-xs font-bold text-gray-700 transition hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        id="btnClearSearch"
        title="Clear search"
        aria-label="Clear search"
        onClick={() => {
          setValue('');
          clearGlobalSearch();
        }}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
