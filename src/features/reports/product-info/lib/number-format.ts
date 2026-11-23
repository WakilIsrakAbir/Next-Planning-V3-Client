export function parseNum(val: any): number | null {
  if (val === undefined || val === null || val === '' || val === '-' || val === '—') return null;
  const clean = String(val).replace(/,/g, '').replace(/%/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

export function formatNumDisplay(val: any, percent: boolean = false): string {
  const n = parseNum(val);
  if (n === null) return '—';
  if (percent) {
    const p = n <= 1 && n > 0 ? n * 100 : n;
    return `${p.toLocaleString('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: p % 1 === 0 ? 0 : 1,
    })}%`;
  }
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
