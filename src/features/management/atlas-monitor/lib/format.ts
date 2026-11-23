// ---------- formatting ----------
export const MB = 1024 * 1024; // the Atlas cluster card shows its 512 MB limit in these units
export function fmtMB(bytes: number | undefined | null): string {
  if (!bytes) return '0 MB';
  const v = bytes / MB;
  if (v < 0.1) {
    // small sizes keep their real value, in KB
    const kb = bytes / 1024;
    return (kb < 10 ? String(Math.round(kb * 10) / 10) : Math.round(kb).toLocaleString('en-US')) + ' KB';
  }
  return (v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1)) + ' MB';
}
export const fmtInt = (n: number | undefined | null): string => Number(n || 0).toLocaleString('en-US');
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDay(day: string, withYear = false): string {
  const [y, m, d] = String(day).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ' ' + y : ''}`;
}
export function fmtDateTime(iso: string | undefined | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}
export const pct = (part: number, whole: number): number => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
export const errorText = (e: unknown, fallback: string): string => (e instanceof Error && e.message ? e.message : fallback);
export const niceStep = (max: number, ticks: number): number => {
  const raw = max / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => st >= raw) || raw;
};
