'use client';

/* Dashboard overview: the number of buyers and the Pending / Tentative / Confirm orders of every plan the user
   may open, as GET /api/orders/dashboard-summary counts them (the same filters as the plan list tabs).
   Read only: nothing here is clickable and nothing navigates.
   The card takes the height the dashboard leaves free and spreads the plan rows over it; on tall screens
   (tall: / xtall: / xxtall:, globals.css) the bars and text are larger, so a big monitor is filled, not left
   empty. */
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

/* One plan row: name, bar, numbers (the numbers go under the bar on a phone). */
const ROW_GRID =
  'grid grid-cols-[110px_1fr] content-center items-center gap-x-3 gap-y-1 sm:grid-cols-[150px_1fr_240px] sm:gap-x-5 xtall:grid-cols-[190px_1fr_290px] xtall:gap-x-6 xxtall:grid-cols-[240px_1fr_360px] xxtall:gap-x-8';
const BAR_HEIGHT = 'h-3.5 tall:h-5 xtall:h-8 xxtall:h-12';

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
        // An unexpected answer shows the error line instead of breaking the dashboard.
        if (data && typeof data.buyers === 'number' && Array.isArray(data.plans)) {
          const plans = data.plans.map((plan) => ({
            dept: String(plan.dept),
            pending: Number(plan.pending) || 0,
            tentative: Number(plan.tentative) || 0,
            confirm: Number(plan.confirm) || 0,
          }));
          setSummary({ buyers: data.buyers, plans: allowedPlans(plans) });
        } else {
          setFailed(true);
        }
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
      className="flex w-full flex-1 flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 lg:p-8 xtall:p-10 xxtall:p-12 dark:border-gray-700/60 dark:bg-[#1a202c]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-gray-800 tall:text-lg xtall:text-xl xxtall:text-2xl dark:text-gray-100">Planning Overview</h3>
          <p className="mt-0.5 text-xs text-gray-500 tall:text-sm xxtall:mt-1 xxtall:text-base dark:text-gray-400">Orders in the latest uploaded plan files</p>
        </div>
        {/* Buyers: a single headline number */}
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-2.5 xtall:px-5 xtall:py-3 xxtall:gap-4 xxtall:px-6 xxtall:py-4 dark:border-gray-700">
          <Users className="h-5 w-5 text-gray-400 xtall:h-6 xtall:w-6 xxtall:h-8 xxtall:w-8 dark:text-gray-500" aria-hidden="true" />
          <div>
            <div className="text-2xl font-bold leading-none tabular-nums text-gray-800 xtall:text-3xl xxtall:text-4xl dark:text-gray-100">
              {summary ? formatNumber(summary.buyers) : '–'}
            </div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 tall:text-xs xxtall:text-sm dark:text-gray-400">Buyers</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-600 tall:mt-6 tall:text-sm xxtall:mt-8 xxtall:gap-x-7 xxtall:text-base dark:text-gray-300">
        {STATUSES.map((status) => (
          <span key={status.key} className="inline-flex items-center gap-1.5 xxtall:gap-2">
            <span className={`h-2.5 w-2.5 rounded-sm xtall:h-3 xtall:w-3 xxtall:h-3.5 xxtall:w-3.5 ${status.swatch}`} aria-hidden="true" />
            {status.label}
          </span>
        ))}
      </div>

      {/* One stacked bar per plan, all on the same scale; the rows share the card's free height evenly */}
      <div className="mt-4 flex flex-1 flex-col justify-evenly gap-3.5 tall:mt-6 xtall:gap-5 xxtall:mt-8 xxtall:gap-6">
        {failed ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">The overview could not be loaded.</p>
        ) : !summary ? (
          Array.from({ length: 5 }, (_, index) => (
            <div key={index} className={ROW_GRID}>
              <div className="h-3 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className={`${BAR_HEIGHT} animate-pulse rounded bg-gray-200 dark:bg-gray-700`} />
            </div>
          ))
        ) : summary.plans.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No plans are available for your account.</p>
        ) : (
          summary.plans.map((plan) => {
            const name = DEPARTMENTS[plan.dept]?.name || plan.dept;
            const planTotal = total(plan);
            return (
              <div key={plan.dept} className={ROW_GRID}>
                <div className="truncate text-xs font-semibold text-gray-800 tall:text-sm xtall:text-base xxtall:text-lg dark:text-gray-100">{name}</div>
                <div className={BAR_HEIGHT} role="img" aria-label={`${name}: ${plan.pending} pending, ${plan.tentative} tentative, ${plan.confirm} confirm`}>
                  {planTotal > 0 ? (
                    <div className="flex h-full gap-[2px]" style={{ width: `${(planTotal / scale) * 100}%` }}>
                      {STATUSES.filter((status) => plan[status.key] > 0).map((status) => (
                        <div
                          key={status.key}
                          className={`h-full min-w-[3px] first:rounded-l last:rounded-r xtall:first:rounded-l-md xtall:last:rounded-r-md xxtall:first:rounded-l-lg xxtall:last:rounded-r-lg ${status.swatch}`}
                          style={{ flexGrow: plan[status.key] }}
                          title={`${name} · ${status.label}: ${formatNumber(plan[status.key])}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="flex h-full items-center text-[11px] text-gray-400 tall:text-xs xtall:text-sm xxtall:text-base dark:text-gray-500">No orders</span>
                  )}
                </div>
                {/* The numbers of the bar (also the readable values for the light Confirm colour) */}
                <div className="col-start-2 flex gap-3 text-[11px] tabular-nums text-gray-600 tall:text-xs xtall:gap-4 xtall:text-sm xxtall:gap-5 xxtall:text-base dark:text-gray-300 sm:col-start-3 sm:justify-end">
                  {STATUSES.map((status) => (
                    <span key={status.key} className="inline-flex items-center gap-1 xxtall:gap-1.5">
                      <span className={`h-2 w-2 rounded-sm xtall:h-2.5 xtall:w-2.5 xxtall:h-3 xxtall:w-3 ${status.swatch}`} aria-hidden="true" />
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
