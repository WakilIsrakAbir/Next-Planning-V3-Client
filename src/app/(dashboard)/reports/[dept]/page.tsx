import DepartmentReportScreen from '@/features/reports/components/DepartmentReportScreen';

export default function Page({ params }: { params: Promise<{ dept: string }> }) {
  return <DepartmentReportScreen params={params} />;
}
