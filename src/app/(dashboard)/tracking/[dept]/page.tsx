import TrackingScreen from '@/features/tracking/tracking/components/TrackingScreen';
import { TRACKING_DEPT_KEYS, deptParams } from '@/lib/constants';
import { deptShortName } from '@/lib/page-title';

export const generateStaticParams = () => deptParams(TRACKING_DEPT_KEYS);

export default function Page({ params }: { params: Promise<{ dept: string }> }) {
  return <TrackingScreen params={params} />;
}

export async function generateMetadata({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  return { title: `${deptShortName(dept)} – Plan Vs Actual Tracking` };
}
