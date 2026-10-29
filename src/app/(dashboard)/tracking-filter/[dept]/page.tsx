import TrackingFilterScreen from '@/features/filters/components/TrackingFilterScreen';
import { FILTER_DEPT_KEYS, deptParams } from '@/lib/constants';

export const generateStaticParams = () => deptParams(FILTER_DEPT_KEYS);

export default function Page({ params }: { params: Promise<{ dept: string }> }) {
  return <TrackingFilterScreen params={params} />;
}
