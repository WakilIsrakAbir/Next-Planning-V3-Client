import TrackingFilterScreen from '@/features/filters/components/TrackingFilterScreen';

export default function Page({ params }: { params: Promise<{ dept: string }> }) {
  return <TrackingFilterScreen params={params} />;
}
