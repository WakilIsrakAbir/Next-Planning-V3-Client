'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ExpLoadingSpinner from '@/components/common/ExpLoadingSpinner';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-100">
      <ExpLoadingSpinner message="Loading Epylion PPC Suite..." subMessage="Please wait" overlay={false} />
    </div>
  );
}
