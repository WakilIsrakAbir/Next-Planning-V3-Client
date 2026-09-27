'use client';

import React, { useState, useEffect } from 'react';
import { Sliders, Plus, Edit2, Trash2, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { API_BASE } from '@/lib/constants';

export default function SetupPage() {
  const [units, setUnits] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<'UNIT' | 'PROCESS'>('UNIT');
  const [addName, setAddName] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchDropdowns = async () => {
    setLoading(true);
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
    } catch (err) {
      console.error('Failed to load dropdowns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDropdowns();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) return;

    setAddLoading(true);
    setAddError(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/dropdowns`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: addType, name: addName.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to add option.');
      }

      setToastMessage(data.message || 'Option created successfully!');
      setShowAddModal(false);
      setAddName('');
      setTimeout(() => setToastMessage(null), 3500);
      fetchDropdowns();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      const nextStatus = currentStatus === 'ACTIVE' ? 'HIDDEN' : 'ACTIVE';
      const res = await fetch(`${API_BASE}/api/dropdowns/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        fetchDropdowns();
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete option "${name}"?`)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/dropdowns/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      setToastMessage(data.message || 'Action completed.');
      setTimeout(() => setToastMessage(null), 4000);
      fetchDropdowns();
    } catch (err: any) {
      alert(err.message || 'Failed to delete option.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="toast toast-top toast-end z-50">
          <div className="alert alert-info text-xs font-bold text-white shadow-lg">
            <CheckCircle2 className="h-4 w-4" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Sliders className="h-6 w-6 text-primary" />
            Dropdown Master Setup
          </h2>
          <p className="text-xs text-base-content/60">
            Configure standardized Units and Dyeing Processes. Protected by historical reference safety checks.
          </p>
        </div>

        <button
          onClick={() => {
            setShowAddModal(true);
            setAddError(null);
          }}
          className="btn btn-primary btn-sm font-bold shadow-md shadow-primary/25"
        >
          <Plus className="w-4 h-4 mr-1" /> Add New Master Option
        </button>
      </div>

      {/* Dropdown Lists Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* UNITS SECTION */}
        <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-base-300 bg-base-200/40 flex items-center justify-between">
            <h3 className="font-bold text-sm">Manufacturing Units ({units.length})</h3>
            <span className="badge badge-primary badge-sm font-bold">TYPE: UNIT</span>
          </div>

          <div className="p-4 space-y-2">
            {loading ? (
              <div className="p-8 text-center"><span className="loading loading-spinner text-primary" /></div>
            ) : (
              units.map((u) => (
                <div
                  key={u._id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-base-200 hover:bg-base-200/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs">{u.name}</span>
                    <span
                      className={`badge badge-xs font-bold ${
                        u.status === 'ACTIVE' ? 'badge-success text-white' : 'badge-neutral'
                      }`}
                    >
                      {u.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleStatus(u._id, u.status)}
                      className="btn btn-ghost btn-xs text-[10px]"
                    >
                      {u.status === 'ACTIVE' ? 'Hide' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDeleteItem(u._id, u.name)}
                      className="btn btn-ghost btn-xs text-error"
                      title="Delete Option"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PROCESSES SECTION */}
        <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-base-300 bg-base-200/40 flex items-center justify-between">
            <h3 className="font-bold text-sm">Dyeing Processes ({processes.length})</h3>
            <span className="badge badge-secondary badge-sm font-bold">TYPE: PROCESS</span>
          </div>

          <div className="p-4 space-y-2">
            {loading ? (
              <div className="p-8 text-center"><span className="loading loading-spinner text-primary" /></div>
            ) : (
              processes.map((p) => (
                <div
                  key={p._id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-base-200 hover:bg-base-200/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs">{p.name}</span>
                    <span
                      className={`badge badge-xs font-bold ${
                        p.status === 'ACTIVE' ? 'badge-success text-white' : 'badge-neutral'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleStatus(p._id, p.status)}
                      className="btn btn-ghost btn-xs text-[10px]"
                    >
                      {p.status === 'ACTIVE' ? 'Hide' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDeleteItem(p._id, p.name)}
                      className="btn btn-ghost btn-xs text-error"
                      title="Delete Option"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal modal-open">
          <div className="modal-box w-full max-w-sm p-6">
            <h3 className="font-bold text-base mb-3">Create Master Option</h3>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div className="form-control">
                <label className="label text-xs font-bold">Option Classification</label>
                <select
                  value={addType}
                  onChange={(e) => setAddType(e.target.value as any)}
                  className="select select-bordered select-sm text-xs font-bold"
                >
                  <option value="UNIT">Manufacturing Unit</option>
                  <option value="PROCESS">Dyeing Process</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label text-xs font-bold">Option Name</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Outside or Solid"
                  className="input input-bordered input-sm text-xs"
                  required
                  autoFocus
                />
              </div>

              {addError && (
                <div className="alert alert-error text-xs font-semibold py-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-base-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-sm btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="btn btn-sm btn-primary font-bold"
                >
                  {addLoading ? <span className="loading loading-spinner loading-xs" /> : 'Save Option'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
