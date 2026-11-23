'use client';

/** A department's plan status in the order list: Confirm (green), Tentative (amber), otherwise grey ("Pending" when empty). */
export default function PlanStatusBadge({ status }: { status?: string }) {
  return (
    <span
      className={`badge badge-xs font-bold ${
        status === 'Confirm'
          ? 'badge-success text-white'
          : status === 'Tentative'
          ? 'badge-warning text-white'
          : 'badge-ghost'
      }`}
    >
      {status || 'Pending'}
    </span>
  );
}
