import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harnessState } from '../harness/state';
import { buildOttBoard, formatOttDate, OTT_BOARD_DEPTS, toDay, type OttCard } from '@/features/tracking/ott-board/lib/ott-board';
import type { Loose } from '../harness/types';

// US-11 (TASK-11.6): the OTT board of an order, and its popup on the Plan Vs Actual Tracking lists.

const TODAY = new Date('2026-10-20T06:00:00.000Z'); // 20 Oct 2026, 12:00 in Dhaka

beforeEach(() => {
  vi.useFakeTimers({ now: TODAY, toFake: ['Date'] });
});
afterEach(() => {
  vi.useRealTimers();
  harnessState().fetchHandler = null;
});

const card = (cards: OttCard[], key: string) => cards.find((c) => c.key === key) as OttCard;
const brief = (c: OttCard) => c.lines.map((l) => `${l.label}: ${l.plan || '-'} / ${l.actual || '-'} ${l.status}${l.reason || l.dept ? ` (${l.reason} | ${l.dept})` : ''}`);

const planData: Loose = {
  yd: [
    { startDate: '2026-10-03', endDate: '2026-10-08' },
    { startDate: '2026-10-01', endDate: '2026-10-09' },
  ],
  knitting: [
    { yarnDate: '2026-10-02', startDate: '2026-10-05', endDate: '2026-10-15' },
    { yarnDate: '2026-09-30', startDate: '', planStart: '2026-10-04', endDate: '2026-10-16' },
  ],
  dyeing: [{ startDate: '2026-10-16', endDate: '2026-10-25' }],
  delivery: [
    { floorStartDate: '2026-10-23', floorEndDate: '2026-11-01', startDate: '2026-10-26', endDate: '2026-11-05' },
    { floorStartDate: '2026-10-24', floorEndDate: '2026-11-02', startDate: '', endDate: '' },
  ],
  ydActual: { actualStart: '2026-10-01', actualEnd: '2026-10-12', failReason: 'Yarn late', relatedDept: 'Store' },
  knittingActual: { actualStart: '2026-10-04', actualEnd: '' },
  deliveryActual: { actualStart: '2026-10-25', actualEnd: '', failReason: 'Machine', relatedDept: 'Dyeing' },
  planExtras: { knitting: { a: { actualYarnDate: '2026-09-29' }, b: { actualYarnDate: '2026-10-01' }, c: { actualYarnDate: '' } } },
};

describe('buildOttBoard', () => {
  it('six cards: plan = earliest start / latest end of the saved rows, actuals from <dept>Actual, Pass/Fail = calcOTTStatus', () => {
    const cards = buildOttBoard({ yarnDate: '2026-09-25' }, planData);
    expect(cards.map((c) => c.title)).toEqual(['Yarn', 'YD', 'Knitting', 'Dyeing', 'Delivery Floor', 'Delivery Lock']);
    // Yarn: earliest knitting Yarn Date (not the T&A date), latest Actual Yarn Date.
    expect(brief(card(cards, 'yarn'))).toEqual(['Yarn: 2026-09-30 / 2026-10-01 Fail']);
    expect(brief(card(cards, 'yd'))).toEqual(['Start: 2026-10-01 / 2026-10-01 Pass', 'End: 2026-10-09 / 2026-10-12 Fail (Yarn late | Store)']);
    // planStart counts when startDate is blank; no actual End and the plan is past (today 20 Oct): Fail.
    expect(brief(card(cards, 'knitting'))).toEqual(['Start: 2026-10-04 / 2026-10-04 Pass', 'End: 2026-10-16 / - Fail']);
    // No actuals, plan not past for End: —; Start plan past: Fail.
    expect(brief(card(cards, 'dyeing'))).toEqual(['Start: 2026-10-16 / - Fail', 'End: 2026-10-25 / - —']);
    // Floor and Lock share deliveryActual.
    expect(brief(card(cards, 'deliveryFloor'))).toEqual(['Start: 2026-10-23 / 2026-10-25 Fail (Machine | Dyeing)', 'End: 2026-11-02 / - —']);
    expect(brief(card(cards, 'deliveryLock'))).toEqual(['Start: 2026-10-26 / 2026-10-25 Pass', 'End: 2026-11-05 / - —']);
    expect(cards.every((c) => !c.noData)).toBe(true);
  });

  it('"No booking data" without plan dates and actuals; Yarn falls back to the T&A Yarn date (Excel serial too)', () => {
    const cards = buildOttBoard({ yarnDate: 46300 }, { knitting: [{ startDate: '' }] });
    expect(card(cards, 'yarn').lines[0].plan).toBe('2026-10-05');
    expect(card(cards, 'yarn').noData).toBe(false);
    for (const key of ['yd', 'knitting', 'dyeing', 'deliveryFloor', 'deliveryLock']) expect(card(cards, key).noData).toBe(true);
    expect(buildOttBoard({}, null).every((c) => c.noData)).toBe(true);
  });

  it('dates: stored values as local days, shown "dd Mmm yy"', () => {
    expect(toDay('2026-10-05')).toBe('2026-10-05');
    expect(toDay('2026-10-04T18:00:00.000Z')).toBe('2026-10-05');
    expect(toDay('-')).toBe('');
    expect(toDay('')).toBe('');
    expect(toDay('garbage')).toBe('');
    expect(formatOttDate('2026-10-05')).toBe('05 Oct 26');
    expect(formatOttDate('')).toBe('—');
    expect(OTT_BOARD_DEPTS).toEqual(['yd', 'knitting', 'dyeing', 'delivery', 'deliveryfloor']);
  });
});

describe('OttBoardModal', () => {
  it('reads the order detail and shows the cards with the Booking No.', async () => {
    const urls: string[] = [];
    harnessState().fetchHandler = async (input: unknown) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ order: { orderNo: 'B-1', yarnDate: '2026-09-25' }, planData }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    vi.resetModules();
    const { default: OttBoardModal } = await import('@/features/tracking/ott-board/components/OttBoardModal');
    const onClose = vi.fn();
    await act(async () => {
      render(<OttBoardModal orderNo="B-1" dept="deliveryfloor" onClose={onClose} />);
    });
    await screen.findByText('YD');
    expect(urls[0]).toContain('/api/orders/B-1?dept=delivery');
    expect(screen.getByRole('dialog').textContent).toContain('OTT Board — Same Booking Status');
    expect(screen.getByRole('dialog').textContent).toContain('Booking No.: B-1');
    const yd = document.querySelector('[data-ott-card="yd"]') as HTMLElement;
    expect(within(yd).getByText('Pass').className).toContain('text-success');
    expect(within(yd).getByText('Fail').className).toContain('text-error');
    expect(yd.textContent).toContain('Plan 09 Oct 26 • Actual 12 Oct 26');
    expect(yd.textContent).toContain('Reason: Yarn late • Dept: Store');
    expect(yd.querySelector('.border-dashed')).not.toBeNull();
    fireEvent.click(screen.getByLabelText('Close OTT board'));
    expect(onClose).toHaveBeenCalled();
  });
});
