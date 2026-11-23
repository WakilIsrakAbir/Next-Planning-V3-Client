'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import type { LoadRow } from '@/features/load-calculation/lib/load-calc-utils';
import { cachedGlobalLoadData, fetchLoadRowsForDept } from '@/features/load-calculation/lib/load-data-cache';
import { formatLoadMonthYear, getReportMonths } from '@/features/load-calculation/lib/load-dates';
import { formatExcelWorksheet } from '@/features/load-calculation/lib/excel-worksheet';
import { buildReportData, buildSummaryData } from '@/features/load-calculation/lib/load-report-data';
import { LoadCalculationHeader } from '@/features/load-calculation/components/LoadCalculationHeader';
import { ReportMonthSelector } from '@/features/load-calculation/components/ReportMonthSelector';
import { LoadDownloadButtons } from '@/features/load-calculation/components/LoadDownloadButtons';
import { DetailedReportsView } from '@/features/load-calculation/components/DetailedReportsView';
import { BuyerSummaryPanel } from '@/features/load-calculation/components/BuyerSummaryPanel';

function LoadCalculationContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'detailed' | 'summary'>(
    tabParam === 'detailed' ? 'detailed' : 'summary'
  );

  // Follow ?tab= changes (sidebar links) by adjusting state during render
  const [prevTabParam, setPrevTabParam] = useState(tabParam);
  if (tabParam !== prevTabParam) {
    setPrevTabParam(tabParam);
    if (tabParam === 'detailed' || tabParam === 'summary') {
      setActiveTab(tabParam);
    }
  }

  // Initial state: starts unselected for immediate 0s page load, matching Exp showLoadCalculation
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingDept, setDownloadingDept] = useState<string | null>(null);

  // Month selector
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [startMonth, setStartMonth] = useState(currentMonthStr);

  // Department data state
  const [departmentData, setDepartmentData] = useState<Record<string, LoadRow[]>>(() => ({ ...cachedGlobalLoadData }));

  // Generate 5 months array
  const reportMonths = useMemo(() => getReportMonths(startMonth), [startMonth]);
  const monthLabels = reportMonths.map((d) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));

  // Month options (-12 to +24) matching Exp initLoadMonthSelector
  const monthOptions = [];
  for (let i = -12; i <= 24; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const lbl = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '-');
    monthOptions.push({ val, lbl });
  }

  // Fetch load calculation data for department matching Exp logic with in-memory caching
  const ensureLoadDataForDept = async (deptKey: string): Promise<LoadRow[]> => {
    const cachedRows = cachedGlobalLoadData[deptKey];
    if (cachedRows && cachedRows.length > 0) {
      setDepartmentData((prev) => ({ ...prev, [deptKey]: cachedRows }));
      return cachedRows;
    }

    setLoading(true);
    try {
      const updates = await fetchLoadRowsForDept(deptKey);
      if (!updates) return [];
      setDepartmentData((prev) => ({ ...prev, ...updates }));
      return updates[deptKey] || [];
    } catch (err) {
      console.error(`Error loading load calculation data for ${deptKey}:`, err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Detailed Load Excel Download (Matching Exp downloadLoadReport)
  const downloadDetailedExcel = async (deptKey: string) => {
    setDownloadingDept(deptKey);
    try {
      const rows = await ensureLoadDataForDept(deptKey);
      const { config, reportMonths: rMonths, headers, rows: detailRows } = buildReportData(deptKey, rows, reportMonths);
      if (!detailRows.length) {
        alert(`No ${config.name} load data found for this period.`);
        return;
      }

      const worksheetData = [headers, ...detailRows.map((r) => r.excelRow)];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      worksheet['!autofilter'] = {
        ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: detailRows.length, c: headers.length - 1 } }),
      };
      worksheet['!cols'] = headers.map((header: string) => {
        if (header.includes('Date') || header.includes('Construction') || header.includes('Process')) return { wch: 21 };
        return { wch: Math.max(10, Math.min(String(header).length + 3, 18)) };
      });

      formatExcelWorksheet(worksheet);

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `${config.name} Load`);
      const filename = `${config.name}_Load_${formatLoadMonthYear(rMonths[0])}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (err) {
      console.error('Error downloading detailed report:', err);
      alert('Error generating detailed report');
    } finally {
      setDownloadingDept(null);
    }
  };

  // Summary Load Excel Download (Matching Exp downloadLoadSummary)
  const downloadSummaryExcel = async (deptKey?: string) => {
    const targetDept = deptKey || selectedDept;
    if (!targetDept) return;
    setDownloadingDept(targetDept);
    try {
      const rows = await ensureLoadDataForDept(targetDept);
      const {
        config,
        reportMonths: rMonths,
        headers,
        rows: sRows,
        grandMonthlyTotals: gTotals,
        grandTotal: gTot,
      } = buildSummaryData(targetDept, rows, reportMonths);
      if (!sRows.length) {
        alert(`No ${config.name} summary data found.`);
        return;
      }

      const worksheetData = [
        headers,
        ...sRows.map((row) => [row.buyer, ...row.monthlyValues, row.total]),
        ['Grand Total', ...gTotals, gTot],
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      worksheet['!cols'] = [{ wch: 25 }, ...rMonths.map(() => ({ wch: 15 })), { wch: 15 }];
      formatExcelWorksheet(worksheet);

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `${config.name} Summary`);
      const filename = `${config.name}_Summary_${formatLoadMonthYear(rMonths[0])}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (err) {
      console.error('Error downloading summary report:', err);
      alert('Error generating summary report');
    } finally {
      setDownloadingDept(null);
    }
  };

  const summaryData = useMemo(
    () =>
      buildSummaryData(
        selectedDept,
        (selectedDept && (departmentData[selectedDept] || cachedGlobalLoadData[selectedDept])) || [],
        reportMonths
      ),
    [selectedDept, departmentData, reportMonths]
  );
  const summaryRows = summaryData.rows;
  const grandMonthlyTotals = summaryData.grandMonthlyTotals;
  const grandTotal = summaryData.grandTotal;

  return (
    <div className="space-y-6">
      {/* Header */}
      <LoadCalculationHeader activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Control Card - Report Month Selection & Download Actions matching Exp */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Month Selector Box */}
        <ReportMonthSelector
          startMonth={startMonth}
          setStartMonth={setStartMonth}
          monthOptions={monthOptions}
          monthLabels={monthLabels}
        />

        {/* Quick Action Download Buttons matching Exp */}
        <LoadDownloadButtons
          activeTab={activeTab}
          downloadingDept={downloadingDept}
          downloadDetailedExcel={downloadDetailedExcel}
          downloadSummaryExcel={downloadSummaryExcel}
        />
      </div>

      {/* View Content */}
      {activeTab === 'detailed' ? (
        /* MENU 1: Detailed Reports View */
        <DetailedReportsView downloadingDept={downloadingDept} downloadDetailedExcel={downloadDetailedExcel} />
      ) : (
        /* MENU 2: Buyer-wise Summary Live Table */
        <BuyerSummaryPanel
          selectedDept={selectedDept}
          setSelectedDept={setSelectedDept}
          ensureLoadDataForDept={ensureLoadDataForDept}
          loading={loading}
          reportMonths={reportMonths}
          summaryRows={summaryRows}
          grandMonthlyTotals={grandMonthlyTotals}
          grandTotal={grandTotal}
        />
      )}
    </div>
  );
}

export default function LoadCalculationScreen() {
  return (
    <Suspense
      fallback={
        <div className="relative min-h-[400px]">
          <LoadingSpinner
            message="Loading Capacity & Load Forecasting..."
            subMessage="Synchronizing 5-month projection matrix"
          />
        </div>
      }
    >
      <LoadCalculationContent />
    </Suspense>
  );
}
