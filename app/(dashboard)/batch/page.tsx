import { redirect } from 'next/navigation';

// /batch opens the Batch Plan register.
export default function BatchIndexPage() {
  redirect('/batch/plan');
}
