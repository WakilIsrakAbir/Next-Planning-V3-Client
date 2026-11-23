import DepartmentReportScreen from '@/features/reports/department/components/DepartmentReportScreen';
import { PLAN_LIST_KEYS, deptParams } from '@/lib/constants';
import { deptShortName } from '@/lib/page-title';

// US-12: also the Delivery Plan (Floor) and (Lock) reports.
export const generateStaticParams = () => deptParams(PLAN_LIST_KEYS);

export default function Page({ params }: { params: Promise<{ dept: string }> }) {
  return <DepartmentReportScreen params={params} />;
}

export async function generateMetadata({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  return { title: `Updated ${deptShortName(dept)} Report` };
}
