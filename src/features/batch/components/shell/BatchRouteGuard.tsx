'use client';

/* Menu permission for a Batch route (old showBatchModule / batchCanOpen): a unit page opens with that
   unit's permission or the all-orders permission; the plain Batch Plan / Batch Card page with any
   permission of the group. The server checks the same rules on every save. */
import React from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { batchCanOpenRoute, batchRouteInfo } from '@/features/batch/lib/batch-navigation';
import { button, card } from '../ui/styles';

export default function BatchRouteGuard({ route, children }: { route: string; children: React.ReactNode }) {
  // The dashboard renders pages only on the client (after the session check), so localStorage is readable.
  const info = batchRouteInfo(route);
  if (info && batchCanOpenRoute(route)) return <>{children}</>;
  return (
    <div className={cn(card, 'm-6 p-10 text-center')}>
      <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-[#dc2626]" />
      <h2 className="m-0 text-xl font-bold">Access Denied</h2>
      <p className="text-batch-muted">{(info?.title || 'Batch Plan') + ' permission required.'}</p>
      <Link href="/dashboard" className={button('primary')}>
        Back to Dashboard
      </Link>
    </div>
  );
}
