import PlanFilterScreen from '@/features/filters/components/PlanFilterScreen';

export default function Page({ params }: { params: Promise<{ dept: string }> }) {
  return <PlanFilterScreen params={params} />;
}
