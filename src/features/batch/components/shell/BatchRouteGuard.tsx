'use client';

/* Menu permission for a Batch route (old showBatchModule / batchCanOpen): a unit page opens with that
   unit's permission or the all-orders permission; the plain Batch Plan / Batch Card page with any
   permission of the group. The server checks the same rules on every save. */
import React from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { batchCanOpenRoute, batchRouteInfo } from '@/lib/batch-module';

export default function BatchRouteGuard({ route, children }: { route: string; children: React.ReactNode }) {
  // The dashboard renders pages only on the client (after the session check), so localStorage is readable.
  const info = batchRouteInfo(route);
  if (info && batchCanOpenRoute(route)) return <>{children}</>;
  return (
    <div className="card" style={{ margin: 24, textAlign: 'center', padding: 40 }}>
      <ShieldAlert style={{ width: 40, height: 40, color: '#dc2626', margin: '0 auto 12px' }} />
      <h2 style={{ margin: 0 }}>Access Denied</h2>
      <p style={{ color: 'var(--text-muted)' }}>{(info?.title || 'Batch Plan') + ' permission required.'}</p>
      <Link href="/dashboard" className="btn">
        Back to Dashboard
      </Link>
    </div>
  );
}
