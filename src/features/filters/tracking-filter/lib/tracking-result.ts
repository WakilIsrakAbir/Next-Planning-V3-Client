import type { TrackingResult } from '@/features/filters/tracking-filter/types';

export function calcTrackingResult(actualDateStr?: string, planDateStr?: string): TrackingResult {
  const hasActual = actualDateStr && String(actualDateStr).trim() !== '' && String(actualDateStr).trim() !== '-';
  const hasPlan = planDateStr && String(planDateStr).trim() !== '' && String(planDateStr).trim() !== '-';

  if (hasActual) {
    if (!hasPlan) return '—';
    const aDate = new Date(actualDateStr).setHours(0, 0, 0, 0);
    const pDate = new Date(planDateStr).setHours(0, 0, 0, 0);
    return aDate <= pDate ? 'Pass' : 'Fail';
  }

  if (hasPlan) {
    const pDate = new Date(planDateStr).setHours(0, 0, 0, 0);
    const today = new Date().setHours(0, 0, 0, 0);
    if (pDate < today) return 'Fail';
  }

  return '—';
}
