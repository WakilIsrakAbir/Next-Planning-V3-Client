'use client';

import type { RefObject } from 'react';
import { Calendar } from 'lucide-react';
import type { PPIMilestones } from '@/features/reports/planning-prod-info/lib/ppi-utils';

const renderPlanTypeBadge = (type: string) => {
  if (!type || type === '—' || type === '-') return '—';
  const t = String(type).trim();
  let colorClass = 'bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200';
  if (t === 'Confirm')
    colorClass =
      'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800';
  else if (t === 'Tentative')
    colorClass =
      'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800';
  else if (t === 'Pending')
    colorClass =
      'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-bold';
  else if (t === 'T&A') colorClass = 'bg-slate-200/90 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold';
  return <span className={`inline-block px-3 py-0.5 rounded ${colorClass} font-bold text-[11px] shadow-xs`}>{t}</span>;
};

interface PPIPlanningSectionProps {
  milestoneData: PPIMilestones;
  planSectionRef: RefObject<HTMLElement | null>;
}

/** 2. Booking Planning: milestones, plan types and plan vs actual per department. */
export default function PPIPlanningSection({ milestoneData, planSectionRef }: PPIPlanningSectionProps) {
  return (
    <section ref={planSectionRef} className="w-full">
      <div className="bg-[#0e7490] text-white px-4 py-2.5 rounded-t-lg font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-between shadow-xs">
        <span className="flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Booking Planning (Milestones & Plan vs Actual)
        </span>
        <span className="text-[11px] font-semibold bg-white/20 px-2.5 py-0.5 rounded">
          Timeline Review
        </span>
      </div>
      <div className="overflow-x-auto border border-t-0 border-base-300 rounded-b-lg">
        <table className="w-full text-xs min-w-[760px] border-collapse text-center">
          <thead className="bg-cyan-100/80 dark:bg-cyan-950/60 text-cyan-950 dark:text-cyan-200 font-extrabold border-b border-base-300">
            <tr>
              <th className="p-2.5 border-r border-base-300 text-left w-36 bg-cyan-200/80 dark:bg-cyan-900/80 font-black">
                Timeline Phase
              </th>
              <th className="p-2.5 border-r border-base-300">Yarn Date</th>
              <th className="p-2.5 border-r border-base-300">Knit Start</th>
              <th className="p-2.5 border-r border-base-300">Knit End</th>
              <th className="p-2.5 border-r border-base-300">Dye Start</th>
              <th className="p-2.5 border-r border-base-300">Dye End</th>
              <th className="p-2.5 border-r border-base-300">Deli Start (Floor)</th>
              <th className="p-2.5">Deli End (Floor)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-200 font-medium">
            {/* Planned */}
            <tr className="bg-base-100 hover:bg-cyan-50/30">
              <td className="p-2 font-bold text-left bg-base-200/60 text-blue-700 dark:text-blue-400 border-r border-base-300">
                Planned
              </td>
              <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.planned.yarn}</td>
              <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.planned.knitStart}</td>
              <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.planned.knitEnd}</td>
              <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.planned.dyeStart}</td>
              <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.planned.dyeEnd}</td>
              <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.planned.deliStart}</td>
              <td className="p-2 font-medium font-mono">{milestoneData.planned.deliEnd}</td>
            </tr>

            {/* Plan Type */}
            <tr className="bg-base-200/30 hover:bg-cyan-50/30">
              <td className="p-2 font-bold text-left bg-base-200/60 text-indigo-700 dark:text-indigo-400 border-r border-base-300">
                Plan Type
              </td>
              <td className="p-2 border-r border-base-300">
                {renderPlanTypeBadge(milestoneData.planTypes.yarn)}
              </td>
              <td className="p-2 border-r border-base-300 text-center" colSpan={2}>
                {renderPlanTypeBadge(milestoneData.planTypes.knit)}
              </td>
              <td className="p-2 border-r border-base-300 text-center" colSpan={2}>
                {renderPlanTypeBadge(milestoneData.planTypes.dye)}
              </td>
              <td className="p-2 text-center" colSpan={2}>
                {renderPlanTypeBadge(milestoneData.planTypes.deli)}
              </td>
            </tr>

            {/* Actual */}
            <tr className="bg-base-100 hover:bg-cyan-50/40">
              <td className="p-2 font-bold text-left bg-base-200/60 text-emerald-700 dark:text-emerald-400 border-r border-base-300">
                Actual
              </td>
              <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.actual.yarn}</td>
              <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.actual.knitStart}</td>
              <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.actual.knitEnd}</td>
              <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.actual.dyeStart}</td>
              <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.actual.dyeEnd}</td>
              <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.actual.deliStart}</td>
              <td className="p-2 font-medium font-mono">{milestoneData.actual.deliEnd}</td>
            </tr>

            {/* Lead Day */}
            <tr className="bg-base-200/30 hover:bg-cyan-50/30">
              <td className="p-2 font-black text-left bg-base-200/60 text-teal-800 dark:text-teal-300 border-r border-base-300">
                Lead Day
              </td>
              <td className="p-2 border-r border-base-300 font-bold font-mono">{milestoneData.leadDays.yarn}</td>
              <td className="p-2 border-r border-base-300 font-bold font-mono">{milestoneData.leadDays.knitStart}</td>
              <td className="p-2 border-r border-base-300 font-bold font-mono">{milestoneData.leadDays.knitEnd}</td>
              <td className="p-2 border-r border-base-300 font-bold font-mono">{milestoneData.leadDays.dyeStart}</td>
              <td className="p-2 border-r border-base-300 font-bold font-mono">{milestoneData.leadDays.dyeEnd}</td>
              <td className="p-2 border-r border-base-300 font-bold font-mono">{milestoneData.leadDays.deliStart}</td>
              <td className="p-2 font-bold font-mono">{milestoneData.leadDays.deliEnd}</td>
            </tr>

            {/* OTT Result */}
            <tr className="bg-base-100 hover:bg-cyan-50/40">
              <td className="p-2 font-bold text-left bg-base-200/60 border-r border-base-300">
                OTT Result
              </td>
              {[
                milestoneData.ott.yarn,
                milestoneData.ott.knitStart,
                milestoneData.ott.knitEnd,
                milestoneData.ott.dyeStart,
                milestoneData.ott.dyeEnd,
                milestoneData.ott.deliStart,
                milestoneData.ott.deliEnd,
              ].map((ott, i) => (
                <td key={i} className={`p-2 border-r border-base-300 font-black ${i === 6 ? 'border-r-0' : ''}`}>
                  {ott.isPass ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-black">Pass</span>
                  ) : ott.isFail ? (
                    <span className="text-rose-600 dark:text-rose-400 font-black">Fail</span>
                  ) : (
                    '—'
                  )}
                </td>
              ))}
            </tr>

            {/* Reason & Dept */}
            <tr className="bg-base-200/30 hover:bg-cyan-50/30">
              <td className="p-2 font-bold text-left bg-base-200/60 border-r border-base-300">
                Reason & Dept
              </td>
              <td className="p-2 border-r border-base-300 text-[11px] text-base-content/60">{milestoneData.reasons.yarn}</td>
              <td className="p-2 border-r border-base-300 text-[11px] font-medium" colSpan={2}>
                {milestoneData.reasons.knit}
              </td>
              <td className="p-2 border-r border-base-300 text-[11px] font-medium" colSpan={2}>
                {milestoneData.reasons.dye}
              </td>
              <td className="p-2 text-[11px] font-medium" colSpan={2}>
                {milestoneData.reasons.deli}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
