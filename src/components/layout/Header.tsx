'use client';

import React, { useEffect, useState } from 'react';
import { Menu, Clock } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { getDhakaCountdown } from '@/lib/date-utils';

interface HeaderProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export default function Header({ onToggleSidebar, isSidebarOpen }: HeaderProps) {
  const [countdown, setCountdown] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // Countdown tick (the signed-in user and Sign Out are in the sidebar)
  useEffect(() => {
    const updateTime = () => setCountdown(getDhakaCountdown());
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-base-300 bg-base-100/90 px-4 backdrop-blur transition-colors lg:px-8">
      <div className="flex items-center gap-3">
        {/* Hamburger Toggle button - Always visible on the left of Header */}
        <button
          onClick={onToggleSidebar}
          className="btn btn-ghost btn-square btn-sm text-base-content hover:text-primary hover:bg-base-200 transition-transform active:scale-95 shrink-0"
          title={isSidebarOpen ? "Collapse Sidebar (Ctrl+B)" : "Expand Sidebar (Ctrl+B)"}
          aria-label="Toggle Sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Planning & Operations Control Suite indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold text-base-content/60">
          <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse shrink-0" />
          <span className="font-bold text-base-content/80 truncate">Planning & Operations Control Suite</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Dhaka Midnight Countdown Clock */}
        <div className="hidden items-center gap-1.5 rounded-full border border-base-300 bg-base-200 px-3 py-1 text-xs font-mono font-medium md:flex" title="Session automatically terminates at 12:00 AM Dhaka Midnight">
          <Clock className="h-3.5 w-3.5 text-primary animate-pulse" />
          <span className="text-base-content/70">Shift Reset:</span>
          <span className="font-bold text-primary">
            {pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}
          </span>
        </div>

        {/* Theme Switcher */}
        <ThemeToggle />
      </div>
    </header>
  );
}
