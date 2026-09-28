import type { ICurrentSubscriptionData } from '@/types/subscription';
import type { ITrialData } from '@/types/trial';

/**
 * Billing — the pure part: what the plan row says under the plan's name, what
 * note (if any) sits under the block, and which cancellation the account can
 * make. No React, so it is tested with Node's runner.
 */

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function formatBillingDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : DATE.format(time);
}

/** "₦5,000 a month": the plan's `interval` as the unit a price is paid per. */
const PER_INTERVAL: Record<string, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
  yearly: 'year',
  annually: 'year',
};

export type CancelKind = 'subscription' | 'trial' | null;

export interface PlanSummary {
  /** The line under the plan's name. */
  detail: string;
  /** A sentence under the block, or null. `tone` picks its colour. */
  note: { text: string; tone: 'quiet' | 'alarm' } | null;
  /** Which cancellation the account can make now, if any. */
  cancel: CancelKind;
  isFree: boolean;
}

export function summarisePlan(
  data: ICurrentSubscriptionData,
  trial: ITrialData | null,
): PlanSummary {
  const { plan, subscription, is_free_tier } = data;
  if (is_free_tier || !subscription) {
    // The plan is usually named "Free", so its own description says more
    // than repeating "Free plan" under it.
    return { detail: plan.description?.trim() || 'Free plan', note: null, cancel: null, isFree: true };
  }

  const per = PER_INTERVAL[plan.interval] ?? plan.interval_label.toLowerCase();
  const price = plan.is_free ? plan.formatted_amount : `${plan.formatted_amount} a ${per}`;
  const nextPayment = formatBillingDate(subscription.next_payment_date);
  const endsAt = formatBillingDate(subscription.ends_at);

  switch (subscription.status) {
    case 'trialing': {
      const trialEnds = formatBillingDate(trial?.trial_ends_at);
      return {
        detail: nextPayment ? `Free trial · first payment ${nextPayment}` : 'Free trial',
        note: trialEnds
          ? { text: `Your free trial ends on ${trialEnds}. After that the plan costs ${price}.`, tone: 'quiet' }
          : null,
        cancel: 'trial',
        isFree: false,
      };
    }
    case 'cancelled':
      return {
        detail: endsAt ? `Cancelled · ends ${endsAt}` : 'Cancelled',
        note: endsAt
          ? { text: `Your plan is cancelled. It stays active until ${endsAt}, then the free plan's limits apply.`, tone: 'quiet' }
          : null,
        cancel: null,
        isFree: false,
      };
    case 'past_due':
      return {
        detail: `${price} · payment overdue`,
        // No route lets a user update a card (backend, 77e42c2e), so the note
        // points only at what they can do: choose a plan again, or ask support.
        note: {
          text: 'Your last payment did not go through. Choose a plan again, or contact support.',
          tone: 'alarm',
        },
        cancel: 'subscription',
        isFree: false,
      };
    case 'expired':
      return { detail: 'Expired', note: null, cancel: null, isFree: false };
    case 'active':
    default:
      return {
        detail: nextPayment ? `${price} · renews ${nextPayment}` : price,
        note: null,
        cancel: 'subscription',
        isFree: false,
      };
  }
}
