import DepartmentPlanningScreen from '@/features/planning/components/DepartmentPlanningScreen';

export default function Page({ params }: { params: Promise<{ dept: string }> }) {
  return <DepartmentPlanningScreen params={params} />;
}
