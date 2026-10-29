'use client';

/* Dashboard overview: the number of buyers and the Pending / Tentative / Confirm orders of every plan the user
   may open, as GET /api/orders/dashboard-summary counts them (the same filters as the plan list tabs).
   Read only: nothing here is clickable and nothing navigates. */
import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { API_BASE, DEPARTMENTS } from '@/lib/constants';
import { sharedGetJson } from '@/lib/shared-request';

interface PlanStatusCounts {
  dept: string;
  pending: number;
  tentative: number;
  confirm: number;
}

interface DashboardSummary {
  buyers: number;
  plans: PlanStatusCounts[];
}

type StatusKey = 'pending' | 'tentative' | 'confirm';

/* Categorical slots 1-3 of the chart palette (validated for colour-vision deficiency in light and dark).
   The light Confirm green is below 3:1 on white, so every bar also shows its numbers. */
const STATUSES: { key: StatusKey; label: string; swatch: string }[] = [
  { key: 'pending', label: 'Pending', swatch: 'bg-[#2a78d6] dark:bg-[#3987e5]' },
  { key: 'tentative', label: 'Tentative', swatch: 'bg-[#eb6834] dark:bg-[#d95926]' },
  { key: 'confirm', label: 'Confirm', swatch: 'bg-[#1baf7a] dark:bg-[#199e70]' },
];

/** Plans the signed-in user may open (the sidebar's Order Management rule: Admin, or menus.orderManagement.<dept>). */
function allowedPlans(plans: PlanStatusCounts[]): PlanStatusCounts[] {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user || user.role === 'Admin') return plans;
    const menu = user.permissions?.menus?.orderManagement || {};
    return plans.filter((plan) => menu[plan.dept] === true);
  } catch {
    return plans;
  }
}

const total = (plan: PlanStatusCounts) => plan.pending + plan.tentative + plan.confirm;
const formatNumber = (value: number) => value.toLocaleString('en-US');

export default function PlanSummary() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    sharedGetJson<DashboardSummary>(`${API_BASE}/api/orders/dashboard-summary`)
      .then((data) => {
        if (!active) return;
        if (data) setSummary({ buyers: data.buyers, plans: allowedPlans(data.plans || []) });
        else setFailed(true);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  const scale = Math.max(1, ...(summary?.plans || []).map(total));

  return (
    <section
      aria-label="Planning overview"
      className="w-full max-w-3xl rounded-xl border border-gray-200 bg-white/95 p-5 shadow-sm backdrop-blur-sm sm:p-6 dark:border-gray-700 dark:bg-[#1a1d24]/95"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Planning Overview</h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Orders in the latest uploaded plan files</p>
        </div>
        {/* Buyers: a single headline number */}
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-2.5 dark:border-gray-700">
          <Users className="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
          <div>
            <div className="text-2xl font-bold leading-none tabular-nums text-gray-800 dark:text-gray-100">
              {summary ? formatNumber(summary.buyers) : '–'}
            </div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Buyers</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-600 dark:text-gray-300">
        {STATUSES.map((status) => (
          <span key={status.key} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${status.swatch}`} aria-hidden="true" />
            {status.label}
          </span>
        ))}
      </div>

      {/* One stacked bar per plan, all on the same scale */}
      <div className="mt-4 space-y-3.5">
        {failed ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">The overview could not be loaded.</p>
        ) : !summary ? (
          Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="grid grid-cols-[110px_1fr] items-center gap-3 sm:grid-cols-[120px_1fr_200px]">
              <div className="h-3 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3.5 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))
        ) : summary.plans.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No plans are available for your account.</p>
        ) : (
          summary.plans.map((plan) => {
            const name = DEPARTMENTS[plan.dept]?.name || plan.dept;
            const planTotal = total(plan);
            return (
              <div key={plan.dept} className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-1 sm:grid-cols-[120px_1fr_200px]">
                <div className="truncate text-xs font-semibold text-gray-800 dark:text-gray-100">{name}</div>
                <div className="h-3.5" role="img" aria-label={`${name}: ${plan.pending} pending, ${plan.tentative} tentative, ${plan.confirm} confirm`}>
                  {planTotal > 0 ? (
                    <div className="flex h-full gap-[2px]" style={{ width: `${(planTotal / scale) * 100}%` }}>
                      {STATUSES.filter((status) => plan[status.key] > 0).map((status) => (
                        <div
                          key={status.key}
                          className={`h-full min-w-[3px] first:rounded-l last:rounded-r ${status.swatch}`}
                          style={{ flexGrow: plan[status.key] }}
                          title={`${name} · ${status.label}: ${formatNumber(plan[status.key])}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">No orders</span>
                  )}
                </div>
                {/* The numbers of the bar (also the readable values for the light Confirm colour) */}
                <div className="col-start-2 flex gap-3 text-[11px] tabular-nums text-gray-600 dark:text-gray-300 sm:col-start-3 sm:justify-end">
                  {STATUSES.map((status) => (
                    <span key={status.key} className="inline-flex items-center gap-1">
                      <span className={`h-2 w-2 rounded-sm ${status.swatch}`} aria-hidden="true" />
                      {formatNumber(plan[status.key])}
                    </span>
                  ))}
                  <span className="font-semibold text-gray-800 dark:text-gray-100">= {formatNumber(planTotal)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
