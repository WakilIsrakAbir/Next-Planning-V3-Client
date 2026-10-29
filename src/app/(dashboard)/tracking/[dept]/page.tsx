import TrackingScreen from '@/features/tracking/components/TrackingScreen';

export default function Page({ params }: { params: Promise<{ dept: string }> }) {
  return <TrackingScreen params={params} />;
}
