'use client';

import { CircleAlert, CircleCheck } from 'lucide-react';
import type { PPIToastState } from '@/features/reports/planning-prod-info/types';

export default function PPIToast({ toast }: { toast: PPIToastState }) {
  return (
    <div className="fixed top-5 right-5 z-50">
      <div
        className={`alert ${
          toast.type === 'success' ? 'alert-success' : 'alert-error'
        } shadow-lg text-xs font-bold py-2.5 px-4 rounded border`}
      >
        {toast.type === 'success' ? <CircleCheck className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
