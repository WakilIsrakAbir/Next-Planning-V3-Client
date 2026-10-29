/* /batch/report/detail (Dyeable Batch), /batch/report/summary (Dyeable Batch Summary),
   /batch/report/daily (Daily Confirm Batch Plan). */
import { notFound } from 'next/navigation';
import BatchRouteGuard from '@/features/batch/components/shell/BatchRouteGuard';
import BatchReportsPage from '@/features/batch/components/reports/BatchReportsPage';

const KINDS = ['detail', 'summary', 'daily'] as const;
type Kind = (typeof KINDS)[number];

export default async function Page({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!KINDS.includes(kind as Kind)) notFound();
  return (
    <BatchRouteGuard route={'report/' + kind}>
      <BatchReportsPage kind={kind as Kind} />
    </BatchRouteGuard>
  );
}
