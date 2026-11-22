import DepartmentReportScreen from '@/features/reports/components/DepartmentReportScreen';
import { PLAN_DEPT_KEYS, deptParams } from '@/lib/constants';
import { deptShortName } from '@/lib/page-title';

export const generateStaticParams = () => deptParams(PLAN_DEPT_KEYS);

export default function Page({ params }: { params: Promise<{ dept: string }> }) {
  return <DepartmentReportScreen params={params} />;
}

export async function generateMetadata({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  return { title: `Updated ${deptShortName(dept)} Report` };
}
