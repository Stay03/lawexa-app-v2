// ============================================
// Admin User Plan Periods Types
// Based on API documentation: Admin User Plan Periods API
// GET /api/admin/users/{uuid}/plan-periods
// GET /api/admin/users/{uuid}/plan-periods/{key}/conversations
// ============================================

import type { AdminConversationsPagination, AdminConversationsLinks } from './admin';
import type { TCurrency } from './payment';

// The provider behind a period's subscription.
export type PlanPeriodProvider = 'paystack' | 'flutterwave' | 'granted';

// How a period was produced: from an invoice, an admin grant, or synthesized.
export type PlanPeriodSource = 'invoice' | 'granted' | 'synthesized';

// The six side-buckets for usage not tied to a paid period.
export type PlanPeriodBucketName =
  | 'free'
  | 'pack'
  | 'staff'
  | 'system'
  | 'legacy'
  | 'unattributed';

// Minimal plan descriptor carried on each period.
export interface PlanPeriodPlanRef {
  name: string;
  slug: string;
  interval: string;
}

// Per-slot usage. `funding_breakdown` maps a `sent_via` tag to a message count
// (e.g. { plan_trial: 3, plan_paid: 27 }); it is `{}` for a period with no messages.
export interface PlanPeriodUsage {
  messages: number;
  conversations: number;
  tokens: number;
  cost: number;
  funding_breakdown: Record<string, number>;
}

// A single billing period — one per invoice, or one synthesized per granted sub.
export interface PlanPeriod {
  key: string; // "inv-{invoiceId}" | "sub-{subscriptionId}"
  subscription_id: number;
  invoice_id: number | null;
  plan: PlanPeriodPlanRef;
  provider: PlanPeriodProvider;
  source: PlanPeriodSource;
  period_start: string | null; // YYYY-MM-DD
  period_end: string | null; // null for an open grant period
  amount: string; // major units, e.g. "15000.00"
  currency: TCurrency;
  status: string; // invoice status, or subscription status for grants
  paid: boolean;
  paid_at: string | null; // ISO-8601
  is_current: boolean;
  derived_dates: boolean;
  usage: PlanPeriodUsage;
}

// One side-bucket of usage grouped by funding source.
export interface PlanPeriodBucket {
  key: string; // "bucket-{name}"
  messages: number;
  conversations: number;
  tokens: number;
  cost: number;
}

// Grand totals across the user's entire history.
export interface PlanPeriodTotals {
  messages: number;
  conversations: number;
  tokens: number;
  cost: number;
}

// The reconciled measures (conversation counts are intentionally not reconciled).
export interface PlanPeriodReconciledMeasures {
  messages: number;
  tokens: number;
  cost: number;
}

// Self-check proving sum(periods) + sum(buckets) == user total.
export interface PlanPeriodReconciliation {
  sum_of_slots: PlanPeriodReconciledMeasures;
  user_total: PlanPeriodReconciledMeasures;
  balanced: boolean;
}

export interface AdminUserPlanPeriodsData {
  user: {
    uuid: string;
    name: string;
    email: string;
  };
  totals: PlanPeriodTotals;
  plan_periods: PlanPeriod[];
  buckets: Record<PlanPeriodBucketName, PlanPeriodBucket>;
  reconciliation: PlanPeriodReconciliation;
}

// GET /api/admin/users/{uuid}/plan-periods (not paginated)
export interface AdminUserPlanPeriodsResponse {
  success: boolean;
  message: string;
  data: AdminUserPlanPeriodsData;
}

// ============================================
// Drill-down: conversations within a single slot
// ============================================

export interface PlanPeriodConversationAgent {
  name: string;
  slug: string;
}

// A conversation whose usage falls in one slot, with slot-scoped counts.
export interface PlanPeriodConversation {
  id: string; // uuid
  title: string | null; // null when confidential
  status: string;
  is_confidential: boolean;
  agent: PlanPeriodConversationAgent | null;
  messages_in_period: number;
  usage_in_period: {
    tokens: number;
    cost: number;
  };
  created_at: string;
  updated_at: string;
}

// Query params for GET /api/admin/users/{uuid}/plan-periods/{key}/conversations
export interface AdminPlanPeriodConversationsParams {
  per_page?: number; // clamped to 1–100 by the API
  page?: number;
}

export interface AdminPlanPeriodConversationsResponse {
  success: boolean;
  message: string;
  data: PlanPeriodConversation[];
  pagination: AdminConversationsPagination;
  links: AdminConversationsLinks;
}
