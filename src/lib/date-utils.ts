/**
 * Formats a date string into readable UK textile standard format: "24-Jul-2026"
 */
export function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr || dateStr === '-' || dateStr === 'N/A' || dateStr === 'undefined') return '—';
  const clean = String(dateStr).includes('T') ? dateStr : `${dateStr}T00:00:00`;
  const d = new Date(clean);
  if (isNaN(d.getTime())) return String(dateStr);
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/ /g, '-');
}

/**
 * Calculates lead-time variance: Actual Date - Plan Date
 */
export function calcLeadDay(planStr?: string, actStr?: string): string {
  if (!planStr || !actStr || planStr === '—' || actStr === '—' || planStr === '-' || actStr === '-') {
    return '—';
  }
  const pDate = new Date(String(planStr).includes('T') ? planStr : `${planStr}T00:00:00`);
  const aDate = new Date(String(actStr).includes('T') ? actStr : `${actStr}T00:00:00`);
  if (isNaN(pDate.getTime()) || isNaN(aDate.getTime())) return '—';

  const diffDays = Math.round(
    (aDate.setHours(0, 0, 0, 0) - pDate.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)
  );

  if (diffDays > 0) return `+${diffDays}`;
  if (diffDays === 0) return `0`;
  return `${diffDays}`;
}

/**
 * Determines On-Time Tracking (OTT) status: Pass / Fail
 */
export function calcOTTStatus(planStr?: string, actStr?: string): 'Pass' | 'Fail' | '—' {
  if (!planStr || planStr === '—' || planStr === '-') return '—';
  const pDate = new Date(String(planStr).includes('T') ? planStr : `${planStr}T00:00:00`);
  if (isNaN(pDate.getTime())) return '—';

  if (actStr && actStr !== '—' && actStr !== '-') {
    const aDate = new Date(String(actStr).includes('T') ? actStr : `${actStr}T00:00:00`);
    if (!isNaN(aDate.getTime())) {
      return aDate.setHours(0, 0, 0, 0) <= pDate.setHours(0, 0, 0, 0) ? 'Pass' : 'Fail';
    }
  }

  // When actual is empty, check if plan date has passed
  const today = new Date().setHours(0, 0, 0, 0);
  if (pDate.setHours(0, 0, 0, 0) < today) {
    return 'Fail';
  }

  return '—';
}

/**
 * Calculates remaining hours, minutes, and seconds until 12:00 AM Midnight Dhaka Time
 */
export function getDhakaCountdown(): { hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const dhakaOffsetMs = 6 * 60 * 60 * 1000;
  const dhakaNow = new Date(now.getTime() + dhakaOffsetMs);

  const nextDhakaMidnightUtc = new Date(
    Date.UTC(
      dhakaNow.getUTCFullYear(),
      dhakaNow.getUTCMonth(),
      dhakaNow.getUTCDate() + 1,
      0,
      0,
      0,
      0
    )
  );

  const nextMidnightTimestamp = nextDhakaMidnightUtc.getTime() - dhakaOffsetMs;
  const diffSec = Math.max(0, Math.floor((nextMidnightTimestamp - now.getTime()) / 1000));

  const hours = Math.floor(diffSec / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = diffSec % 60;

  return { hours, minutes, seconds };
}
