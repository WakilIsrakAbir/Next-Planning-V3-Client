'use client';

import React, { useState, useEffect, use } from 'react';
import { Calendar, Eye, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { createUnitMatcher } from '@/features/filters/lib/unit-filter';
import UnitMultiSelect from '@/features/filters/components/UnitMultiSelect';
import { PF_CONFIGS, PF_UNIT_FILTER_DEPTS } from '@/features/filters/plan-filter/lib/plan-filter-config';
import { cachedPlanFilterData, loadPlanFilterData } from '@/features/filters/plan-filter/lib/plan-filter-data';
import { cellText } from '@/features/filters/plan-filter/lib/plan-filter-rows';
import type { Cell, PfDataset, PfRow } from '@/features/filters/plan-filter/types';
import PlanFilterHeader from '@/features/filters/plan-filter/components/PlanFilterHeader';
import PlanFilterDateFields from '@/features/filters/plan-filter/components/PlanFilterDateFields';
import PlanFilterBuyerSelect from '@/features/filters/plan-filter/components/PlanFilterBuyerSelect';
import PlanFilterPreview from '@/features/filters/plan-filter/components/PlanFilterPreview';

interface PageProps {
  params: Promise<{ dept: string }>;
}

export default function PlanFilterScreen({ params }: PageProps) {
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
      <PlanFilterHeader title={config.title} loading={loading} handleRefresh={handleRefresh} />

      {/* Filter Builder Card */}
      <div className="card bg-base-100 border border-base-300 p-5 shadow-sm space-y-5">
        <h3 className="font-bold text-sm text-base-content/80 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Filter Parameters
        </h3>

        <PlanFilterDateFields
          fromDate={fromDate}
          setFromDate={setFromDate}
          toDate={toDate}
          setToDate={setToDate}
          dateType={dateType}
          setDateType={setDateType}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />

        {/* Second Row: Buyer Filter Dropdown, Unit Filter (dyeing) & Search */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 ${
            showUnitFilter ? 'lg:grid-cols-3' : ''
          } gap-4 pt-2 border-t border-base-200`}
        >
          {/* Buyer Multi-select */}
          <PlanFilterBuyerSelect
            selectedBuyers={selectedBuyers}
            setSelectedBuyers={setSelectedBuyers}
            buyerDropdownOpen={buyerDropdownOpen}
            onToggle={() => {
              setBuyerDropdownOpen(!buyerDropdownOpen);
              setUnitDropdownOpen(false);
            }}
            buyerSearch={buyerSearch}
            setBuyerSearch={setBuyerSearch}
            allBuyers={allBuyers}
            filteredBuyerOptions={filteredBuyerOptions}
          />

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
        <PlanFilterPreview
          filteredRows={filteredRows}
          cols={config.cols}
          dateType={dateType}
          fromDate={fromDate}
          toDate={toDate}
          selectedBuyers={selectedBuyers}
          showUnitFilter={showUnitFilter}
          previewUnits={previewUnits}
          statusFilter={statusFilter}
          handleExportExcel={handleExportExcel}
        />
      )}
    </div>
  );
}
