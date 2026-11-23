import DepartmentPlanningScreen from '@/features/planning/list/components/DepartmentPlanningScreen';
import { PLAN_LIST_KEYS, deptParams } from '@/lib/constants';
import { deptPlanName } from '@/lib/page-title';

export const generateStaticParams = () => deptParams(PLAN_LIST_KEYS);

export default function Page({ params }: { params: Promise<{ dept: string }> }) {
  return <DepartmentPlanningScreen params={params} />;
}

export async function generateMetadata({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  return { title: deptPlanName(dept) };
}
