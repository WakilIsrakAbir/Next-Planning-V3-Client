'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Search,
  Eye,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DEPARTMENTS, PLAN_LIST_TITLES, STATUS_COLORS } from '@/lib/constants';
import { formatDateDisplay } from '@/lib/date-utils';
import { PlanStatus } from '@/types/order';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import { pageForNewLimit, useFitRows } from '@/lib/use-fit-rows';
import {
  cachedPlanningOrders,
  cachedDeptBuyers,
  fetchPlanningOrders,
  findCachedPlanningPage,
  PREFETCH_LIMIT,
  planningListKey,
  prefetchOrderDetail,
  getSavedDeptState,
  saveDeptState,
  type IDeptPageState,
} from '@/features/planning/lib/planning-cache';

interface PageProps {
  params: Promise<{ dept: string }>;
}

/** The cached page for a saved list state, shown at once ("Auto" page 1 is cut from the prefetched first 30 rows). */
function cachedListPage(dept: string, s: IDeptPageState) {
  if (s.limit === 'auto' && s.page !== 1) return null;
  const limit = s.limit === 'auto' ? PREFETCH_LIMIT : s.limit;
  const query = { dept, activeTab: s.activeTab, activeBuyer: s.activeBuyer, page: s.page, limit, globalSearch: s.globalSearch };
  const pending = { dept, activeTab: 'Pending' as const, activeBuyer: '', page: 1, limit: PREFETCH_LIMIT, globalSearch: '' };
  return findCachedPlanningPage(query) || cachedPlanningOrders[planningListKey(pending)] || null;
}

// Natural height of a list row (eye button + padding); "Auto" stretches rows slightly to fill the table area.
const ROW_HEIGHT = 40;

export default function DepartmentPlanningScreen({ params }: PageProps) {
  const resolvedParams = use(params);
  const dept = resolvedParams.dept || 'knitting';
  const deptConfig = DEPARTMENTS[dept] || { name: PLAN_LIST_TITLES[dept] || `${dept.toUpperCase()} Plan` };

  const savedState = getSavedDeptState(dept);

  const [activeTab, setActiveTab] = useState<PlanStatus | 'All'>(() => savedState.activeTab);
  const [globalSearch, setGlobalSearch] = useState(() => savedState.globalSearch);
  // US-11: a submitted search looks in every list (scope=all); each result shows the list it is in.
  const [appliedSearch, setAppliedSearch] = useState(() => savedState.globalSearch || '');
  const searchAll = appliedSearch.trim() !== '';
  // The rows on screen came from a search across all lists (their badges show only then, never on a list's own rows).
  const [rowsFromAllLists, setRowsFromAllLists] = useState(false);
  const [activeBuyer, setActiveBuyer] = useState(() => savedState.activeBuyer);
  const [page, setPage] = useState(() => savedState.page);
  const [limitChoice, setLimitChoice] = useState<number | 'auto'>(() => savedState.limit);
  // The table area: "Auto" shows as many rows as fit in it, so the page neither scrolls nor leaves an empty band
  const scrollRef = useRef<HTMLDivElement>(null);
  const fit = useFitRows(scrollRef, ROW_HEIGHT);
  const limit = limitChoice === 'auto' ? (fit?.rows ?? null) : limitChoice;

  const initialCache = cachedListPage(dept, savedState);

  const [orders, setOrders] = useState<any[]>(() => initialCache?.orders || []);
  const [loading, setLoading] = useState(() => !initialCache);
  const [availableBuyers, setAvailableBuyers] = useState<string[]>(() => cachedDeptBuyers[dept] || initialCache?.buyers || []);
  const [totalPages, setTotalPages] = useState(() => initialCache?.totalPages || 1);
  const [totalOrders, setTotalOrders] = useState(() => initialCache?.total || 0);

  // Column search filters matching Exp filterByColumn
  const [colSearchOrder, setColSearchOrder] = useState(() => savedState.colSearchOrder);
  const [colSearchDate, setColSearchDate] = useState(() => savedState.colSearchDate);
  const [colSearchBuyer, setColSearchBuyer] = useState(() => savedState.colSearchBuyer);
  const [colSearchStatus, setColSearchStatus] = useState(() => savedState.colSearchStatus);

  // Bumped by a search submit so the fetch effect runs exactly once for it (also when already on page 1)
  const [searchRun, setSearchRun] = useState(0);
  // Only the newest list request may update the table (responses can arrive out of order)
  const latestRequestRef = useRef(0);

  // Synchronize state immediately whenever dept changes (Exp matching 0ms instant display).
  // Done during render, so the fetch effect below only ever runs with this dept's restored state.
  const [stateDept, setStateDept] = useState(dept);
  if (stateDept !== dept) {
    setStateDept(dept);
    const s = getSavedDeptState(dept);
    setActiveBuyer(s.activeBuyer);
    setActiveTab(s.activeTab);
    setPage(s.page);
    setLimitChoice(s.limit);
    setGlobalSearch(s.globalSearch);
    setAppliedSearch(s.globalSearch || '');
    setColSearchOrder(s.colSearchOrder);
    setColSearchDate(s.colSearchDate);
    setColSearchBuyer(s.colSearchBuyer);
    setColSearchStatus(s.colSearchStatus);

    const cached = cachedListPage(dept, s);
    if (cached) {
      setOrders(cached.orders);
      setTotalPages(cached.totalPages);
      setTotalOrders(cached.total);
      setLoading(false);
      if (cached.buyers && cached.buyers.length > 0) {
        setAvailableBuyers(cached.buyers);
      }
    } else {
      setLoading(true);
    }
    if (cachedDeptBuyers[dept]) {
      setAvailableBuyers(cachedDeptBuyers[dept]);
    }
  }

  // When "Auto" fits a different number of rows (window or sidebar resized), keep the first visible row in view
  const [prevLimit, setPrevLimit] = useState(limit);
  if (limit !== prevLimit) {
    setPrevLimit(limit);
    if (limitChoice === 'auto' && prevLimit && limit) setPage(pageForNewLimit(page, prevLimit, limit));
  }

  // Fetch paginated department orders with SWR (Single combined call matching Exp).
  // The request is shared with the background prefetch when both ask for the same page.
  const fetchOrders = async () => {
    // "Auto" waits until the table area has been measured
    if (limit === null) return;
    const q = searchAll
      ? { dept, activeTab, activeBuyer, page, limit, globalSearch: appliedSearch, scope: 'all' as const }
      : { dept, activeTab, activeBuyer, page, limit, globalSearch };
    const cached = findCachedPlanningPage(q);
    if (cached) {
      setOrders(cached.orders);
      setRowsFromAllLists(searchAll);
      setTotalPages(cached.totalPages);
      setTotalOrders(cached.total);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const requestId = ++latestRequestRef.current;
    try {
      const data = await fetchPlanningOrders(q);
      // A newer request (tab / page / search change) owns the table now
      if (requestId !== latestRequestRef.current) return;

      if (data) {
        if (data.buyers && data.buyers.length > 0) {
          setAvailableBuyers(data.buyers);
        }
        setOrders(data.orders);
        setRowsFromAllLists(searchAll);
        setTotalPages(data.totalPages);
        setTotalOrders(data.total);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // The typed search applies on submit (searchRun), not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dept, activeTab, activeBuyer, page, limit, searchRun]);

  const handleTabChange = (tab: PlanStatus | 'All') => {
    // A tab ends a search across all lists: the tab's own list shows again.
    if (searchAll) {
      setAppliedSearch('');
      setGlobalSearch('');
      saveDeptState(dept, { globalSearch: '' });
      setSearchRun((n) => n + 1);
    }
    setActiveTab(tab);
    setPage(1);
    saveDeptState(dept, { activeTab: tab, page: 1 });
  };

  const handleBuyerChange = (buyer: string) => {
    setActiveBuyer(buyer);
    setPage(1);
    saveDeptState(dept, { activeBuyer: buyer, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    saveDeptState(dept, { page: newPage });
  };

  const handleLimitChange = (newLimit: number | 'auto') => {
    setLimitChoice(newLimit);
    setPage(1);
    saveDeptState(dept, { limit: newLimit, page: 1 });
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    saveDeptState(dept, { globalSearch, page: 1 });
    setAppliedSearch(globalSearch);
    setSearchRun((n) => n + 1);
  };

  const clearGlobalSearch = () => {
    setGlobalSearch('');
    setAppliedSearch('');
    setColSearchOrder('');
    setColSearchDate('');
    setColSearchBuyer('');
    setColSearchStatus('');
    setActiveBuyer('');
    setActiveTab('Pending');
    setPage(1);
    saveDeptState(dept, {
      globalSearch: '',
      colSearchOrder: '',
      colSearchDate: '',
      colSearchBuyer: '',
      colSearchStatus: '',
      activeBuyer: '',
      activeTab: 'Pending',
      page: 1,
    });
    // The normal tab's list again (also when the tab and page did not change).
    setSearchRun((n) => n + 1);
  };

  const handleColSearchOrderChange = (val: string) => {
    setColSearchOrder(val);
    saveDeptState(dept, { colSearchOrder: val });
  };
  const handleColSearchDateChange = (val: string) => {
    setColSearchDate(val);
    saveDeptState(dept, { colSearchDate: val });
  };
  const handleColSearchBuyerChange = (val: string) => {
    setColSearchBuyer(val);
    saveDeptState(dept, { colSearchBuyer: val });
  };
  const handleColSearchStatusChange = (val: string) => {
    setColSearchStatus(val);
    saveDeptState(dept, { colSearchStatus: val });
  };

  // Client-side column filters matching Exp filterByColumn
  const displayedOrders = orders.filter((o) => {
    if (colSearchOrder && !String(o.orderNo || '').toLowerCase().includes(colSearchOrder.toLowerCase())) {
      return false;
    }
    if (colSearchDate) {
      const dStr = o.bookingDate ? formatDateDisplay(o.bookingDate).toLowerCase() : '';
      if (!dStr.includes(colSearchDate.toLowerCase())) return false;
    }
    if (colSearchBuyer && !String(o.buyer || '').toLowerCase().includes(colSearchBuyer.toLowerCase())) {
      return false;
    }
    if (colSearchStatus && !String(o.status || '').toLowerCase().includes(colSearchStatus.toLowerCase())) {
      return false;
    }
    return true;
  });  // At most one page of rows (a cached larger first page is cut to the page size); "Auto" rows fill the table area
  const visibleOrders = limit ? displayedOrders.slice(0, limit) : displayedOrders;
  const rowStyle = limitChoice === 'auto' && fit ? { height: fit.rowHeight } : undefined;


  // Download completed list Excel matching Exp downloadCompletedList
  // While a search across all lists runs, the table keeps the open lists' layout (with the Status column).
  const layoutTab = searchAll ? 'Pending' : activeTab;

  const downloadCompletedExcel = () => {
    const exportData = displayedOrders.map((o) => ({
      'Order/Booking No.': o.orderNo,
      'Completed Date': o.bookingDate ? formatDateDisplay(o.bookingDate) : 'N/A',
      Buyer: o.buyer || 'N/A',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Completed Orders');
    XLSX.writeFile(wb, `${dept}_Completed_Orders.xlsx`);
  };

  return (
    // The page fills the content area: the top bar and the pagination stay put, only the table rows scroll.
    <div className="flex h-full min-h-0 w-full max-w-[1850px] mx-auto flex-col gap-3 text-[11px] animate-fade-in">
      <h1 className="sr-only" data-page-title>
        {deptConfig.name}
      </h1>
      {/* Top Bar with Exact Exp Tabs and Compact Search (index.html lines 1245-1282); US-12: one lower row from md up */}
      <div data-list-topbar className="flex-none bg-white dark:bg-[#151921] border border-gray-200 dark:border-[#2a3346] rounded-sm p-1.5 shadow-sm">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
          {/* Left: 4 Exp Status Tabs */}
          <div className="flex flex-wrap sm:flex-nowrap gap-1 sm:gap-2">
            {[
              { id: 'Pending', label: 'Pending List' },
              { id: 'Confirm', label: 'Confirm List' },
              { id: 'Tentative', label: 'Tentative List' },
              { id: 'All', label: 'Completed List' },
            ].map((tab) => {
              const isActive = !searchAll && activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as any)}
                  className={`px-3 sm:px-4 py-1 font-bold rounded-sm cursor-pointer shadow-sm uppercase tracking-wide transition-colors text-[10px] sm:text-[11px] flex-1 sm:flex-none text-center ${
                    isActive
                      ? 'bg-[#313644] text-white'
                      : 'bg-white dark:bg-[#151921] text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-[#2a3346] hover:bg-gray-50 dark:hover:bg-[#1f2637]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Right: Compact Search Bar matching Exp */}
          <div className="flex flex-col sm:flex-row w-full md:w-auto items-stretch sm:items-center gap-2">
            <form
              onSubmit={handleGlobalSearch}
              className="flex items-center gap-1 bg-emerald-50/70 dark:bg-[#1e2330] border border-emerald-200 dark:border-[#2a3346] rounded p-0.5 px-1.5 flex-1 md:flex-none shadow-sm"
            >
              <Search className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 ml-1" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search Booking No..."
                className="w-full md:w-44 lg:w-56 px-2 py-0.5 border border-emerald-300 dark:border-[#2a3346] rounded text-xs focus:border-emerald-500 outline-none bg-white dark:bg-[#151921] text-gray-800 dark:text-gray-100"
              />
              <button
                type="submit"
                className="px-3 py-0.5 bg-emerald-600 text-white font-bold rounded shadow hover:bg-emerald-700 transition text-xs whitespace-nowrap"
              >
                Search
              </button>
              {(globalSearch || activeBuyer || colSearchOrder || colSearchDate || colSearchBuyer) && (
                <button
                  type="button"
                  onClick={clearGlobalSearch}
                  className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition text-xs"
                  title="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Horizontal Buyer Filter Pills Bar matching Exp buyerFilterContainer */}
        <div className="flex flex-nowrap gap-1.5 mt-1.5 overflow-x-auto custom-scrollbar pb-1 w-full border-t border-gray-100 dark:border-[#2a3346] pt-1.5">
          <button
            onClick={() => handleBuyerChange('')}
            className={`px-3 py-1 rounded text-xs font-bold transition whitespace-nowrap shadow-sm ${
              activeBuyer === ''
                ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                : 'bg-gray-100 dark:bg-[#1f2637] text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-[#2a3346] hover:bg-emerald-50/50 dark:hover:bg-[#283347]'
            }`}
          >
            ALL BUYERS ({availableBuyers.length})
          </button>
          {availableBuyers.map((b) => (
            <button
              key={b}
              onClick={() => handleBuyerChange(b === activeBuyer ? '' : b)}
              className={`px-3 py-1 rounded text-xs transition whitespace-nowrap font-medium ${
                activeBuyer === b
                  ? 'bg-emerald-600 text-white font-bold shadow-sm shadow-emerald-600/20'
                  : 'bg-gray-100 dark:bg-[#1f2637] text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-[#2a3346] hover:bg-emerald-50/50 dark:hover:bg-[#283347]'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table Container matching Exp dataTableContentWrapper */}
      <div className="border border-gray-300 dark:border-[#2a3346] w-full bg-white dark:bg-[#151921] rounded-sm shadow-sm overflow-hidden flex-1 min-h-0 relative flex flex-col">
        {loading && orders.length === 0 && (
          <LoadingSpinner message="Processing Department Data..." />
        )}
        {loading && orders.length > 0 && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500/20 overflow-hidden z-30 pointer-events-none">
            <div className="h-full bg-emerald-500 animate-pulse w-full"></div>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto custom-scrollbar w-full">
          <table className="w-full text-left whitespace-nowrap min-w-[1000px] border-collapse">
            {/* Header matching Exp thead with 2-tier search inputs */}
            <thead className="sticky top-0 z-20 bg-gray-100 dark:bg-[#1f2637] shadow-sm select-none">
              {layoutTab === 'All' ? (
                // Completed List View Table Header (index.html lines 309-322)
                <>
                  <tr className="bg-gray-800 text-white text-[11px] font-bold border-b border-gray-700">
                    <th className="p-2 border-r border-gray-700 text-center w-[120px]">
                      <button
                        onClick={downloadCompletedExcel}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded shadow text-[10px] font-bold flex items-center justify-center gap-1 mx-auto"
                      >
                        <FileSpreadsheet className="h-3 w-3" /> EXCEL
                      </button>
                    </th>
                    <th className="p-2 border-r border-gray-700">Order/Booking No.</th>
                    <th className="p-2 border-r border-gray-700 text-center">Completed Date</th>
                    <th className="p-2">Buyer</th>
                  </tr>
                  <tr className="bg-white dark:bg-[#151921] border-b border-gray-300 dark:border-[#2a3346]">
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] bg-white dark:bg-[#151921]"></th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] bg-white dark:bg-[#151921]">
                      <input
                        type="text"
                        value={colSearchOrder}
                        onChange={(e) => handleColSearchOrderChange(e.target.value)}
                        placeholder="Search No..."
                        className="w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] outline-none bg-gray-50 dark:bg-[#181f2c]"
                      />
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] bg-white dark:bg-[#151921]">
                      <input
                        type="text"
                        value={colSearchDate}
                        onChange={(e) => handleColSearchDateChange(e.target.value)}
                        placeholder="Search Date..."
                        className="w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] outline-none bg-gray-50 dark:bg-[#181f2c]"
                      />
                    </th>
                    <th className="p-1 bg-white dark:bg-[#151921]">
                      <input
                        type="text"
                        value={colSearchBuyer}
                        onChange={(e) => handleColSearchBuyerChange(e.target.value)}
                        placeholder="Search Buyer..."
                        className="w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] outline-none bg-gray-50 dark:bg-[#181f2c]"
                      />
                    </th>
                  </tr>
                </>
              ) : (
                // Active List View Table Header (index.html lines 353-366)
                <>
                  <tr className="text-gray-700 dark:text-gray-200 text-[11px] font-bold border-b border-gray-300 dark:border-[#2a3346]">
                    <th className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center w-[50px]">
                      Manage
                    </th>
                    <th className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
                      Order/Booking No.
                    </th>
                    <th className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                      Booking Date
                    </th>
                    <th className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-blue-700 dark:text-blue-400">
                      Buyer
                    </th>
                    <th className="p-2 border-r border-gray-300 dark:border-[#2a3346] w-[700px]">
                      Status
                    </th>
                  </tr>
                  <tr className="bg-white dark:bg-[#151921] border-b border-gray-300 dark:border-[#2a3346]">
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] bg-white dark:bg-[#151921]"></th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] bg-white dark:bg-[#151921]">
                      <input
                        type="text"
                        value={colSearchOrder}
                        onChange={(e) => handleColSearchOrderChange(e.target.value)}
                        placeholder="Search No..."
                        className="w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] outline-none bg-gray-50 dark:bg-[#181f2c]"
                      />
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] bg-white dark:bg-[#151921]">
                      <input
                        type="text"
                        value={colSearchDate}
                        onChange={(e) => handleColSearchDateChange(e.target.value)}
                        placeholder="Search Date..."
                        className="w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] outline-none bg-gray-50 dark:bg-[#181f2c]"
                      />
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] bg-white dark:bg-[#151921]">
                      <input
                        type="text"
                        value={colSearchBuyer}
                        onChange={(e) => handleColSearchBuyerChange(e.target.value)}
                        placeholder="Search Buyer..."
                        className="w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] outline-none bg-gray-50 dark:bg-[#181f2c]"
                      />
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] bg-white dark:bg-[#151921]">
                      <input
                        type="text"
                        value={colSearchStatus}
                        onChange={(e) => handleColSearchStatusChange(e.target.value)}
                        placeholder="Search Status..."
                        className="w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] outline-none bg-gray-50 dark:bg-[#181f2c]"
                      />
                    </th>
                  </tr>
                </>
              )}
            </thead>

            {/* Table Body */}
            <tbody className="text-gray-700 dark:text-gray-300 text-[11px] divide-y divide-gray-200 dark:divide-[#2a3346]">
              {!loading && visibleOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={layoutTab === 'All' ? 4 : 5}
                    className="p-10 text-center text-gray-500 bg-white dark:bg-[#151921]"
                  >
                    {searchAll ? 'No order found in any list.' : `No ${activeTab} data found.`}
                  </td>
                </tr>
              ) : (
                visibleOrders.map((o) => (
                  <tr
                    key={o._id || o.orderNo}
                    style={rowStyle}
                    className="hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 border-b border-gray-200 dark:border-[#2a3346] transition-colors bg-white dark:bg-[#151921]"
                  >
                    <td className="p-2 border-r border-gray-200 dark:border-[#2a3346] text-center">
                      <Link
                        href={`/planning/${dept}/${encodeURIComponent(o.orderNo)}`}
                        onMouseEnter={() => prefetchOrderDetail(dept, o.orderNo)}
                        className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded hover:bg-emerald-600 hover:text-white transition shadow-sm inline-flex items-center"
                        title="View/Edit detailed planning"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    </td>

                    <td className="p-2 border-r border-gray-200 dark:border-[#2a3346] text-emerald-700 dark:text-emerald-400 font-bold">
                      <Link
                        href={`/planning/${dept}/${encodeURIComponent(o.orderNo)}`}
                        onMouseEnter={() => prefetchOrderDetail(dept, o.orderNo)}
                        className="hover:underline"
                      >
                        {o.orderNo}
                      </Link>
                      {searchAll && rowsFromAllLists && <ListBadge status={o[`${dept}PlanStatus`]} />}
                    </td>

                    <td className="p-2 border-r border-gray-200 dark:border-[#2a3346] text-center">
                      {o.bookingDate ? formatDateDisplay(o.bookingDate) : 'N/A'}
                    </td>

                    <td className="p-2 border-r border-gray-200 dark:border-[#2a3346] font-medium text-gray-800 dark:text-gray-200">
                      {o.buyer || 'N/A'}
                    </td>

                    {layoutTab !== 'All' && (
                      <td className="p-2 border-r border-gray-200 dark:border-[#2a3346] text-gray-600 dark:text-gray-400 font-medium">
                        {o.status || 'N/A'}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Exact Exp Pagination Bar */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalOrders}
          limit={limit ?? fit?.rows ?? 10}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
          autoRows={fit?.rows}
          isAuto={limitChoice === 'auto'}
        />
      </div>
    </div>
  );
}

/** US-11: the list an order of a search across all lists is in (its plan status; Completed = the Completed List). */
function ListBadge({ status }: { status?: string }) {
  const value = status || 'Pending';
  return (
    <span data-list-badge={value} title={`In the ${value} List`} className={`badge badge-xs ml-2 font-semibold ${STATUS_COLORS[value] || 'badge-ghost'}`}>
      {value} List
    </span>
  );
}
