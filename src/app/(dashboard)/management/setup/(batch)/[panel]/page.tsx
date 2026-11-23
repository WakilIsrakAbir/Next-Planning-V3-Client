/* /management/setup/dyeing-mc (Dyeing MC), /management/setup/flat-allowance (Flat Allowance),
   /management/setup/unit (Unit Setup). The old /batch/setup/<panel> URLs redirect here (next.config.ts). */
import { notFound } from 'next/navigation';
import BatchRouteGuard from '@/features/batch/components/shell/BatchRouteGuard';
import BatchSetupPage from '@/features/batch/components/setup/BatchSetupPage';

// URL segment -> Batch Setup panel and page title.
const PAGES = {
  'dyeing-mc': { panel: 'dyeing', title: 'Dyeing MC' },
  'flat-allowance': { panel: 'flat', title: 'Flat Allowance' },
  unit: { panel: 'unit', title: 'Unit Setup' },
} as const;
type PageKey = keyof typeof PAGES;

const pageFor = (slug: string) => (Object.prototype.hasOwnProperty.call(PAGES, slug) ? PAGES[slug as PageKey] : null);

// Prerendered (served from the CDN, prefetched in full by the sidebar); other pages are 404.
export const generateStaticParams = () => Object.keys(PAGES).map((panel) => ({ panel }));
export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ panel: string }> }) {
  const { panel } = await params;
  const page = pageFor(panel);
  if (!page) notFound();
  return (
    <BatchRouteGuard route={'setup/' + page.panel}>
      <BatchSetupPage panel={page.panel} />
    </BatchRouteGuard>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ panel: string }> }) {
  const { panel } = await params;
  return { title: pageFor(panel)?.title ?? 'Batch Setup' };
}
