/* Batch Plan module (Batch Plan, Batch Card, Batch Reports). The Batch Setup pages (Dyeing MC, Flat Allowance,
   Unit Setup) live under /management/setup and render BatchProvider in their own layout
   (app/(dashboard)/management/setup/(batch)/layout.tsx).
   BatchProvider loads the Batch data once and stays mounted while the user moves between these routes. */
import BatchProvider from '@/features/batch/components/shell/BatchProvider';

export default function BatchLayout({ children }: { children: React.ReactNode }) {
  return <BatchProvider>{children}</BatchProvider>;
}
