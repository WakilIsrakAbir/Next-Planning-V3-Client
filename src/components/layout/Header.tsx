'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Clock, X, Maximize2, Minimize2 } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { getDhakaCountdown } from '@/lib/date-utils';
import { deptPlanName } from '@/lib/page-title';
import { guardLinkNavigate } from '@/lib/unsaved-changes';

interface HeaderProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

/**
 * US-12: the Order Management pages (`/planning/<dept>` lists and `/planning/<dept>/<orderNo>` order pages) get a
 * compact bar instead: the menu button, a "menu name" tab ("Knitting Plan ×", × goes to the dashboard), the Full
 * (full-screen) button and the theme toggle. Returns the tab's name, or null for every other page.
 */
export function compactMenuName(pathname: string | null | undefined): string | null {
  const m = /^\/planning\/([^/]+)(\/|$)/.exec(pathname || '');
  return m ? deptPlanName(decodeURIComponent(m[1]).toLowerCase()) : null;
}

/** Browser full-screen mode: whether it is on, and a toggle (requestFullscreen / exitFullscreen). */
export function useFullscreen(): { isFull: boolean; toggle: () => void } {
  const [isFull, setIsFull] = useState(false);
  useEffect(() => {
    const sync = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const toggle = () => {
    // A refused request (no user gesture, an iframe without allowfullscreen) just leaves the page as it is.
    const done = document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.();
    Promise.resolve(done).catch(() => {});
  };
  return { isFull, toggle };
}

export default function Header({ onToggleSidebar, isSidebarOpen }: HeaderProps) {
  const pathname = usePathname();
  const menuName = compactMenuName(pathname);
  const { isFull, toggle: toggleFull } = useFullscreen();
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

  const menuButton = (
    <button
      onClick={onToggleSidebar}
      className="btn btn-ghost btn-square btn-sm text-base-content hover:text-primary hover:bg-base-200 transition-transform active:scale-95 shrink-0"
      title={isSidebarOpen ? "Collapse Sidebar (Ctrl+B)" : "Expand Sidebar (Ctrl+B)"}
      aria-label="Toggle Sidebar"
    >
      <Menu className="h-5 w-5" />
    </button>
  );

  if (menuName) {
    return (
      <header
        data-compact-header
        className="sticky top-0 z-30 flex h-10 w-full items-end justify-between gap-2 border-b border-base-300 bg-base-100/90 px-2 backdrop-blur transition-colors lg:px-4"
      >
        <div className="flex min-w-0 items-end gap-2 h-full">
          <div className="flex h-full items-center">{menuButton}</div>
          {/* The menu name, like a browser tab */}
          <div
            data-menu-tab
            className="-mb-px flex min-w-0 items-center gap-1.5 rounded-t-md border border-b-0 border-base-300 bg-base-200 py-1 pl-3 pr-1 text-xs font-bold text-base-content/80"
          >
            <span className="truncate">{menuName}</span>
            <Link
              href="/dashboard"
              onNavigate={guardLinkNavigate}
              aria-label={`Close ${menuName}`}
              title="Close (go to the Dashboard)"
              className="btn btn-ghost btn-xs btn-square h-5 min-h-5 w-5 text-base-content/60 hover:text-error"
            >
              <X className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="flex h-full items-center gap-1">
          <button
            type="button"
            data-action="fullscreen"
            onClick={toggleFull}
            aria-pressed={isFull}
            title={isFull ? 'Exit full screen' : 'Full screen'}
            className="btn btn-ghost btn-sm gap-1 px-2 text-xs font-bold"
          >
            {isFull ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {isFull ? 'Exit Full' : 'Full'}
          </button>
          <ThemeToggle />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-base-300 bg-base-100/90 px-4 backdrop-blur transition-colors lg:px-8">
      <div className="flex items-center gap-3">
        {/* Hamburger Toggle button - Always visible on the left of Header */}
        {menuButton}

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
