'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  UploadCloud,
  Sliders,
  CalendarDays,
  Activity,
  FileSpreadsheet,
  Gauge,
  Users,
  ChevronDown,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { IUser } from '@/types/user';

interface SidebarProps {
  isOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({ isOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<IUser | null>(null);

  // Accordion state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    management: true,
    planning: true,
    tracking: false,
    reports: false,
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) setCurrentUser(JSON.parse(stored));
    } catch {}
  }, []);

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const isActive = (path: string) => pathname === path;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-base-300 bg-base-100 transition-transform duration-300 lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand bar */}
        <div className="flex h-16 items-center gap-3 border-b border-base-300 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-content font-bold shadow-md">
            EP
          </div>
          <span className="font-extrabold text-sm tracking-wide">Epylion ERP</span>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar">
          <ul className="menu menu-sm w-full gap-1">
            {/* Dashboard */}
            <li>
              <Link
                href="/dashboard"
                onClick={onCloseMobile}
                className={isActive('/dashboard') ? 'active font-bold' : ''}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard Home
              </Link>
            </li>

            {/* Data Management Section */}
            <li className="menu-title mt-2 text-[10px] font-bold uppercase tracking-wider text-base-content/50">
              Data Management
            </li>
            <li>
              <Link
                href="/management/upload"
                onClick={onCloseMobile}
                className={isActive('/management/upload') ? 'active font-bold' : ''}
              >
                <UploadCloud className="h-4 w-4" />
                Source File Upload
              </Link>
            </li>
            <li>
              <Link
                href="/management/setup"
                onClick={onCloseMobile}
                className={isActive('/management/setup') ? 'active font-bold' : ''}
              >
                <Sliders className="h-4 w-4" />
                Dropdown Setup
              </Link>
            </li>

            {/* Department Planning */}
            <li className="menu-title mt-2 text-[10px] font-bold uppercase tracking-wider text-base-content/50">
              Order Planning
            </li>
            <li>
              <details open={openSections.planning}>
                <summary onClick={() => toggleSection('planning')}>
                  <CalendarDays className="h-4 w-4" />
                  Department Plans
                </summary>
                <ul>
                  <li>
                    <Link href="/planning/yd" onClick={onCloseMobile} className={isActive('/planning/yd') ? 'active' : ''}>
                      YD Plan
                    </Link>
                  </li>
                  <li>
                    <Link href="/planning/knitting" onClick={onCloseMobile} className={isActive('/planning/knitting') ? 'active' : ''}>
                      Knitting Plan
                    </Link>
                  </li>
                  <li>
                    <Link href="/planning/dyeing" onClick={onCloseMobile} className={isActive('/planning/dyeing') ? 'active' : ''}>
                      Dyeing Plan
                    </Link>
                  </li>
                  <li>
                    <Link href="/planning/finishing" onClick={onCloseMobile} className={isActive('/planning/finishing') ? 'active' : ''}>
                      Finishing Plan
                    </Link>
                  </li>
                  <li>
                    <Link href="/planning/delivery" onClick={onCloseMobile} className={isActive('/planning/delivery') ? 'active' : ''}>
                      Delivery Plan
                    </Link>
                  </li>
                </ul>
              </details>
            </li>

            {/* Plan vs Actual Tracking */}
            <li className="menu-title mt-2 text-[10px] font-bold uppercase tracking-wider text-base-content/50">
              Floor Execution
            </li>
            <li>
              <details open={openSections.tracking}>
                <summary onClick={() => toggleSection('tracking')}>
                  <Activity className="h-4 w-4" />
                  Plan vs Actual
                </summary>
                <ul>
                  <li>
                    <Link href="/tracking/yd" onClick={onCloseMobile} className={isActive('/tracking/yd') ? 'active' : ''}>
                      YD Tracking
                    </Link>
                  </li>
                  <li>
                    <Link href="/tracking/knitting" onClick={onCloseMobile} className={isActive('/tracking/knitting') ? 'active' : ''}>
                      Knitting Tracking
                    </Link>
                  </li>
                  <li>
                    <Link href="/tracking/dyeing" onClick={onCloseMobile} className={isActive('/tracking/dyeing') ? 'active' : ''}>
                      Dyeing Tracking
                    </Link>
                  </li>
                  <li>
                    <Link href="/tracking/finishing" onClick={onCloseMobile} className={isActive('/tracking/finishing') ? 'active' : ''}>
                      Finishing Tracking
                    </Link>
                  </li>
                  <li>
                    <Link href="/tracking/delivery" onClick={onCloseMobile} className={isActive('/tracking/delivery') ? 'active' : ''}>
                      Delivery Tracking
                    </Link>
                  </li>
                  <li>
                    <Link href="/tracking/deliveryfloor" onClick={onCloseMobile} className={isActive('/tracking/deliveryfloor') ? 'active' : ''}>
                      Delivery Floor
                    </Link>
                  </li>
                </ul>
              </details>
            </li>

            {/* Reports */}
            <li className="menu-title mt-2 text-[10px] font-bold uppercase tracking-wider text-base-content/50">
              Reports & Intelligence
            </li>
            <li>
              <details open={openSections.reports}>
                <summary onClick={() => toggleSection('reports')}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Operational Reports
                </summary>
                <ul>
                  <li>
                    <Link href="/reports/yd" onClick={onCloseMobile} className={isActive('/reports/yd') ? 'active' : ''}>
                      Updated YD Report
                    </Link>
                  </li>
                  <li>
                    <Link href="/reports/knitting" onClick={onCloseMobile} className={isActive('/reports/knitting') ? 'active' : ''}>
                      Updated Knitting Report
                    </Link>
                  </li>
                  <li>
                    <Link href="/reports/dyeing" onClick={onCloseMobile} className={isActive('/reports/dyeing') ? 'active' : ''}>
                      Updated Dyeing Report
                    </Link>
                  </li>
                  <li>
                    <Link href="/reports/finishing" onClick={onCloseMobile} className={isActive('/reports/finishing') ? 'active' : ''}>
                      Updated Finishing Report
                    </Link>
                  </li>
                  <li>
                    <Link href="/reports/delivery" onClick={onCloseMobile} className={isActive('/reports/delivery') ? 'active' : ''}>
                      Updated Delivery Report
                    </Link>
                  </li>
                  <li>
                    <Link href="/reports/order-status" onClick={onCloseMobile} className={isActive('/reports/order-status') ? 'active' : ''}>
                      Order Status Pipeline
                    </Link>
                  </li>
                  <li>
                    <Link href="/reports/planning-prod-info" onClick={onCloseMobile} className={isActive('/reports/planning-prod-info') ? 'active' : ''}>
                      Planning & Prod Info (PPI)
                    </Link>
                  </li>
                </ul>
              </details>
            </li>

            {/* Load Calculation */}
            <li className="menu-title mt-2 text-[10px] font-bold uppercase tracking-wider text-base-content/50">
              Capacity Planning
            </li>
            <li>
              <Link
                href="/load-calc"
                onClick={onCloseMobile}
                className={isActive('/load-calc') ? 'active font-bold' : ''}
              >
                <Gauge className="h-4 w-4" />
                5-Month Load Calculation
              </Link>
            </li>

            {/* Admin User Management */}
            {currentUser?.role === 'Admin' && (
              <>
                <li className="menu-title mt-2 text-[10px] font-bold uppercase tracking-wider text-base-content/50">
                  Administration
                </li>
                <li>
                  <Link
                    href="/management/users"
                    onClick={onCloseMobile}
                    className={isActive('/management/users') ? 'active font-bold' : ''}
                  >
                    <Users className="h-4 w-4" />
                    User & Buyer Access
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>

        {/* Footer info */}
        <div className="border-t border-base-300 p-3 text-center text-[10px] text-base-content/50">
          Next Planning V3 &copy; 2026 Epylion Group
        </div>
      </aside>
    </>
  );
}
