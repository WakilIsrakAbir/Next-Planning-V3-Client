'use client';

import React from 'react';
import { Layers, Sparkles } from 'lucide-react';
import InteractivePlayground from '@/components/dashboard/InteractivePlayground';

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 p-5 text-white shadow-xl lg:p-7 border border-emerald-500/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-spin-reverse" />
              <span>Interactive Operations Suite V3</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight lg:text-3xl text-white">
              Epylion Production Planning Dashboard
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              Real-time synchronization across YD, Knitting, Dyeing, Finishing, and Dispatch floor operations. Move your mouse or click below to play with the interactive dynamic canvas.
            </p>
          </div>
        </div>
        <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
          <Layers className="w-80 h-80 text-white" />
        </div>
      </div>

      {/* Main Interactive Animation Playground (Mouse-controlled dynamic timepass engine) */}
      <InteractivePlayground />
    </div>
  );
}
