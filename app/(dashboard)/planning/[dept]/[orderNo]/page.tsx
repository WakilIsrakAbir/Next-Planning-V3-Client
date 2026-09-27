'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Info,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { API_BASE, DEPARTMENTS, STATUS_COLORS } from '@/lib/constants';
import { formatDateDisplay } from '@/lib/date-utils';

interface PageProps {
  params: Promise<{
    dept: string;
    orderNo: string;
  }>;
}

export default function OrderPlanningDetailPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const dept = resolvedParams.dept.toLowerCase();
  const orderNo = decodeURIComponent(resolvedParams.orderNo);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [order, setOrder] = useState<any>(null);
  const [planData, setPlanData] = useState<any>(null);
  const [planItems, setPlanItems] = useState<any[]>([]);
  const [orderStatus, setOrderStatus] = useState<string>('On Process');

  // Master dropdown options (Unit & Process)
  const [unitOptions, setUnitOptions] = useState<string[]>(['EFL', 'EKL', 'Ext', 'Outside']);
  const [processOptions, setProcessOptions] = useState<string[]>([
    'Solid',
    'Dyeing Wash',
    'HTR',
    'Pluvia',
    'SB',
    'WH',
    'DF',
  ]);

  const deptMeta = DEPARTMENTS[dept] || { name: dept.toUpperCase() };

  useEffect(() => {
    fetchOrderAndDropdowns();
  }, [dept, orderNo]);

  const fetchOrderAndDropdowns = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch dropdown options
      try {
        const ddRes = await fetch(`${API_BASE}/api/dropdowns`, { headers });
        if (ddRes.ok) {
          const ddData = await ddRes.json();
          if (ddData.units && ddData.units.length > 0) {
            setUnitOptions(ddData.units.map((u: any) => u.name));
          }
          if (ddData.processes && ddData.processes.length > 0) {
            setProcessOptions(ddData.processes.map((p: any) => p.name));
          }
        }
      } catch (e) {
        console.error('Failed to load dropdowns:', e);
      }

      // 2. Fetch Order Details
      const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderNo)}?dept=${dept}`, {
        headers,
      });

      if (!res.ok) {
        throw new Error(`Failed to load order #${orderNo}`);
      }

      const data = await res.json();
      const currentOrder = data.order || {};
      const currentPlan = data.planData || {};

      setOrder(currentOrder);
      setPlanData(currentPlan);

      if (currentPlan[`${dept}Status`]) {
        setOrderStatus(currentPlan[`${dept}Status`]);
      } else {
        setOrderStatus('On Process');
      }

      // Merge raw items with saved plan data
      const excelItems = currentOrder[`${dept}Items`] || [];
      const savedItems = (currentPlan && currentPlan[dept]) || [];
      const planMap = new Map();
      savedItems.forEach((it: any) => {
        if (it.itemId) planMap.set(it.itemId, it);
      });

      const merged = excelItems.map((ex: any, idx: number) => {
        const itemId = ex.itemId || `row-${idx}`;
        const saved = planMap.get(itemId) || {};

        return {
          ...ex,
          itemId,
          // Editable planning fields
          planType: saved.planType || ex.planType || '',
          startDate: saved.startDate || saved.planStart || ex.startDate || '',
          endDate: saved.endDate || saved.planEnd || ex.endDate || '',
          unit: saved.unit || ex.Unit || '',
          processName: saved.processName || ex.ProcessName || ex['Process Name'] || '',
          limitation: saved.limitation || ex.limitation || '',
          remarks: saved.remarks || ex.remarks || '',
          // Knitting yarn date
          yarnDate: saved.yarnDate || ex.yarnDate || '',
          // Delivery & YD Floor Planning
          floorStartDate: saved.floorStartDate || ex.floorStartDate || '',
          floorEndDate: saved.floorEndDate || ex.floorEndDate || '',
          floorPlanType: saved.floorPlanType || ex.floorPlanType || '',
          matchingOptionDate: saved.matchingOptionDate || ex.matchingOptionDate || '',
        };
      });

      setPlanItems(merged);
    } catch (err: any) {
      console.error(err);
      setToast({ type: 'error', message: err.message || 'Error loading order details.' });
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setPlanItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };

      // Auto-enforce min end date if start date changes
      if (field === 'startDate' && value && item.endDate && item.endDate < value) {
        item.endDate = value;
      }
      if (field === 'floorStartDate' && value && item.floorEndDate && item.floorEndDate < value) {
        item.floorEndDate = value;
      }

      next[index] = item;
      return next;
    });
  };

  const handleSavePlanning = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');

      // Auto-transition to Confirm if all items are Confirm
      let finalStatus = orderStatus;
      if (planItems.length > 0 && planItems.every((it) => it.planType === 'Confirm')) {
        finalStatus = 'Confirm';
        setOrderStatus('Confirm');
      }

      const res = await fetch(`${API_BASE}/api/orders/save-dates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderNo,
          department: dept,
          fabricItems: planItems,
          orderStatus: finalStatus,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to save planning schedule.');
      }

      setToast({
        type: 'success',
        message: `Planning schedule successfully saved for Order #${orderNo}!`,
      });
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Error saving planning schedule.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center flex-col gap-3">
        <span className="loading loading-spinner loading-lg text-primary" />
        <p className="text-xs font-semibold text-base-content/60 animate-pulse">
          Loading detailed planning schedule for Order #{orderNo}...
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto">
        <AlertCircle className="h-12 w-12 text-error mx-auto mb-3" />
        <h2 className="text-xl font-bold">Order Not Found</h2>
        <p className="text-xs text-base-content/60 mt-1 mb-4">
          The requested Order #{orderNo} was not found in the {deptMeta.name} registry.
        </p>
        <Link href={`/planning/${dept}`} className="btn btn-primary btn-sm">
          <ArrowLeft className="h-4 w-4 mr-1" /> Return to Planning
        </Link>
      </div>
    );
  }

  // Calculate order quantity fallback
  const totalItemQty = planItems.reduce((acc, it) => {
    const q = Number(it.RequiredQtyKgs || it.requiredQtyKgs || it['Req Qty'] || it.Qty || 0);
    return acc + (isNaN(q) ? 0 : q);
  }, 0);
  const displayQty = order.requiredQtyKgs || (totalItemQty > 0 ? totalItemQty : '—');

  return (
    <div className="space-y-6 pb-20 max-w-[1700px] mx-auto animate-fade-in">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div className={`alert ${toast.type === 'success' ? 'alert-success' : 'alert-error'} shadow-lg text-xs font-bold`}>
            {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-base-300 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/planning/${dept}`}
            className="btn btn-ghost btn-sm btn-square border border-base-300 hover:border-primary"
            title="Return to Planning List"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight">
                Order Planning: <span className="text-primary font-mono">{orderNo}</span>
              </h1>
              <span className="badge badge-primary text-[10px] font-black uppercase tracking-wider">
                {deptMeta.name}
              </span>
            </div>
            <p className="text-xs text-base-content/60 mt-0.5">
              Comprehensive process planning, scheduling, unit assignment, and production synchronization.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/planning/${dept}`)}
            className="btn btn-ghost btn-sm text-xs font-semibold"
            disabled={saving}
          >
            Back
          </button>
          <button
            onClick={handleSavePlanning}
            className="btn btn-primary btn-sm text-xs font-bold shadow-md shadow-primary/20 gap-1.5"
            disabled={saving}
          >
            {saving ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Planning Schedule
          </button>
        </div>
      </div>

      {/* General Information 3-Column Specifications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Column 1: Identifiers & Order Status */}
        <div className="card bg-base-100 border border-base-300 shadow-sm p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-primary border-b border-base-200 pb-2">
            <Info className="h-3.5 w-3.5" /> Identifiers & Status
          </div>
          <div className="grid grid-cols-2 gap-y-2 text-xs">
            <span className="text-base-content/60">EWO No:</span>
            <span className="font-bold text-base-content truncate">{order.orderNo || '—'}</span>

            <span className="text-base-content/60">Booking No:</span>
            <span className="font-semibold text-base-content truncate">{order.orderNo || '—'}</span>

            <span className="text-base-content/60">Booking Date:</span>
            <span className="font-medium">{formatDateDisplay(order.bookingDate)}</span>

            <span className="text-base-content/60">GMT Unit:</span>
            <span className="font-semibold">{order.gmtUnit || order.floor || '—'}</span>

            <span className="text-base-content/60">Floor:</span>
            <span className="font-semibold">{order.floor || '—'}</span>

            <span className="text-base-content/60">Final Confirmation:</span>
            <span className="font-bold text-success">{order.finalConfirmation || '—'}</span>

            <span className="text-base-content/60">BP Status:</span>
            <span className="font-medium">{formatDateDisplay(order.bpStatus)}</span>

            <span className="text-base-content/60">PMC:</span>
            <span className="font-medium">{order.pmc || '—'}</span>

            <span className="text-base-content/60 self-center">Order Status:</span>
            <div>
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
                className="select select-bordered select-xs w-full font-bold text-primary focus:select-primary"
              >
                <option value="On Process">On Process</option>
                <option value="Completed">Completed</option>
                <option value="Confirm">Confirm</option>
                <option value="Tentative">Tentative</option>
              </select>
            </div>
          </div>
        </div>

        {/* Column 2: Merchandising & Shipment Specs */}
        <div className="card bg-base-100 border border-base-300 shadow-sm p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-primary border-b border-base-200 pb-2">
            <Layers className="h-3.5 w-3.5" /> Merchandising & Shipment
          </div>
          <div className="grid grid-cols-2 gap-y-2 text-xs">
            <span className="text-base-content/60">Buyer Name(s):</span>
            <span className="font-bold text-primary truncate">{order.buyer || '—'}</span>

            <span className="text-base-content/60">Buyer Team:</span>
            <span className="font-medium">{order.buyerTeam || '—'}</span>

            <span className="text-base-content/60">Booked By:</span>
            <span className="font-medium">{order.bookedBy || order.bookingBy || '—'}</span>

            <span className="text-base-content/60">Style Number:</span>
            <span className="font-bold text-base-content">{order.style || '—'}</span>

            <span className="text-base-content/60">Order Qty (Kg):</span>
            <span className="font-black text-secondary">
              {typeof displayQty === 'number' ? displayQty.toLocaleString() : displayQty} Kgs
            </span>

            <span className="text-base-content/60">Event Day:</span>
            <span className="font-medium">{order.eventDay || '—'}</span>

            <span className="text-base-content/60">1st Shipment Date:</span>
            <span className="font-medium">{formatDateDisplay(order.ship1)}</span>

            <span className="text-base-content/60">Last Shipment Date:</span>
            <span className="font-medium">{formatDateDisplay(order.shipLast)}</span>

            <span className="text-base-content/60">T&A Yarn Date:</span>
            <span className="font-bold text-warning">{formatDateDisplay(order.yarnDate)}</span>
          </div>
        </div>

        {/* Column 3: Production Milestones & Notes */}
        <div className="card bg-base-100 border border-base-300 shadow-sm p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-primary border-b border-base-200 pb-2">
            <Calendar className="h-3.5 w-3.5" /> Production Milestones & Notes
          </div>
          <div className="grid grid-cols-2 gap-y-2 text-xs">
            <span className="text-base-content/60">T&A Deli. Start:</span>
            <span className="font-medium">{formatDateDisplay(order.deliStart)}</span>

            <span className="text-base-content/60">T&A Deli. End:</span>
            <span className="font-medium">{formatDateDisplay(order.deliEnd)}</span>

            <span className="text-base-content/60">T&A Knitting Start:</span>
            <span className="font-medium">{formatDateDisplay(order.knitStart)}</span>

            <span className="text-base-content/60">T&A Knitting End:</span>
            <span className="font-medium">{formatDateDisplay(order.knitEnd)}</span>

            <span className="text-base-content/60">T&A Dyeing Start:</span>
            <span className="font-medium">{formatDateDisplay(order.dyeStart)}</span>

            <span className="text-base-content/60">T&A Dyeing End:</span>
            <span className="font-medium">{formatDateDisplay(order.dyeEnd)}</span>

            <span className="text-base-content/60 col-span-2 mt-1">Fabric Notes:</span>
            <div className="col-span-2 p-2 bg-base-200/50 rounded-lg border border-base-300 text-[11px] text-base-content/80 min-h-[46px]">
              {order.fabricNotes || order.pmcNotes || 'No specific fabric notes specified.'}
            </div>
          </div>
        </div>
      </div>

      {/* Fabric Items & Process Planning Schedule Table */}
      <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
        <div className="bg-base-200/70 px-4 py-3 border-b border-base-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            <h3 className="font-extrabold text-sm tracking-tight">
              Department Fabric Items & Production Allocation
            </h3>
            <span className="badge badge-sm badge-ghost font-mono">{planItems.length} Items</span>
          </div>
          <p className="text-[11px] text-base-content/60 hidden sm:block">
            Confirming all rows will automatically transition order status to Confirm.
          </p>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="table table-xs w-full text-left whitespace-nowrap border-collapse">
            <thead className="bg-base-200/90 text-[11px] font-bold text-base-content/80 border-b border-base-300">
              <tr>
                <th className="py-2.5 px-3 text-center">#</th>
                <th className="py-2.5 px-3">Color</th>
                {dept !== 'yd' && <th className="py-2.5 px-3">Fabric Construction</th>}
                {dept !== 'yd' && <th className="py-2.5 px-3 text-center">GSM</th>}

                {/* YD specific left cols */}
                {dept === 'yd' && <th className="py-2.5 px-3">Booking Type</th>}
                {dept === 'yd' && <th className="py-2.5 px-3 text-center">YDB</th>}
                {dept === 'yd' && <th className="py-2.5 px-3 text-center">YD Booking Date</th>}

                {/* Dyeing / Finishing Unit & Process dropdowns */}
                {(dept === 'dyeing' || dept === 'finishing') && (
                  <>
                    <th className="py-2.5 px-3 min-w-[110px]">Unit</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Process Name</th>
                  </>
                )}

                {/* Knitting yarn date */}
                {dept === 'knitting' && (
                  <th className="py-2.5 px-3 text-center bg-warning/10 text-warning-content min-w-[120px]">
                    Yarn Date
                  </th>
                )}

                {/* Delivery Floor Schedule */}
                {dept === 'delivery' && (
                  <>
                    <th className="py-2.5 px-3 text-center bg-info/10 text-info min-w-[125px]">Floor Start</th>
                    <th className="py-2.5 px-3 text-center bg-info/10 text-info min-w-[125px]">Floor End</th>
                    <th className="py-2.5 px-3 text-center bg-info/10 text-info min-w-[110px]">Floor Plan</th>
                  </>
                )}

                {/* Standard Planning Schedule Inputs */}
                <th className="py-2.5 px-3 text-center min-w-[125px] bg-primary/5">Plan Start</th>
                <th className="py-2.5 px-3 text-center min-w-[125px] bg-primary/5">Plan End</th>
                <th className="py-2.5 px-3 text-center min-w-[115px] bg-primary/5">Plan Type</th>
                <th className="py-2.5 px-3 min-w-[140px]">Limitation</th>
                <th className="py-2.5 px-3 min-w-[140px]">Remarks</th>

                {/* Department Production & Balance Columns (Parity with Exp) */}
                {dept === 'knitting' && (
                  <>
                    <th className="py-2.5 px-3 text-right">Grey Req (Kg)</th>
                    <th className="py-2.5 px-3 text-right">Knit Prod (Kg)</th>
                    <th className="py-2.5 px-3 text-right text-warning">Knit Bala (Kg)</th>
                    <th className="py-2.5 px-3 text-right">Yarn Req (Kg)</th>
                    <th className="py-2.5 px-3 text-right">Allocated Qty</th>
                    <th className="py-2.5 px-3 text-right">Yarn Bala</th>
                    <th className="py-2.5 px-3 text-center">Allowance %</th>
                  </>
                )}

                {(dept === 'dyeing' || dept === 'finishing') && (
                  <>
                    <th className="py-2.5 px-3 text-right">BP Qty</th>
                    <th className="py-2.5 px-3 text-right">Dyeing Prod</th>
                    <th className="py-2.5 px-3 text-right text-warning">Dyeing Bala</th>
                    <th className="py-2.5 px-3 text-right">Knit Prod</th>
                    <th className="py-2.5 px-3 text-right">Knit Bala</th>
                  </>
                )}

                {dept === 'delivery' && (
                  <>
                    <th className="py-2.5 px-3 text-right">Req Qty</th>
                    <th className="py-2.5 px-3 text-right">Net Received</th>
                    <th className="py-2.5 px-3 text-right">Net Delivery</th>
                    <th className="py-2.5 px-3 text-right text-warning">Deli Bala</th>
                    <th className="py-2.5 px-3 text-right">RFD</th>
                    <th className="py-2.5 px-3 text-right">Slowmoving</th>
                    <th className="py-2.5 px-3 text-right">FF Stock</th>
                  </>
                )}

                {dept === 'yd' && (
                  <>
                    <th className="py-2.5 px-3 text-right">YD Req</th>
                    <th className="py-2.5 px-3 text-right">Dyed</th>
                    <th className="py-2.5 px-3 text-right text-warning">YD Bala</th>
                    <th className="py-2.5 px-3 text-right">Delivered</th>
                    <th className="py-2.5 px-3 text-right">Barrier Qty</th>
                    <th className="py-2.5 px-3 text-right">Workable Qty</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-base-200 text-xs">
              {planItems.map((item, idx) => {
                return (
                  <tr key={item.itemId || idx} className="hover:bg-base-200/50 transition-colors">
                    <td className="py-2 px-3 text-center font-mono text-[11px] text-base-content/50">
                      {idx + 1}
                    </td>

                    {/* Color */}
                    <td className="py-2 px-3 font-bold text-base-content">
                      {item.Color || item['Color'] || item['Colour'] || '—'}
                    </td>

                    {/* Construction & GSM */}
                    {dept !== 'yd' && (
                      <>
                        <td className="py-2 px-3 text-base-content/80 font-medium">
                          {item.FabricConstruction || item['Fabric Construction'] || item['Construction'] || '—'}
                        </td>
                        <td className="py-2 px-3 text-center font-mono">
                          {item.GSM || item['GSM'] || '—'}
                        </td>
                      </>
                    )}

                    {/* YD Left columns */}
                    {dept === 'yd' && (
                      <>
                        <td className="py-2 px-3 font-semibold">{item['Booking Type'] || item.BookingType || '—'}</td>
                        <td className="py-2 px-3 text-center font-mono">{item.YDB || item['YDB'] || '—'}</td>
                        <td className="py-2 px-3 text-center font-medium">{formatDateDisplay(item['YD Booking Date'])}</td>
                      </>
                    )}

                    {/* Dyeing / Finishing Unit & Process dropdowns */}
                    {(dept === 'dyeing' || dept === 'finishing') && (
                      <>
                        <td className="py-2 px-3">
                          <select
                            value={item.unit || ''}
                            onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                            className="select select-bordered select-xs w-full font-medium"
                          >
                            <option value="">Select Unit</option>
                            {unitOptions.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={item.processName || ''}
                            onChange={(e) => handleItemChange(idx, 'processName', e.target.value)}
                            className="select select-bordered select-xs w-full font-medium"
                          >
                            <option value="">Select Process</option>
                            {processOptions.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </td>
                      </>
                    )}

                    {/* Knitting Yarn Date */}
                    {dept === 'knitting' && (
                      <td className="py-2 px-3 bg-warning/5 text-center">
                        <input
                          type="date"
                          value={item.yarnDate || ''}
                          onChange={(e) => handleItemChange(idx, 'yarnDate', e.target.value)}
                          className="input input-bordered input-xs w-32 font-mono text-[11px]"
                        />
                      </td>
                    )}

                    {/* Delivery Floor Schedule */}
                    {dept === 'delivery' && (
                      <>
                        <td className="py-2 px-3 bg-info/5 text-center">
                          <input
                            type="date"
                            value={item.floorStartDate || ''}
                            onChange={(e) => handleItemChange(idx, 'floorStartDate', e.target.value)}
                            className="input input-bordered input-xs w-32 font-mono text-[11px]"
                          />
                        </td>
                        <td className="py-2 px-3 bg-info/5 text-center">
                          <input
                            type="date"
                            value={item.floorEndDate || ''}
                            min={item.floorStartDate || undefined}
                            onChange={(e) => handleItemChange(idx, 'floorEndDate', e.target.value)}
                            className="input input-bordered input-xs w-32 font-mono text-[11px]"
                          />
                        </td>
                        <td className="py-2 px-3 bg-info/5 text-center">
                          <select
                            value={item.floorPlanType || ''}
                            onChange={(e) => handleItemChange(idx, 'floorPlanType', e.target.value)}
                            className="select select-bordered select-xs font-semibold"
                          >
                            <option value="">Select</option>
                            <option value="Confirm">Confirm</option>
                            <option value="Tentative">Tentative</option>
                          </select>
                        </td>
                      </>
                    )}

                    {/* Standard Planning Start Date */}
                    <td className="py-2 px-3 bg-primary/5 text-center">
                      <input
                        type="date"
                        value={item.startDate || ''}
                        onChange={(e) => handleItemChange(idx, 'startDate', e.target.value)}
                        className="input input-bordered input-xs w-32 font-mono text-[11px]"
                      />
                    </td>

                    {/* Standard Planning End Date */}
                    <td className="py-2 px-3 bg-primary/5 text-center">
                      <input
                        type="date"
                        value={item.endDate || ''}
                        min={item.startDate || undefined}
                        onChange={(e) => handleItemChange(idx, 'endDate', e.target.value)}
                        className="input input-bordered input-xs w-32 font-mono text-[11px]"
                      />
                    </td>

                    {/* Standard Plan Type */}
                    <td className="py-2 px-3 bg-primary/5 text-center">
                      <select
                        value={item.planType || ''}
                        onChange={(e) => handleItemChange(idx, 'planType', e.target.value)}
                        className={`select select-bordered select-xs font-bold ${
                          item.planType === 'Confirm'
                            ? 'text-success select-success'
                            : item.planType === 'Tentative'
                            ? 'text-warning select-warning'
                            : ''
                        }`}
                      >
                        <option value="">Select</option>
                        <option value="Confirm">Confirm</option>
                        <option value="Tentative">Tentative</option>
                      </select>
                    </td>

                    {/* Limitation */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        placeholder="Limitation..."
                        value={item.limitation || ''}
                        onChange={(e) => handleItemChange(idx, 'limitation', e.target.value)}
                        className="input input-bordered input-xs w-full text-[11px]"
                      />
                    </td>

                    {/* Remarks */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        placeholder="Notes..."
                        value={item.remarks || ''}
                        onChange={(e) => handleItemChange(idx, 'remarks', e.target.value)}
                        className="input input-bordered input-xs w-full text-[11px]"
                      />
                    </td>

                    {/* Department Specific Metric Rows */}
                    {dept === 'knitting' && (
                      <>
                        <td className="py-2 px-3 text-right font-mono font-semibold">
                          {(item['Grey Req.'] || item.GreyReq || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {(item['Knit Prod.'] || item.KnitProd || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-warning">
                          {(item['Knit. Bala.'] || item.KnitBala || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {(item['Yarn req.'] || item.YarnReq || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {(item['Allocated Qty '] || item['Allocated Qty'] || item.AllocatedQty || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {(item['Yarn bala.'] || item.YarnBala || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-center font-mono">
                          {item['Allowance %'] !== undefined ? `${(Number(item['Allowance %']) * 100).toFixed(0)}%` : '—'}
                        </td>
                      </>
                    )}

                    {(dept === 'dyeing' || dept === 'finishing') && (
                      <>
                        <td className="py-2 px-3 text-right font-mono">
                          {(item['BP Qty'] || item.BPQty || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {(item['Dyeing Prod.'] || item.DyeingProd || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-warning">
                          {(item['Dyeing Bala.'] || item.DyeingBala || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {(item['Knit Prod.'] || item.KnitProd || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {(item['Knit. Bala.'] || item.KnitBala || 0).toLocaleString()}
                        </td>
                      </>
                    )}

                    {dept === 'delivery' && (
                      <>
                        <td className="py-2 px-3 text-right font-mono font-semibold">
                          {(item.RequiredQtyKgs || item['Req Qty'] || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {(item.NetReceivedQtyKgs || item.NetReceivedQty || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {(item.NetDeliveryQtyKgs || item.NetDeliveryQty || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-warning">
                          {(item['Deli. Bal.'] || item.DeliBal || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{(item.RFD || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono">{(item.Slowmoving || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono">{(item['FF Stock'] || item.FFStock || 0).toLocaleString()}</td>
                      </>
                    )}

                    {dept === 'yd' && (
                      <>
                        <td className="py-2 px-3 text-right font-mono">
                          {(item['YD REQ.'] || item.YDReq || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{(item.DYED || item.Dyed || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-warning">
                          {(item['YD BALANCE'] || item.YDBalance || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {(item['YD Delivered'] || item.YDDelivered || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{(item['Barrier Qty.'] || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono">{(item['Workable Qty.'] || 0).toLocaleString()}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Save Bar */}
        <div className="bg-base-200/50 p-4 border-t border-base-300 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-base-content/70">
            Total {planItems.length} fabric items ready for schedule synchronization.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/planning/${dept}`)}
              className="btn btn-ghost btn-sm text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePlanning}
              className="btn btn-primary btn-sm text-xs font-bold shadow-md shadow-primary/20 gap-1.5"
              disabled={saving}
            >
              {saving ? <span className="loading loading-spinner loading-xs" /> : <Save className="h-4 w-4" />}
              Save Planning Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
