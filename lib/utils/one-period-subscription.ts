/**
 * A subscription paid by a method Paystack cannot charge again (a one-off bank
 * transfer) buys exactly one plan period and then ends by itself. The server
 * says so with `renews: false` and keeps `ends_at` set (backend 08eb8edb,
 * 3 October 2026). Every plan screen that would say "renews {date}" says this
 * instead, in v1 and v2 alike, so the wording lives here once.
 */

/** The plan interval as the period one payment covers. */
const PERIOD: Record<string, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
  yearly: 'year',
  annually: 'year',
};

export function oneOffPeriodNoun(interval: string | null | undefined): string {
  return (interval && PERIOD[interval]) || 'billing period';
}

/** True only when the server says the plan will not renew and when it ends. */
export function isOnePeriodSubscription(
  subscription: { renews?: boolean; ends_at: string | null } | null | undefined,
): boolean {
  return subscription?.renews === false && !!subscription.ends_at;
}

/** The sentence a plan screen shows in place of its renewal date. */
export function onePeriodSentence(interval: string | null | undefined, endsOn: string): string {
  return (
    `This payment covers one ${oneOffPeriodNoun(interval)}. Ends ${endsOn}. ` +
    'Pay again to continue, or pay by card or direct debit for automatic renewal.'
  );
}
