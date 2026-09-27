'use client';

import React, { useState, useEffect, use } from 'react';
import {
  Filter,
  Calendar,
  Download,
  Eye,
  Search,
  RefreshCw,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { API_BASE, DEPARTMENTS } from '@/lib/constants';
import { formatDateDisplay } from '@/lib/date-utils';

interface PageProps {
  params: Promise<{ dept: string }>;
}

const PF_CONFIGS: Record<string, { title: string; cols: string[] }> = {
  knitting: {
    title: 'Knitting Plan Filter',
    cols: [
      'OrderNo',
      'Buyer',
      'Color',
      'FabricConstruction',
      'GSM',
      'RequiredQtyKgs',
      'Allowance',
      'YarnReq',
      'AllocatedQty',
      'YarnBala',
      'GreyReq',
      'KnitProd',
      'KnitBala',
      'Plan Start Date',
      'Plan End Date',
      'Plan Type',
    ],
  },
  dyeing: {
    title: 'Dyeing Plan Filter',
    cols: [
      'OrderNo',
      'Buyer',
      'Color',
      'Unit',
      'ProcessName',
      'RequiredQtyKgs',
      'GreyReq',
      'KnitProd',
      'KnitBala',
      'BPQty',
      'DyeingProd',
      'DyeingBala',
      'Plan Start Date',
      'Plan End Date',
      'Plan Type',
    ],
  },
  delivery: {
    title: 'Delivery Plan Filter',
    cols: [
      'OrderNo',
      'Buyer',
      'Color',
      'FabricConstruction',
      'GSM',
      'RequiredQtyKgs',
      'NetReceivedQtyKgs',
      'NetDeliveryQtyKgs',
      'DeliBal',
      'RFD',
      'Slowmoving',
      'FFStock',
      'Plan Start Date',
      'Plan End Date',
      'Plan Type',
    ],
  },
  deliveryfloor: {
    title: 'Delivery Plan (Floor) Filter',
    cols: [
      'OrderNo',
      'Buyer',
      'Color',
      'FabricConstruction',
      'GSM',
      'RequiredQtyKgs',
      'NetReceivedQtyKgs',
      'NetDeliveryQtyKgs',
      'DeliBal',
      'RFD',
      'Slowmoving',
      'FFStock',
      'Plan Start Date',
      'Plan End Date',
      'Plan Type',
    ],
  },
  yd: {
    title: 'YD Plan Filter',
    cols: [
      'OrderNo',
      'Buyer',
      'Booking Type',
      'YDB',
      'YD Booking Date',
      'Barrier Qty.',
      'Workable Qty.',
      'YD REQ.',
      'DYED',
      'YD BALANCE',
      'YD Delivered',
      'YD DELIVERY BALANCE',
      'Plan Start Date',
      'Plan End Date',
      'Plan Type',
    ],
  },
};

function parseShortDateToISO(dateStr?: string): string {
  if (!dateStr || dateStr === '-' || dateStr === 'N/A') return '';
  const parts = dateStr.split('-');
  if (parts.length === 2) {
    const day = parseInt(parts[0], 10);
    const months: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    const month = months[parts[1].trim()];
    if (month !== undefined && !isNaN(day)) {
      const year = new Date().getFullYear();
      const dt = new Date(year, month, day);
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${dt.getFullYear()}-${mm}-${dd}`;
    }
  }

  const dt = new Date(dateStr);
  if (!isNaN(dt.getTime())) {
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${dt.getFullYear()}-${mm}-${dd}`;
  }
  return '';
}

function getColData(item: any, possibleKeys: string[]) {
  if (!item) return '';
  const data = item.itemData || item;
  for (const k of possibleKeys) {
    if (data[k] !== undefined && data[k] !== null && String(data[k]).trim() !== '') {
      return String(data[k]).trim();
    }
    if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
      return String(item[k]).trim();
    }
  }
  return '';
}

export default function PlanFilterPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const dept = resolvedParams.dept || 'knitting';
  const config = PF_CONFIGS[dept] || PF_CONFIGS.knitting;
  const deptConfig = DEPARTMENTS[dept] || { name: `${dept.toUpperCase()} Plan Filter` };

  // Form State
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmt = (d: Date) => {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  };

  const [fromDate, setFromDate] = useState(fmt(firstDay));
  const [toDate, setToDate] = useState(fmt(today));
  const [dateType, setDateType] = useState<'start' | 'end'>('start');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Confirm' | 'Tentative'>('All');

  // Buyers
  const [allBuyers, setAllBuyers] = useState<string[]>([]);
  const [selectedBuyers, setSelectedBuyers] = useState<string[]>([]);
  const [buyerDropdownOpen, setBuyerDropdownOpen] = useState(false);
  const [buyerSearch, setBuyerSearch] = useState('');

  // Data
  const [allRows, setAllRows] = useState<any[]>([]);
  const [filteredRows, setFilteredRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch plan filter data
  const fetchData = async () => {
    setLoading(true);
    const rows: any[] = [];
    const buyersSet = new Set<string>();

    try {
      const token = localStorage.getItem('token');
      const dbDeptKey = dept === 'deliveryfloor' ? 'delivery' : dept;

      // 1. Fetch tracking data
      const res = await fetch(`${API_BASE}/api/orders/tracking/${dbDeptKey}?all=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const { planDocs = [], orderMap = {} } = data;
        const loadedOrderNos = new Set<string>();

        planDocs.forEach((plan: any) => {
          const deptItems = plan[dbDeptKey];
          if (deptItems && Array.isArray(deptItems)) {
            deptItems.forEach((item: any) => {
              const planType = dept === 'deliveryfloor' ? item.floorPlanType : item.planType;
              if (planType === 'Confirm' || planType === 'Tentative') {
                loadedOrderNos.add(plan.orderNo);
                const orderInfo = orderMap[plan.orderNo] || {};
                const displayBuyer = orderInfo.buyer || plan.buyer || 'N/A';
                if (displayBuyer && displayBuyer !== 'N/A') buyersSet.add(displayBuyer.trim().toUpperCase());

                const sd = dept === 'deliveryfloor' ? item.floorStartDate : item.startDate;
                const ed = dept === 'deliveryfloor' ? item.floorEndDate : item.endDate;

                const row: any = {
                  OrderNo: plan.orderNo,
                  Buyer: displayBuyer,
                  Color: plan.color || getColData(item, ['Color', 'Colour', 'Fab Color']) || 'N/A',
                  ...(item.itemData || {}),
                  ...item,
                  'Plan Start Date': sd || '',
                  'Plan End Date': ed || '',
                  'Plan Type': planType,
                  _start: parseShortDateToISO(sd),
                  _end: parseShortDateToISO(ed),
                };
                rows.push(row);
              }
            });
          }
        });

        // 2. Fetch tentative orders
        try {
          const tRes = await fetch(
            `${API_BASE}/api/orders?dept=${dbDeptKey}&status=Tentative&limit=5000&populateItems=true`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (tRes.ok) {
            const tData = await tRes.json();
            (tData.orders || []).forEach((order: any) => {
              if (loadedOrderNos.has(order.orderNo)) return;
              if (order.buyer) buyersSet.add(order.buyer.trim().toUpperCase());

              const items = order[`${dbDeptKey}Items`] || [];
              items.forEach((item: any) => {
                let sd = '';
                let ed = '';
                if (dept === 'knitting') { sd = order.knitStart; ed = order.knitEnd; }
                else if (dept === 'dyeing') { sd = order.dyeStart; ed = order.dyeEnd; }
                else if (dept === 'delivery' || dept === 'deliveryfloor') { sd = order.deliStart; ed = order.deliEnd; }
                else if (dept === 'yd') { sd = order.ydStart; ed = order.ydEnd; }

                const row: any = {
                  OrderNo: order.orderNo,
                  Buyer: order.buyer || 'N/A',
                  Color: getColData(item, ['Color', 'Colour', 'Fab Color']) || 'N/A',
                  FabricConstruction: getColData(item, ['FabricConstruction', 'Construction', 'Fab Const', 'Fabric']),
                  GSM: getColData(item, ['GSM', 'G.S.M']),
                  RequiredQtyKgs: getColData(item, ['RequiredQtyKgs', 'Req Qty', 'Qty']),
                  Allowance: getColData(item, ['Allowance']),
                  YarnReq: getColData(item, ['YarnReq', 'Yarn Req', 'Yarn Req.']),
                  AllocatedQty: getColData(item, ['AllocatedQty', 'Allocated Qty', 'Allocated']),
                  YarnBala: getColData(item, ['YarnBala', 'Yarn Bala', 'Yarn Bala.']),
                  GreyReq: getColData(item, ['Grey Req.', 'GreyReq']),
                  KnitProd: getColData(item, ['Knit Prod.', 'KnitProd']),
                  KnitBala: getColData(item, ['Knit. Bala.', 'KnitBala']),
                  Unit: getColData(item, ['Unit']),
                  ProcessName: getColData(item, ['Process Name', 'ProcessName', 'Process']),
                  BPQty: getColData(item, ['BP Qty', 'BPQty']),
                  DyeingProd: getColData(item, ['Dyeing Prod.', 'DyeingProd']),
                  DyeingBala: getColData(item, ['Dyeing Bala.', 'DyeingBala']),
                  NetReceivedQtyKgs: getColData(item, ['NetReceivedQtyKgs', 'NetReceivedQty']),
                  NetDeliveryQtyKgs: getColData(item, ['NetDeliveryQtyKgs', 'NetDeliveryQty', 'DeliveryQty']),
                  DeliBal: getColData(item, ['Deli. Bal.', 'Deli Bal.', 'DeliBal', 'Deli. Bala.', 'Delivery Balance']),
                  RFD: getColData(item, ['RFD']),
                  Slowmoving: getColData(item, ['Slowmoving']),
                  FFStock: getColData(item, ['FFStock', 'FF Stock']),
                  'Booking Type': getColData(item, ['Booking Type', 'Type', 'YD Type']),
                  YDB: getColData(item, ['YDB', 'YD B']),
                  'YD Booking Date': getColData(item, ['YD Booking Date']),
                  'Barrier Qty.': getColData(item, ['Barrier Qty.', 'Barrier Qty']),
                  'Workable Qty.': getColData(item, ['Workable Qty.', 'Workable Qty']),
                  'YD REQ.': getColData(item, ['YD REQ.', 'YD REQ', 'Requirement']),
                  DYED: getColData(item, ['DYED', 'Dyed']),
                  'YD BALANCE': getColData(item, ['YD BALANCE', 'YD Balance']),
                  'YD Delivered': getColData(item, ['YD Delivered', 'Delivered']),
                  'YD DELIVERY BALANCE': getColData(item, ['YD DELIVERY BALANCE', 'YD Balance_1', 'YD Delivery Balance']),
                  'Plan Start Date': sd || '',
                  'Plan End Date': ed || '',
                  'Plan Type': 'Tentative',
                  _start: parseShortDateToISO(sd),
                  _end: parseShortDateToISO(ed),
                };
                rows.push(row);
              });
            });
          }
        } catch {}
      }

      setAllRows(rows);
      setAllBuyers(Array.from(buyersSet).sort());
    } catch (err) {
      console.error('Error fetching plan filter data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dept]);

  // Handle Filtering
  const handlePreview = () => {
    if (!fromDate || !toDate) {
      alert('Please select both From and To dates.');
      return;
    }

    const buyerSet = new Set(selectedBuyers.map((b) => b.trim().toUpperCase()));

    const filtered = allRows.filter((r) => {
      const dt = dateType === 'start' ? r._start : r._end;
      const bNorm = r.Buyer ? r.Buyer.trim().toUpperCase() : '';

      // Date check
      if (!dt || dt < fromDate || dt > toDate) return false;

      // Buyer check
      if (buyerSet.size > 0 && !buyerSet.has(bNorm)) return false;

      // Plan Type check
      if (statusFilter !== 'All' && r['Plan Type'] !== statusFilter) return false;

      // Search term
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const oMatch = String(r.OrderNo || '').toLowerCase().includes(q);
        const bMatch = String(r.Buyer || '').toLowerCase().includes(q);
        const cMatch = String(r.Color || '').toLowerCase().includes(q);
        if (!oMatch && !bMatch && !cMatch) return false;
      }

      return true;
    });

    setFilteredRows(filtered);
    setPreviewOpen(true);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      alert('No data to export.');
      return;
    }

    const cols = config.cols;
    const exportData = filteredRows.map((r) => {
      const rowObj: Record<string, any> = {};
      cols.forEach((c) => {
        rowObj[c] = r[c] ?? '';
      });
      return rowObj;
    });

    const ws = XLSX.utils.json_to_sheet(exportData, { header: cols });
    ws['!cols'] = cols.map((c) => ({ wch: Math.max(12, Math.min(26, c.length + 3)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${dept.toUpperCase()} Plan Filter`);
    XLSX.writeFile(wb, `${dept}_plan_filter_${Date.now()}.xlsx`);
  };

  const filteredBuyerOptions = allBuyers.filter((b) =>
    b.toLowerCase().includes(buyerSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Filter className="h-6 w-6 text-primary" />
            {config.title}
          </h2>
          <p className="text-xs text-base-content/60">
            Multi-criteria date range and buyer filtering engine across all confirmed and tentative plans.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="btn btn-outline btn-sm gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* Filter Builder Card */}
      <div className="card bg-base-100 border border-base-300 p-5 shadow-sm space-y-5">
        <h3 className="font-bold text-sm text-base-content/80 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Filter Parameters
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* From Date */}
          <div>
            <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                if (toDate && toDate < e.target.value) setToDate(e.target.value);
              }}
              className="input input-bordered input-sm w-full"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input input-bordered input-sm w-full"
            />
          </div>

          {/* Date Type Selector */}
          <div>
            <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
              Filter By Date Field
            </label>
            <select
              value={dateType}
              onChange={(e) => setDateType(e.target.value as any)}
              className="select select-bordered select-sm w-full"
            >
              <option value="start">Plan Start Date</option>
              <option value="end">Plan End Date</option>
            </select>
          </div>

          {/* Plan Status */}
          <div>
            <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
              Plan Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="select select-bordered select-sm w-full"
            >
              <option value="All">All Plans (Confirm & Tentative)</option>
              <option value="Confirm">Confirm Only</option>
              <option value="Tentative">Tentative Only</option>
            </select>
          </div>
        </div>

        {/* Second Row: Buyer Filter Dropdown & Search */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-base-200">
          {/* Buyer Multi-select */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
              Buyer Selection ({selectedBuyers.length === 0 ? 'All Buyers' : `${selectedBuyers.length} Selected`})
            </label>
            <button
              type="button"
              onClick={() => setBuyerDropdownOpen(!buyerDropdownOpen)}
              className="btn btn-outline btn-sm w-full justify-between font-normal text-xs"
            >
              <span className="truncate">
                {selectedBuyers.length === 0
                  ? 'All Buyers (Click to filter)'
                  : selectedBuyers.length <= 2
                  ? selectedBuyers.join(', ')
                  : `${selectedBuyers.length} Buyers Selected`}
              </span>
              <Building2 className="h-4 w-4 ml-2 opacity-50 shrink-0" />
            </button>

            {buyerDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full bg-base-100 border border-base-300 rounded-lg shadow-xl p-3 max-h-64 flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Search buyer name..."
                  value={buyerSearch}
                  onChange={(e) => setBuyerSearch(e.target.value)}
                  className="input input-bordered input-xs w-full"
                />
                <div className="flex items-center justify-between text-[11px] pb-1 border-b border-base-200 font-bold">
                  <button
                    type="button"
                    onClick={() => setSelectedBuyers([])}
                    className="text-primary hover:underline"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBuyers(allBuyers)}
                    className="text-base-content/60 hover:underline"
                  >
                    Check All
                  </button>
                </div>
                <div className="overflow-y-auto max-h-40 space-y-1 custom-scrollbar">
                  {filteredBuyerOptions.map((b) => (
                    <label key={b} className="flex items-center gap-2 p-1 rounded hover:bg-base-200 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedBuyers.includes(b)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedBuyers([...selectedBuyers, b]);
                          else setSelectedBuyers(selectedBuyers.filter((x) => x !== b));
                        }}
                        className="checkbox checkbox-xs checkbox-primary"
                      />
                      <span className="truncate">{b}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Search inside preview */}
          <div>
            <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
              Order / Style / Color Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-base-content/40" />
              <input
                type="text"
                placeholder="Optional keyword filter..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input input-bordered input-sm w-full pl-9"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-xs text-base-content/60">
            Total records loaded in cache: <span className="font-bold text-primary">{allRows.length}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePreview}
              disabled={loading}
              className="btn btn-primary btn-sm gap-2 font-bold shadow-md shadow-primary/20"
            >
              <Eye className="h-4 w-4" />
              Preview Filtered Plan
            </button>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      {previewOpen && (
        <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-base-200">
            <div>
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-success" />
                Filtered Plan Preview ({filteredRows.length} records)
              </h3>
              <p className="text-xs text-base-content/60">
                {dateType === 'start' ? 'Plan Start Date' : 'Plan End Date'}: {fromDate} to {toDate} |{' '}
                {selectedBuyers.length === 0 ? 'All Buyers' : selectedBuyers.join(', ')} | Status: {statusFilter}
              </p>
            </div>

            <button
              onClick={handleExportExcel}
              disabled={filteredRows.length === 0}
              className="btn btn-success text-white btn-sm gap-2 font-bold shadow-md"
            >
              <Download className="h-4 w-4" />
              Export Excel ({filteredRows.length})
            </button>
          </div>

          {filteredRows.length === 0 ? (
            <div className="p-10 text-center text-base-content/50">
              No matching records found for the selected date range and parameters.
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
              <table className="table table-xs table-pin-rows table-pin-cols w-full border border-base-300">
                <thead className="bg-base-200 text-base-content font-bold">
                  <tr>
                    <th className="text-center w-12">#</th>
                    {config.cols.map((col) => (
                      <th key={col} className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, i) => (
                    <tr key={i} className="hover:bg-base-200/50 transition-colors border-b border-base-200">
                      <td className="text-center font-bold text-base-content/50 border-r border-base-300">{i + 1}</td>
                      {config.cols.map((col) => {
                        const val = r[col];
                        const isDate = col.includes('Date');
                        const isType = col === 'Plan Type';

                        return (
                          <td
                            key={col}
                            className={`px-3 py-1.5 text-center whitespace-nowrap border-r border-base-200 ${
                              col === 'OrderNo' ? 'font-bold text-primary' : ''
                            }`}
                          >
                            {isType ? (
                              <span
                                className={`badge badge-xs font-bold ${
                                  val === 'Confirm' ? 'badge-success text-white' : 'badge-warning'
                                }`}
                              >
                                {val}
                              </span>
                            ) : isDate ? (
                              formatDateDisplay(val) || '—'
                            ) : (
                              val ?? '—'
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
