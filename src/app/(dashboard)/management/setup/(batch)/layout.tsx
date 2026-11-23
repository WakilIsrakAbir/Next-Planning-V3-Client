/* Data Management > Setup > Dyeing MC, Flat Allowance, Unit Setup (/management/setup/dyeing-mc | flat-allowance |
   unit): Batch Plan module pages, so they render in BatchProvider like the /batch routes (app/(dashboard)/batch/layout.tsx).
   BatchProvider keeps the Batch data in module state, so moving between these pages and /batch does not reload it.
   Dropdown Master Setup (/management/setup/dropdowns) is outside this route group and has no BatchProvider. */
import BatchProvider from '@/features/batch/components/shell/BatchProvider';

export default function BatchSetupLayout({ children }: { children: React.ReactNode }) {
  return <BatchProvider>{children}</BatchProvider>;
}
