'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import InlineSpinner from '@/components/ui/InlineSpinner';
import { fetchOrderDetail } from '@/features/planning/lib/planning-cache';
import { buildOttBoard, formatOttDate, type OttCard, type OttLine } from '@/features/tracking/lib/ott-board';

/*
 * US-11 (TASK-11.6): "OTT Board — Same Booking Status" of one order, opened from a Plan Vs Actual Tracking row.
 * It reads the order detail (every department at once) and shows the Yarn, YD, Knitting, Dyeing, Delivery Floor and
 * Delivery Lock cards (see ott-board.ts).
 */

type BoardState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; cards: OttCard[] };

const STATUS_CLS: Record<string, string> = {
  Pass: 'text-success',
  Fail: 'text-error',
  '—': 'text-base-content/50',
};

function OttLineView({ line }: { line: OttLine }) {
  return (
    <div data-ott-line={line.label} className="space-y-0.5">
      <div className="font-bold">
        {line.label} — <span className={STATUS_CLS[line.status]}>{line.status}</span>
      </div>
      <div className="text-base-content/70">
        Plan {formatOttDate(line.plan)} • Actual {formatOttDate(line.actual)}
      </div>
      {line.status === 'Fail' && (
        <div className="text-base-content/70">
          Reason: {line.reason || '—'} • Dept: {line.dept || '—'}
        </div>
      )}
    </div>
  );
}

export default function OttBoardModal({ orderNo, dept, onClose }: { orderNo: string; dept: string; onClose: () => void }) {
  const [board, setBoard] = useState<BoardState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    // The detail answer holds every department, whatever `dept` is (Delivery Floor tracking reads the delivery plan).
    fetchOrderDetail(dept === 'deliveryfloor' ? 'delivery' : dept, orderNo)
      .then((res) => {
        if (!alive) return;
        if (!res.ok || !res.data?.order) {
          setBoard({ status: 'error', message: res.status === 404 ? 'Order not found.' : 'Could not load the order. Please try again.' });
          return;
        }
        setBoard({ status: 'ready', cards: buildOttBoard(res.data.order, res.data.planData) });
      })
      .catch(() => {
        if (alive) setBoard({ status: 'error', message: 'Could not load the order. Please try again.' });
      });
    return () => {
      alive = false;
    };
  }, [orderNo, dept]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="ott-board-title" data-ott-board={orderNo}>
      <div className="modal-box w-full max-w-3xl p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 id="ott-board-title" className="font-bold text-base">
              OTT Board — Same Booking Status
            </h3>
            <p className="text-xs text-base-content/70">
              Booking No.: <span className="font-bold text-primary">{orderNo}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm btn-square" aria-label="Close OTT board" autoFocus>
            <X className="h-4 w-4" />
          </button>
        </div>

        {board.status === 'loading' && (
          <div className="flex items-center justify-center gap-2 p-10 text-xs text-base-content/70">
            <InlineSpinner size={14} /> Loading…
          </div>
        )}
        {board.status === 'error' && <div className="alert alert-error text-xs">{board.message}</div>}
        {board.status === 'ready' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px]">
            {board.cards.map((card) => (
              <div key={card.key} data-ott-card={card.key} className="rounded-box border border-base-300 bg-base-100 p-3 space-y-2">
                <div className="font-bold text-xs uppercase tracking-wide">{card.title}</div>
                {card.noData ? (
                  <div className="text-base-content/50">No booking data</div>
                ) : (
                  card.lines.map((line, i) => (
                    <div key={line.label}>
                      {i > 0 && <div className="border-t border-dashed border-base-300 my-2" />}
                      <OttLineView line={line} />
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
    </div>
  );
}
