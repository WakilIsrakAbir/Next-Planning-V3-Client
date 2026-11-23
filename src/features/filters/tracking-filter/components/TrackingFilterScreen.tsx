'use client';

import React, { useState, useEffect, use } from 'react';
import { Calendar, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import { createUnitMatcher } from '@/features/filters/lib/unit-filter';
import UnitMultiSelect from '@/features/filters/components/UnitMultiSelect';
import { PVATF_CONFIGS, isUnitProcessDept } from '@/features/filters/tracking-filter/lib/tracking-filter-config';
import {
  cachedTrackingFilterData,
  loadTrackingFilterData,
} from '@/features/filters/tracking-filter/lib/tracking-filter-data';
import { calcTrackingResult } from '@/features/filters/tracking-filter/lib/tracking-result';
import type { DateField, TrackingDataset, TrackingResultRow } from '@/features/filters/tracking-filter/types';
import TrackingFilterHeader from '@/features/filters/tracking-filter/components/TrackingFilterHeader';
import TrackingFilterDateFields from '@/features/filters/tracking-filter/components/TrackingFilterDateFields';
import TrackingFilterBuyerSelect from '@/features/filters/tracking-filter/components/TrackingFilterBuyerSelect';
import TrackingFilterMetrics from '@/features/filters/tracking-filter/components/TrackingFilterMetrics';
import TrackingFilterResults from '@/features/filters/tracking-filter/components/TrackingFilterResults';

interface PageProps {
  params: Promise<{ dept: string }>;
}

export default function TrackingFilterScreen({ params }: PageProps) {
  const resolvedParams = use(params);
  const dept = resolvedParams.dept || 'knitting';
  const config = PVATF_CONFIGS[dept] || { title: `${dept.toUpperCase()} Tracking Filter` };
  const showUnitProcess = isUnitProcessDept(dept);

  // Default dates
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmt = (d: Date) => {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  };

  const [fromDate, setFromDate] = useState(fmt(firstDay));
  const [toDate, setToDate] = useState(fmt(today));
  const [dateType, setDateType] = useState<DateField>('planStart');
  const [resultFilter, setResultFilter] = useState<'all' | 'pass' | 'fail'>('all');

  // Buyers
  const [selectedBuyers, setSelectedBuyers] = useState<string[]>([]);
  const [buyerDropdownOpen, setBuyerDropdownOpen] = useState(false);
  const [buyerSearch, setBuyerSearch] = useState('');

  // Units (Dyeing / Delivery / Delivery Floor); [] means "All Units"
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const [previewUnits, setPreviewUnits] = useState<string[]>([]);

  // Data (tagged with the department it was loaded for)
  const [dataset, setDataset] = useState<(TrackingDataset & { dept: string }) | null>(() =>
    cachedTrackingFilterData[dept] ? { ...cachedTrackingFilterData[dept], dept } : null
  );
  const [refreshing, setRefreshing] = useState(false);
  const [filteredRows, setFilteredRows] = useState<TrackingResultRow[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  const current = dataset && dataset.dept === dept ? dataset : null;
  const allRows = current ? current.rows : [];
  const allBuyers = current ? current.buyers : [];
  const unitOptions = current ? current.units : [];
  const loading = refreshing || !current;

  // Summary Metrics
  const [metrics, setMetrics] = useState({
    total: 0,
    startPass: 0,
    startPassPct: '0%',
    startFail: 0,
    startFailPct: '0%',
    endPass: 0,
    endPassPct: '0%',
    endFail: 0,
    endFailPct: '0%',
  });

  // Load tracking data whenever the department changes (unit selection resets to All Units).
  useEffect(() => {
    let cancelled = false;
    loadTrackingFilterData(dept).then((data) => {
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
      const data = await loadTrackingFilterData(dept, true);
      setDataset((prev) => (prev && prev.dept !== dept ? prev : { ...data, dept }));
      setSelectedUnits((prev) => prev.filter((u) => data.units.includes(u)));
    } finally {
      setRefreshing(false);
    }
  };

  const handlePreview = () => {
    if (!fromDate || !toDate) {
      alert('Please select both From and To dates.');
      return;
    }

    const buyerSet = new Set(selectedBuyers.map((b) => b.toLowerCase()));
    const unitsApplied = showUnitProcess ? selectedUnits : [];
    const matchesUnit = createUnitMatcher(unitsApplied);

    const filtered = allRows
      .filter((r) => {
        const d = r[dateType];
        if (!d || d < fromDate || d > toDate) return false;
        if (buyerSet.size > 0 && !buyerSet.has(String(r.buyer || '').toLowerCase())) return false;
        if (!matchesUnit(r.unit)) return false;
        return true;
      })
      .map((r): TrackingResultRow => ({
        ...r,
        startResult: calcTrackingResult(r.actualStart, r.planStart),
        endResult: calcTrackingResult(r.actualEnd, r.planEnd),
      }))
      .filter((r) => {
        if (resultFilter === 'pass') {
          return r.startResult === 'Pass' || r.endResult === 'Pass';
        }
        if (resultFilter === 'fail') {
          return r.startResult === 'Fail' || r.endResult === 'Fail';
        }
        return true;
      });

    // Compute Metrics (percentage summary over the unit/buyer/date-filtered rows)
    const total = filtered.length;
    const startPass = filtered.filter((r) => r.startResult === 'Pass').length;
    const startFail = filtered.filter((r) => r.startResult === 'Fail').length;
    const endPass = filtered.filter((r) => r.endResult === 'Pass').length;
    const endFail = filtered.filter((r) => r.endResult === 'Fail').length;

    const pct = (n: number) => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%');

    setMetrics({
      total,
      startPass,
      startPassPct: pct(startPass),
      startFail,
      startFailPct: pct(startFail),
      endPass,
      endPassPct: pct(endPass),
      endFail,
      endFailPct: pct(endFail),
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

    const headers = showUnitProcess
      ? ['SL', 'Order/Booking No.', 'Buyer', 'Unit', 'Process Name', 'Plan Start', 'Plan End', 'Actual Start', 'Actual End', 'Start Result', 'End Result', 'Fail Reason', 'Related Dept.']
      : ['SL', 'Order/Booking No.', 'Buyer', 'Plan Start', 'Plan End', 'Actual Start', 'Actual End', 'Start Result', 'End Result', 'Fail Reason', 'Related Dept.'];

    const exportData = filteredRows.map((r, i) => {
      if (showUnitProcess) {
        return {
          'SL': i + 1,
          'Order/Booking No.': r.orderNo,
          'Buyer': r.buyer,
          'Unit': r.unit || '',
          'Process Name': r.processName || '',
          'Plan Start': r.planStart,
          'Plan End': r.planEnd,
          'Actual Start': r.actualStart,
          'Actual End': r.actualEnd,
          'Start Result': r.startResult,
          'End Result': r.endResult,
          'Fail Reason': r.failReason,
          'Related Dept.': r.relatedDept,
        };
      }
      return {
        'SL': i + 1,
        'Order/Booking No.': r.orderNo,
        'Buyer': r.buyer,
        'Plan Start': r.planStart,
        'Plan End': r.planEnd,
        'Actual Start': r.actualStart,
        'Actual End': r.actualEnd,
        'Start Result': r.startResult,
        'End Result': r.endResult,
        'Fail Reason': r.failReason,
        'Related Dept.': r.relatedDept,
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData, { header: headers });
    ws['!cols'] = headers.map((c) => ({ wch: Math.max(12, Math.min(26, c.length + 3)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${dept.toUpperCase()} Tracking Filter`);
    XLSX.writeFile(wb, `${dept}_tracking_filter_${Date.now()}.xlsx`);
  };

  const filteredBuyerOptions = allBuyers.filter((b) =>
    b.toLowerCase().includes(buyerSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <TrackingFilterHeader title={config.title} loading={loading} handleRefresh={handleRefresh} />

      {/* Filter Parameters */}
      <div className="card bg-base-100 border border-base-300 p-5 shadow-sm space-y-5">
        <h3 className="font-bold text-sm text-base-content/80 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Filter Parameters
        </h3>

        <TrackingFilterDateFields
          fromDate={fromDate}
          setFromDate={setFromDate}
          toDate={toDate}
          setToDate={setToDate}
          dateType={dateType}
          setDateType={setDateType}
          resultFilter={resultFilter}
          setResultFilter={setResultFilter}
        />

        {/* Buyer & Unit Selection */}
        <div className="pt-2 border-t border-base-200 flex flex-col md:flex-row gap-4">
          <TrackingFilterBuyerSelect
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

          {/* Unit Multi-select (Dyeing / Delivery / Delivery Floor) */}
          {showUnitProcess && (
            <div className="w-full max-w-md">
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
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={handlePreview}
            disabled={loading}
            className="btn btn-primary btn-sm gap-2 font-bold shadow-md shadow-primary/20"
          >
            <Eye className="h-4 w-4" />
            Preview Conformance Analysis
          </button>
        </div>
      </div>

      {/* Preview Section */}
      {previewOpen && (
        <div className="space-y-4">
          {/* Conformance Metrics Bar */}
          <TrackingFilterMetrics metrics={metrics} />

          {/* Table Card */}
          <TrackingFilterResults
            filteredRows={filteredRows}
            dateType={dateType}
            fromDate={fromDate}
            toDate={toDate}
            selectedBuyers={selectedBuyers}
            showUnitProcess={showUnitProcess}
            previewUnits={previewUnits}
            handleExportExcel={handleExportExcel}
          />
        </div>
      )}
    </div>
  );
}
