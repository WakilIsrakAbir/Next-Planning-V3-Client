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

  const savedClass = 'saved-list-column' + (view.showSaveAudit ? '' : ' hidden');
  const reconfirmClass = 'reconfirm-list-column' + (view.showReconfirm ? '' : ' hidden');
  const tableClass = 'register-table' + (view.showSaveAudit ? ' has-save-audit' : '') + (view.showReconfirm ? ' has-reconfirmation' : '');

  return (
    <div id="batchPlanListView">
      <div className="card">
        {/* TOP STATUS TABS & GLOBAL SEARCH */}
        <div className="batch-filter-bar">
          <div className="status-tabs">
            {STATUS_TABS.map((tab) => (
              <button
                type="button"
                key={tab.status}
                className={'status-btn' + (S.activeStatusTab === tab.status ? ' active' : '')}
                data-status={tab.status}
                id={tab.id}
                onClick={() => selectStatusTab(tab.status)}
              >
                {tab.label}{' '}
                <span className="status-count" id={tab.countId}>
                  {view.counts[tab.status]}
                </span>
              </button>
            ))}
          </div>
          <RegisterSearch />
        </div>

        {/* HORIZONTAL BUYER FILTER CAROUSEL */}
        <div className="buyer-carousel-wrap">
          <button
            type="button"
            className="carousel-btn"
            id="btnScrollBuyerLeft"
            title="Scroll left"
            onClick={() => pillsRef.current?.scrollBy({ left: -220, behavior: 'smooth' })}
          >
            ◀
          </button>
          <div className="buyer-pills-container" id="buyerPillsContainer" ref={pillsRef}>
            {['ALL', ...buyers].map((buyer) => (
              <button
                type="button"
                key={buyer}
                className={'buyer-btn' + (S.activeBuyerFilter === buyer ? ' active' : '')}
                data-buyer={buyer}
                onClick={() => selectBuyerFilter(buyer)}
              >
                {buyer === 'ALL' ? 'ALL BUYERS' : buyer}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="carousel-btn"
            id="btnScrollBuyerRight"
            title="Scroll right"
            onClick={() => pillsRef.current?.scrollBy({ left: 220, behavior: 'smooth' })}
          >
            ▶
          </button>
        </div>

        <div id="floorScopeNote" className="floor-scope-note">
          {view.scopeNote}
        </div>
        {/* Saved lists include user/date audit columns; headings remain frozen. */}
        <div className="table-wrap freeze-pane" id="registerScrollPane" tabIndex={0} aria-label="Batch Plan orders" ref={scrollPaneRef}>
          <table className={tableClass}>
            <colgroup id="registerColumns">
              <col className="col-manage" />
              <col className="col-order" />
              <col className="col-date" />
              <col className="col-buyer" />
              {view.showSaveAudit && (
                <>
                  <col className="col-saved-by" />
                  <col className="col-last-save" />
                </>
              )}
              {view.showReconfirm && (
                <>
                  <col className="col-revision" />
                  <col className="col-revision" />
                </>
              )}
            </colgroup>
            <thead>
              <tr>
                <th>Manage</th>
                <th>Order/Booking No.</th>
                <th>Booking Date</th>
                <th>Buyer</th>
                <th id="registerSavedByHeading" className={savedClass}>
                  {view.savedByHeading}
                </th>
                <th className={savedClass}>Last Save</th>
                <th className={reconfirmClass}>Latest YB Revised No</th>
                <th className={reconfirmClass}>Confirmed BP Revised No</th>
              </tr>
              <tr className="filter-row">
                <th></th>
                <th>
                  <input
                    type="text"
                    id="colSearchOrder"
                    className="col-search-input"
                    placeholder="Search No..."
                    value={S.columnSearch.order}
                    onChange={(event) => setColumnSearch('order', event.target.value)}
                  />
                </th>
                <th>
                  <input
                    type="text"
                    id="colSearchDate"
                    className="col-search-input"
                    placeholder="Search Date..."
                    value={S.columnSearch.date}
                    onChange={(event) => setColumnSearch('date', event.target.value)}
                  />
                </th>
                <th>
                  <input
                    type="text"
                    id="colSearchBuyer"
                    className="col-search-input"
                    placeholder="Search Buyer..."
                    value={S.columnSearch.buyer}
                    onChange={(event) => setColumnSearch('buyer', event.target.value)}
                  />
                </th>
                <th className={savedClass}></th>
                <th className={savedClass}></th>
                <th className={reconfirmClass}></th>
                <th className={reconfirmClass}></th>
              </tr>
            </thead>
            <tbody id="batchRegisterRows">
              {view.rows.map((row, index) => (
                <tr key={row.number + '|' + (row.bookingFloor || '') + '|' + index}>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn-view-eye"
                      data-booking={row.number}
                      data-booking-floor={row.bookingFloor}
                      title={row.title}
                      onClick={() => openRegisterBooking(row.number, row.bookingFloor)}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </td>
                  <td>
                    <span className="order-link">{row.number}</span>
                    {row.unitName && <div className="register-floor-name">{row.unitName}</div>}
                    {row.floorLinks && <FloorOrderLinks number={row.number} />}
                  </td>
                  <td>{row.date}</td>
                  <td>
                    <strong>{row.buyer}</strong>
                  </td>
                  {view.showSaveAudit && (
                    <>
                      <td>{row.savedBy}</td>
                      <td className="last-save-cell" title={row.lastSaveTitle}>
                        {row.lastSave}
                      </td>
                    </>
                  )}
                  {view.showReconfirm && (
                    <>
                      <td>{row.latestRevision}</td>
                      <td>{row.confirmedRevision}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div id="tableEmptyState" className={'empty-state' + (view.empty ? '' : ' hidden')}>
          No matching bookings found in this list.
        </div>
        <div className="pagination-bar">
          <label htmlFor="registerPageSize">
            Show{' '}
            <select
              id="registerPageSize"
              className="page-size-select"
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
          <div className="pagination-actions">
            <button type="button" className="btn secondary" id="btnPreviousPage" disabled={view.previousDisabled} onClick={previousRegisterPage}>
              ◀ Previous
            </button>
            <span id="registerPageInfo">{view.pageInfo}</span>
            <button type="button" className="btn secondary" id="btnNextPage" disabled={view.nextDisabled} onClick={nextRegisterPage}>
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
    <div className="search-box-top">
      <div className="search-input-wrap">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          id="globalSearchInput"
          className="search-input-top"
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
      <button type="button" className="btn-search-action" id="btnRunSearch" onClick={() => renderBatchRegister()}>
        Search
      </button>
      <button
        type="button"
        className="btn-clear"
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
