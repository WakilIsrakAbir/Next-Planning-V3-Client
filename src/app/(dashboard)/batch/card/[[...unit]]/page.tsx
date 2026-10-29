/* /batch/card (all orders, or the first unit the user may open) and /batch/card/<UNIT>. */
import { notFound } from 'next/navigation';
import BatchRouteGuard from '@/features/batch/components/shell/BatchRouteGuard';
import BatchCardPage from '@/features/batch/components/card/BatchCardPage';

export default async function Page({ params }: { params: Promise<{ unit?: string[] }> }) {
  const { unit } = await params;
  if (unit && (unit.length > 1 || !/^[A-Za-z0-9]{1,40}$/.test(unit[0]))) notFound();
  const key = unit ? unit[0].toUpperCase() : null;
  return (
    <BatchRouteGuard route={key ? 'card/' + key : 'card'}>
      <BatchCardPage unit={key} />
    </BatchRouteGuard>
  );
}
