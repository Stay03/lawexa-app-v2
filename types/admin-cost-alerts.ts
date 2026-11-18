/**
 * Admin cost alerts (Arthur, 18 November 2026, thread dfa0d9b8; Backend's
 * contract the same day). A row exists once a paying user's AI cost in a
 * paid period passes the set share of their plan price; a daily run (06:00
 * UTC) keeps it current while the period lasts. Costs are estimates at admin
 * model prices; file reading (OCR) is not counted yet.
 */

export type CostAlertPeriod = 'current' | 'past' | 'all';
export type CostAlertSort = 'percent' | 'cost' | 'first_flagged_at';

export interface CostAlert {
  uuid: string;
  user: { uuid: string; name: string; email: string | null };
  plan: { id: number; name: string; currency: 'NGN' | 'USD'; amount: string; interval: string };
  period: { start: string; end: string | null; is_current: boolean };
  /** The plan price in USD for the window (annual plans: a twelfth). */
  price_usd: number;
  /** ai_cost_usd + web_cost_usd. */
  cost_usd: number;
  ai_cost_usd: number;
  web_cost_usd: number;
  /** cost_usd / price_usd * 100. */
  percent: number;
  turns: number;
  first_flagged_at: string;
  last_seen_at: string;
  notified_at: string | null;
}

export interface CostAlertsMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  threshold_percent: number;
  usd_to_ngn_rate: number;
  includes_web_search: boolean;
  /** Present when the list is filtered to one user (`user=<uuid>`). */
  user?: { uuid: string; name: string };
}

export interface CostAlertsResponse {
  success: boolean;
  message: string;
  data: CostAlert[];
  meta: CostAlertsMeta;
}

export interface CostAlertsParams {
  period?: CostAlertPeriod;
  plan_id?: number;
  sort?: CostAlertSort;
  user?: string;
  page?: number;
  per_page?: number;
}

/** On a user in the admin list and detail: their current period's alert, when at or over the threshold. */
export interface UserCostAlert {
  percent: number;
  cost_usd: number;
  price_usd: number;
  period_start: string;
  alert_uuid: string;
}
