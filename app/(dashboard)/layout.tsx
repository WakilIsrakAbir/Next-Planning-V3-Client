'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import { API_BASE } from '@/lib/constants';
import ExpLoadingSpinner from '@/components/common/ExpLoadingSpinner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Default to open on desktop unless explicitly closed by the user
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    } else {
      const saved = localStorage.getItem('sidebar_expanded_v2');
      if (saved !== null) {
        setSidebarOpen(saved === 'true');
      } else {
        setSidebarOpen(true);
      }
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
        const res = await fetch(`${API_BASE}/api/auth/heartbeat`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('username');
          localStorage.removeItem('role');
          localStorage.removeItem('permissions');
          localStorage.removeItem('status');
          localStorage.removeItem('sessionExpiresAt');
          setAuthorized(false);
          router.replace('/login');
        }
      } catch {}
    };

    pingHeartbeat();
    const interval = setInterval(pingHeartbeat, 60000); // Every 60 seconds
    return () => clearInterval(interval);
  }, [router]);

  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_expanded_v2', String(next));
      return next;
    });
  };

  const handleCloseMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  // Keyboard shortcut: Ctrl + B or Cmd + B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-100">
        <ExpLoadingSpinner message="Verifying Session..." subMessage="Epylion PPC Suite V3" overlay={false} />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-base-200 text-base-content antialiased">
      {/* Sidebar Navigation with smooth desktop collapse */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={handleToggleSidebar}
        onCloseMobile={handleCloseMobile}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0 transition-all duration-300">
        <Header
          onToggleSidebar={handleToggleSidebar}
          isSidebarOpen={sidebarOpen}
        />
        <main id="mainContent" className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
