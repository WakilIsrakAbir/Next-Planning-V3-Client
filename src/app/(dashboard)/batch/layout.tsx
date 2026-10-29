/* Batch Plan module (Batch Plan, Batch Card, Batch Reports and the Setup pages).
   BatchProvider loads the Batch data once and stays mounted while the user moves between these routes. */
import '@/features/batch/styles/batch.css';
import BatchProvider from '@/features/batch/components/shell/BatchProvider';

export default function BatchLayout({ children }: { children: React.ReactNode }) {
  return <BatchProvider>{children}</BatchProvider>;
}
