import PlanFilterScreen from '@/features/filters/components/PlanFilterScreen';
import { FILTER_DEPT_KEYS, deptParams } from '@/lib/constants';

export const generateStaticParams = () => deptParams(FILTER_DEPT_KEYS);

export default function Page({ params }: { params: Promise<{ dept: string }> }) {
  return <PlanFilterScreen params={params} />;
}
