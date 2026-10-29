'use client';

import React from 'react';
import PlanSummary from './PlanSummary';

/* The dashboard fills the content area at every screen height: the banner grows a little on tall screens
   (tall: / xtall: / xxtall:, globals.css) and the Planning Overview takes the rest. On a short screen both
   keep their own height and the page scrolls. */
export default function DashboardScreen() {
  return (
    <div className="flex min-h-full flex-col gap-6 xxtall:gap-8">
      {/* Welcome Banner matching exp index.html */}
      <div className="rounded-xl p-5 sm:p-6 md:p-8 xtall:p-10 xxtall:p-14 text-white shadow-lg relative overflow-hidden shrink-0 min-h-[180px] tall:min-h-[220px] xtall:min-h-[280px] xxtall:min-h-[380px] flex flex-col justify-center bg-[#1f232b]">
        <img
          src="/assets/dashboard-bg.jpg"
          alt="Background"
          className="absolute inset-0 w-full h-full object-cover object-[0%_60%] z-0 pointer-events-none dark:opacity-40 transition-opacity duration-300"
        />
        <div className="relative z-10">
          <h2 className="text-xl sm:text-2xl md:text-3xl xtall:text-4xl xxtall:text-5xl font-bold mb-2 xxtall:mb-4 tracking-wide drop-shadow-md">
            Welcome Back!
          </h2>
          <p className="text-gray-200 text-sm sm:text-base xtall:text-lg xxtall:text-xl drop-shadow">
            Select a Production Plan or Report from the sidebar to manage data.
          </p>
        </div>
      </div>

      {/* Planning overview (read only) */}
      <PlanSummary />
    </div>
  );
}
