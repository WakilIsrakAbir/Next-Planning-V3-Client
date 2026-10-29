import TrackingReportScreen from '@/features/tracking/components/TrackingReportScreen';

export default function Page({ params }: { params: Promise<{ dept: string }> }) {
  return <TrackingReportScreen params={params} />;
}
