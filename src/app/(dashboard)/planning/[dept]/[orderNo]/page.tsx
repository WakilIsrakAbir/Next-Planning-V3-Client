import OrderPlanningScreen from '@/features/planning/order-page/components/OrderPlanningScreen';
import { deptPlanName } from '@/lib/page-title';

export default function Page() {
  return <OrderPlanningScreen />;
}

export async function generateMetadata({ params }: { params: Promise<{ dept: string; orderNo: string }> }) {
  const { dept, orderNo } = await params;
  return { title: `Order ${decodeURIComponent(orderNo)} – ${deptPlanName(dept)}` };
}
