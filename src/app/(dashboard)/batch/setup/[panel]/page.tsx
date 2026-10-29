/* /batch/setup/dyeing (Dyeing MC), /batch/setup/flat (Flat Allowance), /batch/setup/unit (Unit Setup). */
import { notFound } from 'next/navigation';
import BatchRouteGuard from '@/features/batch/components/shell/BatchRouteGuard';
import BatchSetupPage from '@/features/batch/components/setup/BatchSetupPage';

const PANELS = ['dyeing', 'flat', 'unit'] as const;
type Panel = (typeof PANELS)[number];

// Prerendered (served from the CDN, prefetched in full by the sidebar); other panels are 404.
export const generateStaticParams = () => PANELS.map((panel) => ({ panel }));
export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ panel: string }> }) {
  const { panel } = await params;
  if (!PANELS.includes(panel as Panel)) notFound();
  return (
    <BatchRouteGuard route={'setup/' + panel}>
      <BatchSetupPage panel={panel as Panel} />
    </BatchRouteGuard>
  );
}
