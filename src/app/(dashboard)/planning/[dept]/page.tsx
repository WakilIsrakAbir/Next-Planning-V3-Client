import DepartmentPlanningScreen from '@/features/planning/components/DepartmentPlanningScreen';
import { PLAN_LIST_KEYS, deptParams } from '@/lib/constants';

export const generateStaticParams = () => deptParams(PLAN_LIST_KEYS);

export default function Page({ params }: { params: Promise<{ dept: string }> }) {
  return <DepartmentPlanningScreen params={params} />;
}
