import DepartmentPlanningScreen from '@/features/planning/components/DepartmentPlanningScreen';
import { PLAN_DEPT_KEYS, deptParams } from '@/lib/constants';

export const generateStaticParams = () => deptParams(PLAN_DEPT_KEYS);

export default function Page({ params }: { params: Promise<{ dept: string }> }) {
  return <DepartmentPlanningScreen params={params} />;
}
