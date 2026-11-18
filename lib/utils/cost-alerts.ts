import type { CostAlertPeriod, CostAlertSort, CostAlertsParams } from '@/types/admin-cost-alerts';

/**
 * Cost alerts, the pure part (Arthur, 18 November 2026; Backend's contract).
 * What the list's filters read from and write to the address, and how a
 * cost, a share and a period are said. No React, so the suite tests it.
 */

/** Said on the screen, as Backend asked, wherever a cost shows. */
export const COST_ALERT_NOTE = 'Costs are estimates at admin model prices; file reading (OCR) is not counted yet.';

export const COST_ALERT_PERIODS: readonly { value: CostAlertPeriod; label: string }[] = [
  { value: 'current', label: 'Current period' },
  { value: 'past', label: 'Past periods' },
  { value: 'all', label: 'All periods' },
];

export const COST_ALERT_SORTS: readonly { value: CostAlertSort; label: string }[] = [
  { value: 'percent', label: 'Highest share first' },
  { value: 'cost', label: 'Highest cost first' },
  { value: 'first_flagged_at', label: 'Newest first' },
];

export interface CostAlertFilters {
  period: CostAlertPeriod;
  sort: CostAlertSort;
  user: string | null;
  page: number;
}

const PERIODS = new Set<string>(COST_ALERT_PERIODS.map((option) => option.value));
const SORTS = new Set<string>(COST_ALERT_SORTS.map((option) => option.value));

/** The filters from the address; anything unknown falls back to the default. */
export function costAlertFiltersFrom(search: URLSearchParams): CostAlertFilters {
  const period = search.get('period') ?? '';
  const sort = search.get('sort') ?? '';
  const page = Number(search.get('page'));
  return {
    period: PERIODS.has(period) ? (period as CostAlertPeriod) : 'current',
    sort: SORTS.has(sort) ? (sort as CostAlertSort) : 'percent',
    user: search.get('user') || null,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** The address for the filters: defaults are left out, so the plain list has a plain address. */
export function costAlertSearch(filters: CostAlertFilters): string {
  const params = new URLSearchParams();
  if (filters.period !== 'current') params.set('period', filters.period);
  if (filters.sort !== 'percent') params.set('sort', filters.sort);
  if (filters.user) params.set('user', filters.user);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params.toString();
}

/** What the request sends. */
export function costAlertParams(filters: CostAlertFilters): CostAlertsParams {
  return {
    period: filters.period,
    sort: filters.sort,
    page: filters.page,
    per_page: 25,
    ...(filters.user ? { user: filters.user } : {}),
  };
}

/** "$31.20", "$0.40": the server rounds every cost to cents (PlanCostAlertResource), so two places always. */
export function formatUsd(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "105%", one decimal under ten ("8.5%"). */
export function formatShare(percent: number): string {
  return percent < 10 ? `${percent.toFixed(1)}%` : `${Math.round(percent)}%`;
}

/** How loud a share is: at or over twice the threshold is severe. */
export function shareTone(percent: number, threshold: number): 'severe' | 'over' {
  return percent >= threshold * 2 ? 'severe' : 'over';
}

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const DAY_YEAR = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "2 Nov – 2 Dec 2026", "2 Nov 2026 onwards" while it has no end. */
export function periodLabel(start: string, end: string | null): string {
  const from = Date.parse(start);
  if (Number.isNaN(from)) return '';
  const to = end ? Date.parse(end) : Number.NaN;
  if (Number.isNaN(to)) return `${DAY_YEAR.format(from)} onwards`;
  return `${DAY.format(from)} – ${DAY_YEAR.format(to)}`;
}

/** The rule as the screen states it, from the list's own meta. */
export function costAlertRule(meta: { threshold_percent: number; usd_to_ngn_rate: number; includes_web_search: boolean }): string {
  const what = meta.includes_web_search ? 'AI and web search cost' : 'AI cost';
  return `Flags a paying user whose ${what} in a paid period reaches ${meta.threshold_percent}% of their plan price. Naira prices at ₦${meta.usd_to_ngn_rate.toLocaleString('en-US')} to the dollar. Checked daily at 06:00 UTC.`;
}

/** The user page's line: "AI cost 105% of plan price this period ($31.20 of $29.63)". */
export function userCostAlertLine(alert: { percent: number; cost_usd: number; price_usd: number }): string {
  return `AI cost ${formatShare(alert.percent)} of plan price this period (${formatUsd(alert.cost_usd)} of ${formatUsd(alert.price_usd)})`;
}
