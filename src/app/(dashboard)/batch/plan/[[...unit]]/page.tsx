/* /batch/plan (all orders, or the first unit the user may open) and /batch/plan/<UNIT> (one Dyeing Plan unit). */
import { notFound } from 'next/navigation';
import BatchRouteGuard from '@/features/batch/components/shell/BatchRouteGuard';
import BatchPlanPage from '@/features/batch/components/plan/BatchPlanPage';

// /batch/plan is prerendered; a unit page is rendered on its first request and then served from the cache
// (the units come from the data, so they are not known at build time).
export const generateStaticParams = (): { unit?: string[] }[] => [{ unit: undefined }];

export default async function Page({ params }: { params: Promise<{ unit?: string[] }> }) {
  const { unit } = await params;
  if (unit && (unit.length > 1 || !/^[A-Za-z0-9]{1,40}$/.test(unit[0]))) notFound();
  const key = unit ? unit[0].toUpperCase() : null;
  return (
    <BatchRouteGuard route={key ? 'plan/' + key : 'plan'}>
      <BatchPlanPage unit={key} />
    </BatchRouteGuard>
  );
}
