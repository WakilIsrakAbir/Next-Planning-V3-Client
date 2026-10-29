'use client';

/* Batch Plan register (old #batchPlanListView): status tabs with counts, the all-units search, buyer pills,
   the scope note, the order table with column filters, and pagination. It shows the register as built by
   the last renderBatchRegister() (S.ui.planflowRegister), like the old page showed the last rendered HTML. */
import React, { useEffect, useRef, useState } from 'react';
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
  setRegisterPageSize,
  useBatchVersion,
} from '@/features/batch/lib';
import type { BatchRegisterView } from '@/features/batch/lib';
import { cn } from '@/lib/cn';
import { button, card, controlFont, emptyState, statusTab, tabCount } from '../ui/styles';
import FloorOrderLinks from './FloorOrderLinks';

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
  empty: false,
  rows: [],
};

/* Buyer pills (old .buyer-btn, .buyer-btn.active). */
const BUYER_PILL =
  'flex-none cursor-pointer whitespace-nowrap rounded border border-solid px-3 py-[5px] font-[Arial] text-[11px] font-bold uppercase ' +
  'tracking-[0.3px] transition-all duration-[120ms]';
const BUYER_PILL_IDLE =
  'border-[#ccd8e6] bg-white text-[#233d59] hover:border-[#b5cde6] hover:bg-[#e8f1fb] ' +
  'dark:border-[#2a3346] dark:bg-[#1e2330] dark:text-[#cbd5e1] dark:hover:bg-[#252b3b] dark:hover:text-[#f8fafc]';
const BUYER_PILL_ACTIVE =
  'border-[#1d5ab2] bg-[#1d5ab2] text-white dark:border-[#10b981] dark:bg-[#10b981] dark:shadow-[0_2px_6px_rgba(0,0,0,0.4)]';

/* Carousel arrows (old .carousel-btn; the browser's button padding 1px 6px). */
const CAROUSEL_BUTTON =
  'flex h-7 w-6 flex-none cursor-pointer items-center justify-center rounded border border-solid border-[#cbd7e4] bg-white px-1.5 py-px ' +
  'font-[Arial] text-[11px] text-[#475569] hover:bg-[#e2ecf7] ' +
  'dark:border-[#2a3346] dark:bg-[#1e2330] dark:text-[#cbd5e1] dark:hover:bg-[#252b3b] dark:hover:text-[#f8fafc]';

/* Register table cells (old .register-table th/td; the freeze pane keeps the borders separate). */
const CELL = 'border border-solid border-batch-border-light align-middle';
const HEAD_CELL =
  CELL +
  ' bg-[#f1f6fb] px-3.5 py-[9px] text-left text-[12px] font-bold text-[#153450] border-b-[#c9d8e8] shadow-[0_1px_0_#c9d8e8] ' +
  'dark:border-[#2a3346] dark:bg-[#151921] dark:text-[#cbd5e1] dark:shadow-[0_1px_0_#2a3346]';
const FILTER_CELL =
  CELL + ' bg-white px-2 py-[5px] text-left text-[12.5px] font-bold shadow-[0_1px_0_#c9d8e8] dark:bg-[#181c25] dark:shadow-[0_1px_0_#2a3346]';
const BODY_CELL = CELL + ' px-3.5 py-[9px] text-[12.5px]';

/* Column search inputs (old .col-search-input). */
const COLUMN_SEARCH =
  'w-full rounded border border-solid border-[#ccd8e6] bg-white px-2 py-[5px] font-[Arial] text-[11.5px] font-normal text-[#192e44] outline-[#1d5ab2] ' +
  'placeholder:text-[#8ea3bb] dark:border-[#2a3346] dark:bg-[#1e2330] dark:text-[#e2e8f0] dark:placeholder:text-[#475569] ' +
  'dark:focus:border-[#10b981] dark:focus:shadow-[0_0_0_2px_rgba(16,185,129,0.15)] dark:focus:outline-[#10b981]';

export default function BatchRegister() {
  useBatchVersion();
  const view = (S.ui.planflowRegister as BatchRegisterView | undefined) || EMPTY_REGISTER;
  const scrollPaneRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const buyers = buyerPillNames();
  const scrollReset = Number(S.ui.planflowScrollReset) || 0;

  // selectFloor: the order list starts at the top again (old registerScrollPane.scrollTop = 0).
  useEffect(() => {
    if (scrollPaneRef.current) scrollPaneRef.current.scrollTop = 0;
  }, [scrollReset]);

  // Saved lists add the user/date audit columns, the Need Re-Confirm list the revision columns.
  const savedHidden = !view.showSaveAudit && 'hidden';
  const reconfirmHidden = !view.showReconfirm && 'hidden';
  const tableClass = cn(
    'w-full table-fixed border-separate border-spacing-0',
    view.showReconfirm ? 'min-w-[1450px]' : view.showSaveAudit && 'min-w-[1100px]'
  );

  return (
    <div id="batchPlanListView" className="min-h-0 flex-1 overflow-auto overscroll-contain print:hidden">
      <div className={card}>
        {/* TOP STATUS TABS & GLOBAL SEARCH */}
        <div className="flex flex-wrap items-center justify-between gap-3.5 border-b border-solid border-batch-border-light px-[18px] py-3.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_TABS.map((tab) => {
              const active = S.activeStatusTab === tab.status;
              return (
                <button
                  type="button"
                  key={tab.status}
                  className={cn(statusTab(active), controlFont)}
                  data-status={tab.status}
                  id={tab.id}
                  onClick={() => selectStatusTab(tab.status)}
                >
                  {tab.label}{' '}
                  <span className={tabCount(active)} id={tab.countId}>
                    {view.counts[tab.status]}
                  </span>
                </button>
              );
            })}
          </div>
          <RegisterSearch />
        </div>

        {/* HORIZONTAL BUYER FILTER CAROUSEL */}
        <div className="relative flex items-center gap-2 overflow-hidden border-b border-solid border-batch-border-light bg-[#f9fbfe] px-[18px] py-2.5 dark:bg-[#151921]">
          <button
            type="button"
            className={CAROUSEL_BUTTON}
            id="btnScrollBuyerLeft"
            title="Scroll left"
            onClick={() => pillsRef.current?.scrollBy({ left: -220, behavior: 'smooth' })}
          >
            ◀
          </button>
          <div
            className="flex gap-1.5 overflow-x-auto scroll-smooth py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            id="buyerPillsContainer"
            ref={pillsRef}
          >
            {['ALL', ...buyers].map((buyer) => (
              <button
                type="button"
                key={buyer}
                className={cn(BUYER_PILL, S.activeBuyerFilter === buyer ? BUYER_PILL_ACTIVE : BUYER_PILL_IDLE)}
                data-buyer={buyer}
                onClick={() => selectBuyerFilter(buyer)}
              >
                {buyer === 'ALL' ? 'ALL BUYERS' : buyer}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={CAROUSEL_BUTTON}
            id="btnScrollBuyerRight"
            title="Scroll right"
            onClick={() => pillsRef.current?.scrollBy({ left: 220, behavior: 'smooth' })}
          >
            ▶
          </button>
        </div>

        <div
          id="floorScopeNote"
          className="border-b border-solid border-batch-border-light bg-[#eef6fc] px-[18px] py-2.5 text-[12px] text-[#244766] dark:bg-[rgba(16,185,129,0.07)] dark:text-[#94a3b8]"
        >
          {view.scopeNote}
        </div>
        {/* Saved lists include user/date audit columns; headings remain frozen (old .freeze-pane). */}
        <div
          className="relative max-h-[calc(var(--batch-vh,1vh)*60)] w-full overflow-auto overscroll-contain print:max-h-none print:overflow-visible"
          id="registerScrollPane"
          tabIndex={0}
          aria-label="Batch Plan orders"
          ref={scrollPaneRef}
        >
          <table className={tableClass}>
            <colgroup id="registerColumns">
              <col className="w-[85px]" />
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
            <thead className="sticky top-0 z-[3] bg-[#f1f6fb] dark:bg-[#151921] print:static">
              <tr>
                <th className={HEAD_CELL}>Manage</th>
                <th className={HEAD_CELL}>Order/Booking No.</th>
                <th className={HEAD_CELL}>Booking Date</th>
                <th className={HEAD_CELL}>Buyer</th>
                <th id="registerSavedByHeading" className={cn(HEAD_CELL, savedHidden)}>
                  {view.savedByHeading}
                </th>
                <th className={cn(HEAD_CELL, savedHidden)}>Last Save</th>
                <th className={cn(HEAD_CELL, reconfirmHidden)}>Latest YB Revised No</th>
                <th className={cn(HEAD_CELL, reconfirmHidden)}>Confirmed BP Revised No</th>
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
            <tbody id="batchRegisterRows">
              {view.rows.map((row, index) => (
                <tr
                  key={row.number + '|' + (row.bookingFloor || '') + '|' + index}
                  className="even:bg-batch-row-alt hover:bg-[#edf4fc] dark:hover:bg-[rgba(16,185,129,0.08)]"
                >
                  <td className={cn(BODY_CELL, 'text-center')}>
                    <button
                      type="button"
                      className="inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-[5px] border border-solid border-[#bfdbfe] bg-[#dbeafe] px-1.5 py-px text-[#1d4ed8] transition-all duration-150 hover:scale-[1.04] hover:border-[#1d4ed8] hover:bg-[#1d4ed8] hover:text-white dark:border-[rgba(16,185,129,0.35)] dark:bg-[rgba(16,185,129,0.15)] dark:text-[#34d399] dark:hover:border-[#10b981] dark:hover:bg-[#10b981] dark:hover:text-white"
                      data-booking={row.number}
                      data-booking-floor={row.bookingFloor}
                      title={row.title}
                      onClick={() => openRegisterBooking(row.number, row.bookingFloor)}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </td>
                  <td className={cn(BODY_CELL, 'text-left')}>
                    <span className="font-bold tracking-[0.3px] text-[#1d4ed8] dark:text-[#34d399]">{row.number}</span>
                    {row.unitName && <div className="mt-1 text-[11px] text-[#64748b]">{row.unitName}</div>}
                    {row.floorLinks && <FloorOrderLinks number={row.number} />}
                  </td>
                  <td className={cn(BODY_CELL, 'text-left')}>{row.date}</td>
                  <td className={cn(BODY_CELL, 'text-left')}>
                    <strong>{row.buyer}</strong>
                  </td>
                  {view.showSaveAudit && (
                    <>
                      <td className={cn(BODY_CELL, 'text-left')}>{row.savedBy}</td>
                      <td className={cn(BODY_CELL, 'whitespace-nowrap text-left')} title={row.lastSaveTitle}>
                        {row.lastSave}
                      </td>
                    </>
                  )}
                  {view.showReconfirm && (
                    <>
                      <td className={cn(BODY_CELL, 'text-left')}>{row.latestRevision}</td>
                      <td className={cn(BODY_CELL, 'text-left')}>{row.confirmedRevision}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div id="tableEmptyState" className={cn(emptyState, !view.empty && 'hidden')}>
          No matching bookings found in this list.
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3.5 border-t border-solid border-batch-border-light px-[18px] py-3.5 text-[12px] text-batch-muted">
          <label htmlFor="registerPageSize">
            Show{' '}
            <select
              id="registerPageSize"
              className="mx-1.5 rounded border border-solid border-batch-border bg-white px-2.5 py-1.5 font-[Arial] text-[12px] text-batch-text dark:bg-[#1e2330] dark:focus:border-[#10b981] dark:focus:shadow-[0_0_0_2px_rgba(16,185,129,0.15)] dark:focus:outline-[#10b981]"
              value={S.registerPageSize}
              onChange={(event) => setRegisterPageSize(event.target.value)}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="All">All</option>
            </select>{' '}
            orders
          </label>
          <span id="registerResultCount">{view.resultCount}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={cn(button('secondary'), controlFont)}
              id="btnPreviousPage"
              disabled={view.previousDisabled}
              onClick={previousRegisterPage}
            >
              ◀ Previous
            </button>
            <span id="registerPageInfo">{view.pageInfo}</span>
            <button type="button" className={cn(button('secondary'), controlFont)} id="btnNextPage" disabled={view.nextDisabled} onClick={nextRegisterPage}>
              Next ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* The all-units search box (old #globalSearchInput): the text is the search term (S.globalSearch) and the
   list is built again on Enter or Search, as before. */
function RegisterSearch() {
  const [value, setValue] = useState(() => S.globalSearch);
  return (
    <div className="flex min-w-[320px] items-stretch gap-1">
      <div className="relative flex flex-1 items-center">
        <svg
          className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#2563eb] dark:text-[#34d399]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          id="globalSearchInput"
          className="w-full rounded border border-solid border-[#bfcedf] bg-white py-[7px] pl-[30px] pr-2.5 font-[Arial] text-[12px] text-[#15293d] outline-batch-primary placeholder:text-[#757575] dark:border-[#2a3346] dark:bg-[#1e2330] dark:text-[#e2e8f0] dark:placeholder:text-[#475569] dark:focus:border-[#10b981] dark:focus:shadow-[0_0_0_2px_rgba(16,185,129,0.15)] dark:focus:outline-[#10b981]"
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
      </div>
      <button
        type="button"
        className="cursor-pointer rounded border-0 bg-batch-primary px-3.5 py-[7px] font-[Arial] text-[12px] font-bold text-white hover:bg-batch-primary-hover"
        id="btnRunSearch"
        onClick={() => renderBatchRegister()}
      >
        Search
      </button>
      <button
        type="button"
        className="cursor-pointer rounded border border-solid border-[#bfcedf] bg-white px-[11px] py-[7px] font-[Arial] text-[12px] font-bold text-[#556b82] hover:bg-[#f1f5f9] hover:text-[#b91c1c] dark:border-[#2a3346] dark:bg-[#1e2330] dark:text-[#cbd5e1] dark:hover:bg-[#252b3b] dark:hover:text-[#f87171]"
        id="btnClearSearch"
        title="Clear search"
        onClick={() => {
          setValue('');
          clearGlobalSearch();
        }}
      >
        ✕
      </button>
    </div>
  );
}
