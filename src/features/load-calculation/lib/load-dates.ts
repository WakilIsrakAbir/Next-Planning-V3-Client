export function excelSerialToLocalDate(serial: number): Date {
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function parseLoadDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  if (typeof value === 'number' && value > 25000 && value < 70000) return excelSerialToLocalDate(value);
  const text = String(value).trim();
  if (/^\d{5}$/.test(text)) {
    const num = Number(text);
    if (num > 25000 && num < 70000) return excelSerialToLocalDate(num);
  }
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const dmyMatch = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) return new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function startOfLoadDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addLoadMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

export function loadMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function minLoadDate(date1: Date, date2: Date): Date {
  return date1 <= date2 ? date1 : date2;
}

export function maxLoadDate(date1: Date, date2: Date): Date {
  return date1 >= date2 ? date1 : date2;
}

export function inclusiveLoadDays(startDate: Date, endDate: Date): number {
  return Math.floor((startOfLoadDay(endDate).getTime() - startOfLoadDay(startDate).getTime()) / 86400000) + 1;
}

export function formatLoadMonthHeader(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short' });
}

export function formatSummaryMonthHeader(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long' });
}

export function formatLoadMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '-');
}

export function formatLoadDate(dateValue: unknown): string {
  const date = parseLoadDate(dateValue);
  if (!date) return '';
  return date.getDate() + '-' + date.toLocaleDateString('en-US', { month: 'short' });
}

export function getReportMonths(startMonth: string): Date[] {
  const [year, month] = startMonth.split('-').map(Number);
  const firstMonth = new Date(year, month - 1, 1);
  return Array.from({ length: 5 }, (_, i) => addLoadMonths(firstMonth, i));
}
