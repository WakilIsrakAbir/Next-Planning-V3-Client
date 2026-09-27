'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, LogOut, Clock, ShieldCheck } from 'lucide-react';
import ThemeToggle from '../common/ThemeToggle';
import { getDhakaCountdown } from '@/lib/date-utils';
import { IUser } from '@/types/user';

interface HeaderProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export default function Header({ onToggleSidebar, isSidebarOpen }: HeaderProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<IUser | null>(null);
  const [countdown, setCountdown] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch {}

    // Countdown tick
    const updateTime = () => setCountdown(getDhakaCountdown());
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-base-300 bg-base-100/90 px-4 backdrop-blur transition-colors lg:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="btn btn-ghost btn-square btn-sm text-base-content hover:text-primary hover:bg-base-200 transition-transform active:scale-95"
          title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          aria-label="Toggle Sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-black text-primary-content shadow-md shadow-primary/20">
            EP
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight lg:text-base">Next Planning V3</h1>
            <p className="text-[10px] text-base-content/60">Epylion Manufacturing Operations</p>
          </div>
        </Link>
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

        {/* User Profile */}
        {currentUser && (
          <div className="flex items-center gap-2 pl-2 border-l border-base-300">
            <div className="avatar placeholder">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                {(currentUser.username || 'U').charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="hidden flex-col text-left leading-tight sm:flex">
              <span className="text-xs font-bold">{currentUser.username || 'User'}</span>
              <span className="text-[10px] text-base-content/60 flex items-center gap-0.5">
                <ShieldCheck className="h-2.5 w-2.5 text-success" />
                {currentUser.role || 'Planner'}
              </span>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="btn btn-ghost btn-circle btn-sm text-error hover:bg-error/10"
          title="Sign Out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
