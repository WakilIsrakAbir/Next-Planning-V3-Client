import TrackingReportScreen from '@/features/tracking/components/TrackingReportScreen';
import { TRACKING_DEPT_KEYS, deptParams } from '@/lib/constants';

export const generateStaticParams = () => deptParams(TRACKING_DEPT_KEYS);

export default function Page({ params }: { params: Promise<{ dept: string }> }) {
  return <TrackingReportScreen params={params} />;
}
