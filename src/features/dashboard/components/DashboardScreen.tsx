'use client';

import React from 'react';
import InteractivePlayground from './InteractivePlayground';
import PlanSummary from './PlanSummary';

export default function DashboardScreen() {
  return (
    <div className="flex flex-col gap-6 min-h-0 flex-1">
      {/* Welcome Banner matching exp index.html */}
      <div className="rounded-xl p-5 sm:p-6 md:p-8 text-white shadow-lg relative overflow-hidden shrink-0 min-h-[180px] flex flex-col justify-center bg-[#1f232b]">
        <img
          src="/assets/dashboard-bg.jpg"
          alt="Background"
          className="absolute inset-0 w-full h-full object-cover object-[0%_60%] z-0 pointer-events-none dark:opacity-40 transition-opacity duration-300"
        />
        <div className="relative z-10">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 tracking-wide drop-shadow-md">
            Welcome Back!
          </h2>
          <p className="text-gray-200 text-sm sm:text-base drop-shadow">
            Select a Production Plan or Report from the sidebar to manage data.
          </p>
        </div>
      </div>

      {/* Planning overview (read only) on the animated background of the old dashboard widget */}
      <InteractivePlayground>
        <PlanSummary />
      </InteractivePlayground>
    </div>
  );
}
