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
  Factory,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { API_BASE } from '@/lib/constants';
import { formatDateDisplay } from '@/lib/date-utils';
import { getColData } from '@/lib/data-utils';
import {
  buildUnitOptions,
  createUnitMatcher,
  fetchActiveMasterUnits,
  formatUnitLabel,
  formatUnitList,
} from '@/lib/filter-utils';

interface PageProps {
  params: Promise<{ dept: string }>;
}

type Cell = string | number | boolean | null | undefined;
type PfRow = Record<string, Cell>;
type JsonObject = Record<string, unknown>;

interface PlanItem {
  itemData?: JsonObject;
  planType?: string;
  floorPlanType?: string;
  startDate?: string;
  endDate?: string;
  floorStartDate?: string;
  floorEndDate?: string;
  [key: string]: unknown;
}

interface PlanDoc {
  orderNo: string;
  buyer?: string;
  color?: string;
  [key: string]: unknown;
}

interface OrderInfo {
  orderNo?: string;
  buyer?: string;
  floor?: string;
  programType?: string;
  knitStart?: string;
  knitEnd?: string;
  dyeStart?: string;
  dyeEnd?: string;
  deliStart?: string;
  deliEnd?: string;
  ydStart?: string;
  ydEnd?: string;
  [key: string]: unknown;
}

interface PfDataset {
  rows: PfRow[];
  buyers: string[];
  /** Unit filter options (only filled for departments with the Unit filter). */
  units: string[];
}

/** Departments that get the Unit filter (legacy: Dyeing Plan Filter only). */
const PF_UNIT_FILTER_DEPTS = new Set(['dyeing']);

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
      'Allowance',
      'YarnReq',
      'AllocatedQty',
      'YarnBala',
      'GreyReq',
      'KnitProd',
      'KnitBala',
      'BPQty',
      'DyeingProd',
      'DyeingBala',
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
  delivery: {
    title: 'Delivery Plan Filter',
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
      'BPQty',
      'DyeingProd',
      'DyeingBala',
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

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Normalizes an item into the Plan Filter column names (legacy plan-filter.js
 * column mappings, including the Unit / ProcessName fallbacks to the order's
 * floor / programType and the DeliBal = RequiredQtyKgs - NetDeliveryQtyKgs fallback).
 */
function buildPfRow(
  src: JsonObject,
  base: {
    orderNo: string;
    buyer: string;
    colorFallback?: string;
    unitFallback?: string;
    processFallback?: string;
  }
): PfRow {
  const col = (keys: string[]): Cell => getColData(src, keys);

  const row: PfRow = {
    OrderNo: base.orderNo,
    Buyer: base.buyer,
    Color: col(['Color', 'Colour', 'Fab Color']) || base.colorFallback || 'N/A',
    FabricConstruction: col(['FabricConstruction', 'Construction', 'Fab Const', 'Fabric']),
    GSM: col(['GSM', 'G.S.M']),
    RequiredQtyKgs: col(['RequiredQtyKgs', 'Req Qty', 'Qty', 'Order Qty']),
    Allowance: col(['Allowance %', 'Allowance', 'Wastage %', 'Wastage', 'Allow %', 'Allow']),
    YarnReq: col(['Yarn req.', 'YarnReq', 'Yarn Req', 'Yarn Req.']),
    AllocatedQty: col(['Allocated Qty', 'Allocated Qty ', 'AllocatedQty', 'Alloc Qty']),
    YarnBala: col(['Yarn bala.', 'YarnBala', 'Yarn Bala', 'Yarn Balance']),
    GreyReq: col(['Grey Req.', 'GreyReq', 'Grey Req']),
    KnitProd: col(['Knit Prod.', 'KnitProd', 'Knit Prod', 'Knit Production']),
    KnitBala: col(['Knit. Bala.', 'KnitBala', 'Knit Bala.', 'Knit Bala', 'Knit. Bal.']),
    Unit: col(['Unit']) || base.unitFallback || 'N/A',
    ProcessName: col(['Process Name', 'ProcessName', 'Process']) || base.processFallback || 'N/A',
    BPQty: col(['BP Qty', 'BPQty', 'BP_Qty']),
    DyeingProd: col(['Dyeing Prod.', 'DyeingProd', 'Dyeing Prod', 'Dyeing ok', 'Dyeing Production']),
    DyeingBala: col(['Dyeing Bala.', 'DyeingBala', 'Dyeing Bala', 'Dyeing Bal.']),
    NetReceivedQtyKgs: col(['NetReceivedQtyKgs', 'NetReceivedQty', 'ReceivedQty']),
    NetDeliveryQtyKgs: col(['NetDeliveryQtyKgs', 'NetDeliveryQty', 'DeliveryQty']),
    DeliBal: col(['Deli. Bal.', 'Deli Bal.', 'DeliBal', 'Delivery Balance', 'Deli. Bala.']),
    RFD: col(['RFD']),
    Slowmoving: col(['Slowmoving', 'Slow Moving']),
    FFStock: col(['FFStock', 'FF Stock', 'FF_Stock']),
    // YD fields
    'Booking Type': col(['Booking Type', 'Type', 'YD Type']),
    YDB: col(['YDB', 'YD B']),
    'YD Booking Date': col(['YD Booking Date']),
    'Barrier Qty.': col(['Barrier Qty.', 'Barrier Qty']),
    'Workable Qty.': col(['Workable Qty.', 'Workable Qty']),
    'YD REQ.': col(['YD REQ.', 'YD REQ', 'Requirement']),
    DYED: col(['DYED', 'Dyed']),
    'YD BALANCE': col(['YD BALANCE', 'YD Balance']),
    'YD Delivered': col(['YD Delivered', 'Delivered']),
    'YD DELIVERY BALANCE': col(['YD DELIVERY BALANCE', 'YD Balance_1', 'YD Delivery Balance']),
  };

  if (!row.DeliBal || Number(row.DeliBal) === 0) {
    const req = Number(row.RequiredQtyKgs) || 0;
    const del = Number(row.NetDeliveryQtyKgs) || 0;
    if (req > 0 && del > 0) row.DeliBal = req - del;
  }

  return row;
}

const cachedPlanFilterData: Record<string, PfDataset> = {};

/**
 * Loads (or returns the cached) Plan Filter rows, buyers and Unit options for a department.
 * Never throws: on failure it returns an empty, uncached dataset.
 */
async function loadPlanFilterData(dept: string, forceRefresh = false): Promise<PfDataset> {
  if (!forceRefresh && cachedPlanFilterData[dept]) return cachedPlanFilterData[dept];

  const rows: PfRow[] = [];
  const buyersSet = new Set<string>();
  const hasUnitFilter = PF_UNIT_FILTER_DEPTS.has(dept);

  try {
    const token = localStorage.getItem('token');
    const dbDeptKey = dept === 'deliveryfloor' ? 'delivery' : dept;

    // Active units from the dropdown master (legacy dropdownMasterCache), fetched in parallel.
    const masterUnitsPromise = hasUnitFilter ? fetchActiveMasterUnits() : Promise.resolve<string[]>([]);

    // 1. Fetch tracking data
    const res = await fetch(`${API_BASE}/api/orders/tracking/${dbDeptKey}?all=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return { rows: [], buyers: [], units: [] };

    const data = (await res.json()) as { planDocs?: PlanDoc[]; orderMap?: Record<string, OrderInfo> };
    const planDocs = asArray<PlanDoc>(data.planDocs);
    const orderMap = data.orderMap || {};
    const loadedOrderNos = new Set<string>();

    planDocs.forEach((plan) => {
      asArray<PlanItem>(plan[dbDeptKey]).forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const planType = dept === 'deliveryfloor' ? item.floorPlanType : item.planType;
        if (planType !== 'Confirm' && planType !== 'Tentative') return;

        loadedOrderNos.add(plan.orderNo);
        const orderInfo = orderMap[plan.orderNo] || {};
        const displayBuyer = String(orderInfo.buyer || plan.buyer || 'N/A');
        if (displayBuyer && displayBuyer !== 'N/A') buyersSet.add(displayBuyer.trim().toUpperCase());

        const sd = dept === 'deliveryfloor' ? item.floorStartDate : item.startDate;
        const ed = dept === 'deliveryfloor' ? item.floorEndDate : item.endDate;

        const row = buildPfRow(
          { ...(item.itemData || {}), ...item },
          {
            orderNo: plan.orderNo,
            buyer: displayBuyer,
            colorFallback: plan.color,
            unitFallback: orderInfo.floor,
            processFallback: orderInfo.programType,
          }
        );
        row['Plan Start Date'] = sd || '';
        row['Plan End Date'] = ed || '';
        row['Plan Type'] = planType;
        row._start = parseShortDateToISO(sd);
        row._end = parseShortDateToISO(ed);
        rows.push(row);
      });
    });

    // 2. Fetch tentative orders
    try {
      const tRes = await fetch(
        `${API_BASE}/api/orders?dept=${dbDeptKey}&status=Tentative&limit=5000&populateItems=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (tRes.ok) {
        const tData = (await tRes.json()) as { orders?: OrderInfo[] };
        asArray<OrderInfo>(tData.orders).forEach((order) => {
          const orderNo = String(order.orderNo ?? '');
          if (loadedOrderNos.has(orderNo)) return;
          if (order.buyer) buyersSet.add(order.buyer.trim().toUpperCase());

          let sd: string | undefined = '';
          let ed: string | undefined = '';
          if (dept === 'knitting') { sd = order.knitStart; ed = order.knitEnd; }
          else if (dept === 'dyeing') { sd = order.dyeStart; ed = order.dyeEnd; }
          else if (dept === 'delivery' || dept === 'deliveryfloor') { sd = order.deliStart; ed = order.deliEnd; }
          else if (dept === 'yd') { sd = order.ydStart; ed = order.ydEnd; }

          asArray<JsonObject>(order[`${dbDeptKey}Items`]).forEach((item) => {
            if (!item || typeof item !== 'object') return;
            const row = buildPfRow(item, {
              orderNo,
              buyer: order.buyer || 'N/A',
              unitFallback: order.floor,
              processFallback: order.programType,
            });
            row['Plan Start Date'] = sd || '';
            row['Plan End Date'] = ed || '';
            row['Plan Type'] = 'Tentative';
            row._start = parseShortDateToISO(sd);
            row._end = parseShortDateToISO(ed);
            rows.push(row);
          });
        });
      }
    } catch (err) {
      console.error('Error fetching tentative orders:', err);
    }

    const units = hasUnitFilter ? buildUnitOptions(rows.map((r) => r.Unit), await masterUnitsPromise) : [];
    const dataset: PfDataset = { rows, buyers: Array.from(buyersSet).sort(), units };
    cachedPlanFilterData[dept] = dataset;
    return dataset;
  } catch (err) {
    console.error('Error fetching plan filter data:', err);
    return { rows: [], buyers: [], units: [] };
  }
}

function cellText(value: Cell): string {
  return value === undefined || value === null ? '' : String(value);
}

interface UnitMultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  open: boolean;
  onToggle: () => void;
}

/** Unit multi-select ("All Units" + one checkbox per unit), styled like the Buyer filter. */
function UnitMultiSelect({ options, selected, onChange, open, onToggle }: UnitMultiSelectProps) {
  const allChecked = selected.length === 0;

  return (
    <div className="relative">
      <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
        Unit Selection ({allChecked ? 'All Units' : `${selected.length} Selected`})
      </label>
      <button
        type="button"
        onClick={onToggle}
        title={formatUnitList(selected)}
        className="btn btn-outline btn-sm w-full justify-between font-normal text-xs"
      >
        <span className="truncate">{formatUnitLabel(selected)}</span>
        <Factory className="h-4 w-4 ml-2 opacity-50 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-base-100 border border-base-300 rounded-lg shadow-xl p-3 max-h-64 flex flex-col gap-2">
          <label className="flex items-center gap-2 p-1 pb-2 border-b border-base-200 cursor-pointer text-xs font-bold">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => {
                // Unchecking "All Units" with nothing else picked keeps it checked (legacy behaviour).
                if (e.target.checked) onChange([]);
              }}
              className="checkbox checkbox-xs checkbox-primary"
            />
            All Units
          </label>
          <div className="overflow-y-auto max-h-40 space-y-1 custom-scrollbar">
            {options.length === 0 ? (
              <div className="p-1 text-xs text-base-content/50">No units found</div>
            ) : (
              options.map((u) => (
                <label key={u} className="flex items-center gap-2 p-1 rounded hover:bg-base-200 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={selected.includes(u)}
                    onChange={(e) =>
                      onChange(
                        e.target.checked
                          ? options.filter((o) => o === u || selected.includes(o))
                          : selected.filter((x) => x !== u)
                      )
                    }
                    className="checkbox checkbox-xs checkbox-primary"
                  />
                  <span className="truncate">{u}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlanFilterPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const dept = resolvedParams.dept || 'knitting';
  const config = PF_CONFIGS[dept] || PF_CONFIGS.knitting;
  const showUnitFilter = PF_UNIT_FILTER_DEPTS.has(dept);

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
  const [selectedBuyers, setSelectedBuyers] = useState<string[]>([]);
  const [buyerDropdownOpen, setBuyerDropdownOpen] = useState(false);
  const [buyerSearch, setBuyerSearch] = useState('');

  // Units (dyeing only); [] means "All Units"
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const [previewUnits, setPreviewUnits] = useState<string[]>([]);

  // Data (tagged with the department it was loaded for)
  const [dataset, setDataset] = useState<(PfDataset & { dept: string }) | null>(() =>
    cachedPlanFilterData[dept] ? { ...cachedPlanFilterData[dept], dept } : null
  );
  const [refreshing, setRefreshing] = useState(false);
  const [filteredRows, setFilteredRows] = useState<PfRow[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const current = dataset && dataset.dept === dept ? dataset : null;
  const allRows = current ? current.rows : [];
  const allBuyers = current ? current.buyers : [];
  const unitOptions = current ? current.units : [];
  const loading = refreshing || !current;

  // Load plan filter data whenever the department changes (unit selection resets to All Units).
  useEffect(() => {
    let cancelled = false;
    loadPlanFilterData(dept).then((data) => {
      if (cancelled) return;
      setDataset({ ...data, dept });
      setSelectedUnits([]);
    });
    return () => {
      cancelled = true;
    };
  }, [dept]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await loadPlanFilterData(dept, true);
      setDataset((prev) => (prev && prev.dept !== dept ? prev : { ...data, dept }));
      setSelectedUnits((prev) => prev.filter((u) => data.units.includes(u)));
    } finally {
      setRefreshing(false);
    }
  };

  // Handle Filtering
  const handlePreview = () => {
    if (!fromDate || !toDate) {
      alert('Please select both From and To dates.');
      return;
    }

    const buyerSet = new Set(selectedBuyers.map((b) => b.trim().toUpperCase()));
    const unitsApplied = showUnitFilter ? selectedUnits : [];
    const matchesUnit = createUnitMatcher(unitsApplied);

    const filtered = allRows.filter((r) => {
      const dt = cellText(dateType === 'start' ? r._start : r._end);
      const bNorm = cellText(r.Buyer).trim().toUpperCase();

      // Date check
      if (!dt || dt < fromDate || dt > toDate) return false;

      // Buyer check
      if (buyerSet.size > 0 && !buyerSet.has(bNorm)) return false;

      // Unit check (dyeing only)
      if (!matchesUnit(r.Unit)) return false;

      // Plan Type check
      if (statusFilter !== 'All' && r['Plan Type'] !== statusFilter) return false;

      // Search term
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const oMatch = cellText(r.OrderNo).toLowerCase().includes(q);
        const bMatch = cellText(r.Buyer).toLowerCase().includes(q);
        const cMatch = cellText(r.Color).toLowerCase().includes(q);
        if (!oMatch && !bMatch && !cMatch) return false;
      }

      return true;
    });

    setFilteredRows(filtered);
    setPreviewUnits(unitsApplied);
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
      const rowObj: Record<string, Cell> = {};
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
          onClick={handleRefresh}
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
              onChange={(e) => setDateType(e.target.value as 'start' | 'end')}
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
              onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Confirm' | 'Tentative')}
              className="select select-bordered select-sm w-full"
            >
              <option value="All">All Plans (Confirm & Tentative)</option>
              <option value="Confirm">Confirm Only</option>
              <option value="Tentative">Tentative Only</option>
            </select>
          </div>
        </div>

        {/* Second Row: Buyer Filter Dropdown, Unit Filter (dyeing) & Search */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 ${
            showUnitFilter ? 'lg:grid-cols-3' : ''
          } gap-4 pt-2 border-t border-base-200`}
        >
          {/* Buyer Multi-select */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
              Buyer Selection ({selectedBuyers.length === 0 ? 'All Buyers' : `${selectedBuyers.length} Selected`})
            </label>
            <button
              type="button"
              onClick={() => {
                setBuyerDropdownOpen(!buyerDropdownOpen);
                setUnitDropdownOpen(false);
              }}
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

          {/* Unit Multi-select (Dyeing Plan Filter only) */}
          {showUnitFilter && (
            <UnitMultiSelect
              options={unitOptions}
              selected={selectedUnits}
              onChange={setSelectedUnits}
              open={unitDropdownOpen}
              onToggle={() => {
                setUnitDropdownOpen(!unitDropdownOpen);
                setBuyerDropdownOpen(false);
              }}
            />
          )}

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
                {selectedBuyers.length === 0 ? 'All Buyers' : selectedBuyers.join(', ')}
                {showUnitFilter && ` | Unit: ${formatUnitList(previewUnits)}`} | Status: {statusFilter}
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
                                {cellText(val)}
                              </span>
                            ) : isDate ? (
                              formatDateDisplay(cellText(val)) || '—'
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
