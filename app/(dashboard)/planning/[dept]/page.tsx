'use client';

import React, { useState, useEffect, use } from 'react';
import {
  CalendarDays,
  Search,
  Filter,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  Save,
  X,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { API_BASE, DEPARTMENTS, STATUS_COLORS } from '@/lib/constants';
import { formatDateDisplay } from '@/lib/date-utils';
import { PlanStatus, IFabricItem } from '@/types/order';

interface PageProps {
  params: Promise<{ dept: string }>;
}

export default function DepartmentPlanningPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const dept = resolvedParams.dept || 'knitting';
  const deptConfig = DEPARTMENTS[dept] || { name: `${dept.toUpperCase()} Plan`, color: '#10b981' };

  const [activeTab, setActiveTab] = useState<PlanStatus>('Pending');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [buyer, setBuyer] = useState('');
  const [availableBuyers, setAvailableBuyers] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  // Detailed Modal State
  const [selectedOrderNo, setSelectedOrderNo] = useState<string | null>(null);
  const [detailedOrder, setDetailedOrder] = useState<any>(null);
  const [planItems, setPlanItems] = useState<IFabricItem[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dropdown Master Options
  const [units, setUnits] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);

  // Fetch buyers for this department
  useEffect(() => {
    const fetchBuyers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/orders/buyers/${dept}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setAvailableBuyers(data);
        }
      } catch {}
    };
    fetchBuyers();
  }, [dept]);

  // Fetch Dropdown Master options (Units & Processes)
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/dropdowns`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUnits(data.units || []);
          setProcesses(data.processes || []);
        }
      } catch {}
    };
    fetchDropdowns();
  }, []);

  // Fetch paginated department orders
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const query = new URLSearchParams({
        dept,
        status: activeTab,
        buyer,
        page: String(page),
        limit: '10',
        search,
      });

      const res = await fetch(`${API_BASE}/api/orders?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setTotalPages(data.totalPages || 1);
        setTotalOrders(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [dept, activeTab, buyer, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  // Open Detailed Order Modal
  const openDetailedModal = async (orderNo: string) => {
    setSelectedOrderNo(orderNo);
    setModalLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderNo)}?dept=${dept}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setDetailedOrder(data.order);

        // Merge raw Excel items with existing saved planning records
        const excelItems = data.order[`${dept}Items`] || [];
        const savedPlanItems = (data.planData && data.planData[dept]) || [];
        const planMap = new Map();
        savedPlanItems.forEach((it: any) => {
          if (it.itemId) planMap.set(it.itemId, it);
        });

        const merged = excelItems.map((ex: any, idx: number) => {
          const itemId = ex.itemId || `row-${idx}`;
          const saved = planMap.get(itemId) || {};
          return {
            ...ex,
            itemId,
            planType: saved.planType || 'Select',
            planStart: saved.planStart || '',
            planEnd: saved.planEnd || '',
            unit: saved.unit || '',
            processName: saved.processName || '',
            remarks: saved.remarks || '',
          };
        });

        setPlanItems(merged);
      }
    } catch (err) {
      console.error('Failed to load detailed order:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handlePlanItemChange = (index: number, field: string, value: any) => {
    setPlanItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Save Planning Dates to Server
  const handleSavePlanning = async () => {
    if (!selectedOrderNo) return;
    setSaveLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/orders/save-dates`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderNo: selectedOrderNo,
          department: dept,
          fabricItems: planItems,
        }),
      });

      if (res.ok) {
        setToastMessage(`Planning saved successfully for ${selectedOrderNo}!`);
        setTimeout(() => setToastMessage(null), 3000);
        fetchOrders(); // Refresh table status
      }
    } catch (err) {
      console.error('Failed to save plan:', err);
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="toast toast-top toast-end z-50">
          <div className="alert alert-success text-xs font-bold text-white shadow-lg">
            <CheckCircle className="h-4 w-4" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            {deptConfig.name}
          </h2>
          <p className="text-xs text-base-content/60">
            Schedule fabric milestones and manage machine allocations for {dept.toUpperCase()}.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="tabs tabs-boxed bg-base-100 p-1 border border-base-300">
          {(['Pending', 'Confirm', 'Tentative', 'Completed'] as PlanStatus[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setPage(1);
              }}
              className={`tab tab-sm font-bold transition-all ${
                activeTab === tab ? 'tab-active !bg-primary text-primary-content shadow-sm' : ''
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card bg-base-100 p-4 border border-base-300 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Buyer Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-base-content/60" />
            <select
              value={buyer}
              onChange={(e) => {
                setBuyer(e.target.value);
                setPage(1);
              }}
              className="select select-bordered select-sm text-xs font-semibold"
            >
              <option value="">All Buyers ({availableBuyers.length})</option>
              {availableBuyers.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Booking / Order No..."
                className="input input-bordered input-sm w-48 sm:w-64 pl-8 text-xs"
              />
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-base-content/50" />
            </div>
            <button type="submit" className="btn btn-primary btn-sm font-bold text-xs">
              Search
            </button>
            {(search || buyer) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setBuyer('');
                  setPage(1);
                }}
                className="btn btn-ghost btn-sm text-xs"
              >
                Reset
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Orders Data Table */}
      <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="table table-sm w-full">
            <thead className="bg-base-200/60 text-xs">
              <tr>
                <th>Order / Booking No</th>
                <th>Buyer</th>
                <th>Style</th>
                <th>Booking Date</th>
                <th>Required Qty</th>
                <th>Unit / Floor</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <span className="loading loading-spinner text-primary" />
                    <p className="mt-2 text-xs text-base-content/60">Loading orders...</p>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-base-content/60">
                    No {activeTab} orders found for {dept.toUpperCase()}.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr key={ord._id} className="hover">
                    <td className="font-bold text-primary cursor-pointer hover:underline" onClick={() => openDetailedModal(ord.orderNo)}>
                      {ord.orderNo}
                    </td>
                    <td className="font-semibold">{ord.buyer}</td>
                    <td>{ord.style || '—'}</td>
                    <td>{formatDateDisplay(ord.bookingDate)}</td>
                    <td className="font-mono">{ord.requiredQtyKgs?.toLocaleString() || '—'}</td>
                    <td>{ord.gmtUnit || ord.floor || '—'}</td>
                    <td>
                      <span className={`badge badge-sm font-bold ${STATUS_COLORS[activeTab] || 'badge-neutral'}`}>
                        {activeTab}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => openDetailedModal(ord.orderNo)}
                        className="btn btn-xs btn-outline btn-primary font-bold"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> Plan Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-base-300 px-4 py-3 text-xs">
          <span className="text-base-content/60">
            Total {totalOrders} orders (Page {page} of {totalPages})
          </span>
          <div className="join">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="btn btn-xs join-item"
            >
              Prev
            </button>
            <button className="btn btn-xs join-item btn-active">{page}</button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="btn btn-xs join-item"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Detailed Order Planning Modal */}
      {selectedOrderNo && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-6xl p-6 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-base-300 pb-3">
              <div>
                <h3 className="text-lg font-black flex items-center gap-2">
                  Order Planning: <span className="text-primary">{selectedOrderNo}</span>
                </h3>
                <p className="text-xs text-base-content/60">
                  Department: <strong className="uppercase">{dept}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderNo(null)}
                className="btn btn-sm btn-circle btn-ghost"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 custom-scrollbar">
              {modalLoading ? (
                <div className="p-16 text-center">
                  <span className="loading loading-spinner loading-lg text-primary" />
                </div>
              ) : detailedOrder ? (
                <>
                  {/* Order Specifications Header Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-base-200/50 p-4 rounded-xl border border-base-300 text-xs">
                    <div>
                      <span className="text-base-content/60 block">Buyer:</span>
                      <strong className="font-bold text-sm">{detailedOrder.buyer || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-base-content/60 block">Booking Date:</span>
                      <strong>{formatDateDisplay(detailedOrder.bookingDate)}</strong>
                    </div>
                    <div>
                      <span className="text-base-content/60 block">Style Number:</span>
                      <strong>{detailedOrder.style || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-base-content/60 block">Required Qty:</span>
                      <strong>{detailedOrder.requiredQtyKgs?.toLocaleString() || '—'} Kgs</strong>
                    </div>
                    <div>
                      <span className="text-base-content/60 block">GMT Unit / Floor:</span>
                      <strong>{detailedOrder.gmtUnit || detailedOrder.floor || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-base-content/60 block">PMC / Team:</span>
                      <strong>{detailedOrder.pmc || detailedOrder.buyerTeam || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-base-content/60 block">1st / Last Shipment:</span>
                      <strong>
                        {formatDateDisplay(detailedOrder.ship1)} to {formatDateDisplay(detailedOrder.shipLast)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-base-content/60 block">Yarn Ok Date:</span>
                      <strong>{formatDateDisplay(detailedOrder.yarnDate)}</strong>
                    </div>
                  </div>

                  {/* Fabric Item Planning Table */}
                  <div>
                    <h4 className="text-sm font-bold mb-2">Fabric Items & Planning Schedule</h4>
                    <div className="overflow-x-auto border border-base-300 rounded-xl">
                      <table className="table table-xs w-full">
                        <thead className="bg-base-200 text-xs">
                          <tr>
                            <th>#</th>
                            <th>Color</th>
                            <th>Fabric Construction</th>
                            <th>GSM</th>
                            <th>Plan Type</th>
                            <th>Start Date</th>
                            <th>End Date</th>
                            <th>Unit</th>
                            {dept === 'dyeing' && <th>Process</th>}
                            <th>Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs">
                          {planItems.map((item, idx) => (
                            <tr key={item.itemId || idx} className="hover">
                              <td className="font-bold">{idx + 1}</td>
                              <td className="font-semibold">{item.Color || item.color || '—'}</td>
                              <td>{item.FabricConstruction || item.fabricConstruction || '—'}</td>
                              <td>{item.GSM || item.gsm || '—'}</td>
                              <td>
                                <select
                                  value={item.planType || 'Select'}
                                  onChange={(e) => handlePlanItemChange(idx, 'planType', e.target.value)}
                                  className={`select select-bordered select-xs font-bold ${
                                    item.planType === 'Confirm'
                                      ? 'text-success border-success'
                                      : item.planType === 'Tentative'
                                      ? 'text-warning border-warning'
                                      : ''
                                  }`}
                                >
                                  <option value="Select">Select</option>
                                  <option value="Tentative">Tentative</option>
                                  <option value="Confirm">Confirm</option>
                                </select>
                              </td>
                              <td>
                                <input
                                  type="date"
                                  value={item.planStart || ''}
                                  onChange={(e) => handlePlanItemChange(idx, 'planStart', e.target.value)}
                                  className="input input-bordered input-xs"
                                />
                              </td>
                              <td>
                                <input
                                  type="date"
                                  value={item.planEnd || ''}
                                  onChange={(e) => handlePlanItemChange(idx, 'planEnd', e.target.value)}
                                  className="input input-bordered input-xs"
                                />
                              </td>
                              <td>
                                <select
                                  value={item.unit || ''}
                                  onChange={(e) => handlePlanItemChange(idx, 'unit', e.target.value)}
                                  className="select select-bordered select-xs"
                                >
                                  <option value="">Select Unit</option>
                                  {units
                                    .filter((u) => u.status === 'ACTIVE' || u.name === item.unit)
                                    .map((u) => (
                                      <option key={u._id} value={u.name}>
                                        {u.name}
                                      </option>
                                    ))}
                                </select>
                              </td>
                              {dept === 'dyeing' && (
                                <td>
                                  <select
                                    value={item.processName || ''}
                                    onChange={(e) => handlePlanItemChange(idx, 'processName', e.target.value)}
                                    className="select select-bordered select-xs"
                                  >
                                    <option value="">Select Process</option>
                                    {processes
                                      .filter((p) => p.status === 'ACTIVE' || p.name === item.processName)
                                      .map((p) => (
                                        <option key={p._id} value={p.name}>
                                          {p.name}
                                        </option>
                                      ))}
                                  </select>
                                </td>
                              )}
                              <td>
                                <input
                                  type="text"
                                  value={item.remarks || ''}
                                  onChange={(e) => handlePlanItemChange(idx, 'remarks', e.target.value)}
                                  placeholder="Notes..."
                                  className="input input-bordered input-xs w-32"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-base-300 pt-3">
              <span className="text-[11px] text-base-content/60">
                Confirming all rows will automatically transition this order to <strong>Confirm</strong>.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrderNo(null)}
                  className="btn btn-sm btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePlanning}
                  disabled={saveLoading}
                  className="btn btn-sm btn-primary font-bold shadow-md shadow-primary/25"
                >
                  {saveLoading ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1" /> Save Planning Schedule
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
