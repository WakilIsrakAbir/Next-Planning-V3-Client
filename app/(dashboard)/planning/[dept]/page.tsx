'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Search,
  Eye,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { API_BASE, DEPARTMENTS } from '@/lib/constants';
import { formatDateDisplay } from '@/lib/date-utils';
import { PlanStatus } from '@/types/order';
import ExpLoadingSpinner from '@/components/common/ExpLoadingSpinner';
import ExpPagination from '@/components/common/ExpPagination';
import {
  cachedPlanningOrders,
  cachedDeptBuyers,
  prefetchOrderDetail,
  getSavedDeptState,
  saveDeptState,
} from '@/lib/planning-cache';

interface PageProps {
  params: Promise<{ dept: string }>;
}

export default function DepartmentPlanningPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const dept = resolvedParams.dept || 'knitting';
  const deptConfig = DEPARTMENTS[dept] || { name: `${dept.toUpperCase()} Plan` };

  const savedState = getSavedDeptState(dept);

  const [activeTab, setActiveTab] = useState<PlanStatus | 'All'>(() => savedState.activeTab);
  const [globalSearch, setGlobalSearch] = useState(() => savedState.globalSearch);
  const [activeBuyer, setActiveBuyer] = useState(() => savedState.activeBuyer);
  const [page, setPage] = useState(() => savedState.page);
  const [limit, setLimit] = useState(() => savedState.limit);

  const initialKey = `${dept}_${savedState.activeTab}_${savedState.activeBuyer}_${savedState.page}_${savedState.limit}_${savedState.globalSearch}`;
  const initialCache = cachedPlanningOrders[initialKey] || cachedPlanningOrders[`${dept}_Pending__1_10_`];

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

  // Synchronize state immediately whenever dept changes (Exp matching 0ms instant display)
  useEffect(() => {
    const s = getSavedDeptState(dept);
    setActiveBuyer(s.activeBuyer);
    setActiveTab(s.activeTab);
    setPage(s.page);
    setLimit(s.limit);
    setGlobalSearch(s.globalSearch);
    setColSearchOrder(s.colSearchOrder);
    setColSearchDate(s.colSearchDate);
    setColSearchBuyer(s.colSearchBuyer);
    setColSearchStatus(s.colSearchStatus);

    const key = `${dept}_${s.activeTab}_${s.activeBuyer}_${s.page}_${s.limit}_${s.globalSearch}`;
    const cached = cachedPlanningOrders[key] || cachedPlanningOrders[`${dept}_Pending__1_10_`];
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
  }, [dept]);

  // Fetch paginated department orders with SWR (Single combined call matching Exp)
  const fetchOrders = async () => {
    const key = `${dept}_${activeTab}_${activeBuyer}_${page}_${limit}_${globalSearch}`;
    if (cachedPlanningOrders[key]) {
      setOrders(cachedPlanningOrders[key].orders);
      setTotalPages(cachedPlanningOrders[key].totalPages);
      setTotalOrders(cachedPlanningOrders[key].total);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const token = localStorage.getItem('token');
      const statusParam = activeTab === 'All' ? 'Completed' : activeTab;
      const query = new URLSearchParams({
        dept,
        status: statusParam,
        buyer: activeBuyer,
        page: String(page),
        limit: String(limit),
        search: globalSearch,
      });

      const res = await fetch(`${API_BASE}/api/orders?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const ords = data.orders || [];
        const tPages = data.totalPages || 1;
        const total = data.total || 0;
        const buyers = data.buyers || [];

        cachedPlanningOrders[key] = { orders: ords, totalPages: tPages, total, buyers };
        if (buyers.length > 0) {
          cachedDeptBuyers[dept] = buyers;
          setAvailableBuyers(buyers);
        }
        setOrders(ords);
        setTotalPages(tPages);
        setTotalOrders(total);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [dept, activeTab, activeBuyer, page, limit]);

  const handleTabChange = (tab: PlanStatus | 'All') => {
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

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    saveDeptState(dept, { limit: newLimit, page: 1 });
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    saveDeptState(dept, { globalSearch, page: 1 });
    fetchOrders();
  };

  const clearGlobalSearch = () => {
    setGlobalSearch('');
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
  });

  // Download completed list Excel matching Exp downloadCompletedList
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
    <div className="space-y-3 pb-16 max-w-[1850px] mx-auto text-[11px] animate-fade-in">
      {/* Top Bar with Exact Exp Tabs and Compact Search (index.html lines 1245-1282) */}
      <div className="bg-white dark:bg-[#151921] border border-gray-200 dark:border-[#2a3346] rounded-sm p-2 shadow-sm">
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          {/* Left: 4 Exp Status Tabs */}
          <div className="flex flex-wrap sm:flex-nowrap gap-1 sm:gap-2">
            {[
              { id: 'Pending', label: 'Pending List' },
              { id: 'Confirm', label: 'Confirm List' },
              { id: 'Tentative', label: 'Tentative List' },
              { id: 'All', label: 'Completed List' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as any)}
                  className={`px-3 sm:px-6 py-1.5 sm:py-2 font-bold rounded-sm cursor-pointer shadow-sm uppercase tracking-wide transition-colors text-[10px] sm:text-[12px] flex-1 sm:flex-none text-center ${
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
          <div className="flex flex-col sm:flex-row w-full xl:w-auto items-stretch sm:items-center gap-2">
            <form
              onSubmit={handleGlobalSearch}
              className="flex items-center gap-1 bg-emerald-50/70 dark:bg-[#1e2330] border border-emerald-200 dark:border-[#2a3346] rounded p-1 px-2 flex-1 xl:flex-none shadow-sm"
            >
              <Search className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 ml-1" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search Booking No..."
                className="w-full xl:w-56 px-2 py-1 border border-emerald-300 dark:border-[#2a3346] rounded text-xs focus:border-emerald-500 outline-none bg-white dark:bg-[#151921] text-gray-800 dark:text-gray-100"
              />
              <button
                type="submit"
                className="px-3 py-1 bg-emerald-600 text-white font-bold rounded shadow hover:bg-emerald-700 transition text-xs whitespace-nowrap"
              >
                Search
              </button>
              {(globalSearch || activeBuyer || colSearchOrder || colSearchDate || colSearchBuyer) && (
                <button
                  type="button"
                  onClick={clearGlobalSearch}
                  className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition text-xs"
                  title="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Horizontal Buyer Filter Pills Bar matching Exp buyerFilterContainer */}
        <div className="flex flex-nowrap gap-1.5 mt-2.5 overflow-x-auto custom-scrollbar pb-1 w-full border-t border-gray-100 dark:border-[#2a3346] pt-2">
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
      <div className="border border-gray-300 dark:border-[#2a3346] w-full bg-white dark:bg-[#151921] rounded-sm shadow-sm overflow-hidden min-h-[380px] relative flex flex-col">
        {loading && orders.length === 0 && (
          <ExpLoadingSpinner message="Processing Department Data..." />
        )}
        {loading && orders.length > 0 && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500/20 overflow-hidden z-30 pointer-events-none">
            <div className="h-full bg-emerald-500 animate-pulse w-full"></div>
          </div>
        )}

        <div className="flex-1 overflow-auto custom-scrollbar w-full">
          <table className="w-full text-left whitespace-nowrap min-w-[1000px] border-collapse">
            {/* Header matching Exp thead with 2-tier search inputs */}
            <thead className="sticky top-0 z-20 bg-gray-100 dark:bg-[#1f2637] shadow-sm select-none">
              {activeTab === 'All' ? (
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
              {!loading && displayedOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeTab === 'All' ? 4 : 5}
                    className="p-10 text-center text-gray-500 bg-white dark:bg-[#151921]"
                  >
                    No {activeTab} data found.
                  </td>
                </tr>
              ) : (
                displayedOrders.map((o) => (
                  <tr
                    key={o._id || o.orderNo}
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
                    </td>

                    <td className="p-2 border-r border-gray-200 dark:border-[#2a3346] text-center">
                      {o.bookingDate ? formatDateDisplay(o.bookingDate) : 'N/A'}
                    </td>

                    <td className="p-2 border-r border-gray-200 dark:border-[#2a3346] font-medium text-gray-800 dark:text-gray-200">
                      {o.buyer || 'N/A'}
                    </td>

                    {activeTab !== 'All' && (
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
        <ExpPagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalOrders}
          limit={limit}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
      </div>
    </div>
  );
}
