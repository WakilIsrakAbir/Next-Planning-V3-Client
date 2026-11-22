import TrackingFilterScreen from '@/features/filters/components/TrackingFilterScreen';
import { FILTER_DEPT_KEYS, deptParams } from '@/lib/constants';
import { deptPlanName } from '@/lib/page-title';

export const generateStaticParams = () => deptParams(FILTER_DEPT_KEYS);

export default function Page({ params }: { params: Promise<{ dept: string }> }) {
  return <TrackingFilterScreen params={params} />;
}

export async function generateMetadata({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  return { title: `${deptPlanName(dept)} Tracking Filter` };
}
