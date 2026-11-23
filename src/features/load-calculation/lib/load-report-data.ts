import { loadNumber, type LoadRow } from '@/features/load-calculation/lib/load-calc-utils';
import { LOAD_REPORT_CONFIG } from '@/features/load-calculation/lib/load-report-config';
import {
  addLoadMonths,
  formatLoadDate,
  formatLoadMonthHeader,
  formatSummaryMonthHeader,
  inclusiveLoadDays,
  loadMonthEnd,
  maxLoadDate,
  minLoadDate,
  parseLoadDate,
  startOfLoadDay,
} from '@/features/load-calculation/lib/load-dates';

export function calculateLoadAllocation(pendingQty: unknown, planStartVal: unknown, planEndVal: unknown, reportMonths: Date[]) {
  const qty = Math.max(0, loadNumber(pendingQty));
  const planStart = parseLoadDate(planStartVal);
  const planEnd = parseLoadDate(planEndVal);
  const today = startOfLoadDay(new Date());

  const emptyResult = { leadDay: 0, loadPerDay: 0, monthlyLoads: [0, 0, 0, 0, 0] };
  if (!planStart || !planEnd || qty <= 0) return emptyResult;

  if (planEnd.getTime() <= today.getTime()) {
    return {
      leadDay: 1,
      loadPerDay: Math.round(qty),
      monthlyLoads: reportMonths.map((_, index) => (index === 0 ? Math.round(qty) : 0)),
    };
  }

  const allocationStart = maxLoadDate(planStart, today);
  const leadDay = Math.max(1, inclusiveLoadDays(allocationStart, planEnd));

  const monthlyLoads = reportMonths.map((monthStart) => {
    const currentMonthEnd = loadMonthEnd(monthStart);
    const previousMonthEnd = loadMonthEnd(addLoadMonths(monthStart, -1));
    const currentCutoff = minLoadDate(planEnd, currentMonthEnd);
    const previousCutoff = minLoadDate(planEnd, previousMonthEnd);

    const currentDays = Math.max(0, inclusiveLoadDays(allocationStart, currentCutoff));
    const previousDays = Math.max(0, inclusiveLoadDays(allocationStart, previousCutoff));

    const currentCumulative = Math.round((qty * currentDays) / leadDay);
    const previousCumulative = Math.round((qty * previousDays) / leadDay);

    return Math.max(0, currentCumulative - previousCumulative);
  });

  return {
    leadDay,
    loadPerDay: Math.round(qty / leadDay),
    monthlyLoads,
  };
}

export interface DetailReportRow {
  source: LoadRow;
  excelRow: unknown[];
  monthlyLoads: number[];
}

export interface SummaryReportRow {
  buyer: string;
  monthlyValues: number[];
  total: number;
}

// Build Detailed Report Data matching Exp buildReportData
export function buildReportData(deptKey: string | null, sourceRows: LoadRow[], reportMonths: Date[]) {
  if (!deptKey) {
    return { config: LOAD_REPORT_CONFIG.knitting, reportMonths, headers: [] as string[], rows: [] as DetailReportRow[] };
  }
  const config = LOAD_REPORT_CONFIG[deptKey] || LOAD_REPORT_CONFIG.knitting;

  const headers = [
    ...config.columns,
    `${config.name} Plan Start Date`,
    `${config.name} Plan End Date`,
    `${config.name} Plan Type`,
    'Lead Day',
    'L/Day',
    ...reportMonths.map(formatLoadMonthHeader),
  ];

  const rows: DetailReportRow[] = sourceRows
    // Confirm / Tentative plans, plus Pending items that resolved T&A / Floor dates
    .filter((row) => Boolean(row.planStart && row.planEnd) || row.planType === 'Confirm' || row.planType === 'Tentative')
    .filter((row) => loadNumber(row[config.pendingQtyField]) > 0)
    .map((row) => {
      const allocation = calculateLoadAllocation(row[config.pendingQtyField], row.planStart, row.planEnd, reportMonths);
      return {
        source: row,
        excelRow: [
          ...config.columns.map((col) => (row[col] !== undefined && row[col] !== null ? row[col] : '')),
          formatLoadDate(row.planStart),
          formatLoadDate(row.planEnd),
          row.planType || '',
          allocation.leadDay,
          allocation.loadPerDay,
          ...allocation.monthlyLoads,
        ],
        monthlyLoads: allocation.monthlyLoads,
      };
    });

  return { config, reportMonths, headers, rows };
}

// Build Summary Data matching Exp buildSummaryData
export function buildSummaryData(deptKey: string | null, sourceRows: LoadRow[], reportMonths: Date[]) {
  if (!deptKey) {
    return {
      config: LOAD_REPORT_CONFIG.knitting,
      reportMonths,
      headers: ['Buyer', ...reportMonths.map(formatSummaryMonthHeader), 'Total [Kg]'],
      rows: [] as SummaryReportRow[],
      grandMonthlyTotals: [0, 0, 0, 0, 0],
      grandTotal: 0,
    };
  }

  const detailData = buildReportData(deptKey, sourceRows, reportMonths);
  const buyerMap = new Map<string, number[]>();

  detailData.rows.forEach((detailRow) => {
    const buyer = String(detailRow.source.Buyer || 'Unspecified').trim() || 'Unspecified';
    if (!buyerMap.has(buyer)) buyerMap.set(buyer, [0, 0, 0, 0, 0]);

    const buyerMonths = buyerMap.get(buyer)!;
    detailRow.monthlyLoads.forEach((val, idx) => {
      buyerMonths[idx] += loadNumber(val);
    });
  });

  const summaryRows: SummaryReportRow[] = Array.from(buyerMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
    .map(([buyer, monthlyValues]) => ({
      buyer,
      monthlyValues,
      total: monthlyValues.reduce((sum, v) => sum + v, 0),
    }));

  const grandMonthlyTotals = [0, 0, 0, 0, 0];
  summaryRows.forEach((row) => {
    row.monthlyValues.forEach((val, idx) => {
      grandMonthlyTotals[idx] += val;
    });
  });
  const grandTotal = grandMonthlyTotals.reduce((sum, v) => sum + v, 0);

  return {
    config: detailData.config,
    reportMonths: detailData.reportMonths,
    headers: ['Buyer', ...detailData.reportMonths.map(formatSummaryMonthHeader), 'Total [Kg]'],
    rows: summaryRows,
    grandMonthlyTotals,
    grandTotal,
  };
}
