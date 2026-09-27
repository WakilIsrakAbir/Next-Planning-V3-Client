'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import { API_BASE } from '@/lib/constants';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // If mobile screen, collapse by default
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }

    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setAuthorized(true);

    // Heartbeat daemon to maintain online status
    const pingHeartbeat = async () => {
      try {
        await fetch(`${API_BASE}/api/auth/heartbeat`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch {}
    };

    pingHeartbeat();
    const interval = setInterval(pingHeartbeat, 60000); // Every 60 seconds
    return () => clearInterval(interval);
  }, [router]);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-base-200 text-base-content antialiased">
      {/* Sidebar Navigation with smooth desktop collapse */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        onCloseMobile={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0 transition-all duration-300">
        <Header
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          isSidebarOpen={sidebarOpen}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
