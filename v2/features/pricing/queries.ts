import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { subscriptionsApi } from '@/lib/api/subscriptions';
import { trialApi } from '@/lib/api/trial';
import type { IPlan } from '@/types/subscription';
import { billingQueries } from '@/v2/features/settings/billing/queries';
import { subscriptionQueries } from '@/v2/features/subscription/queries';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * Pricing: the plan list, whether a free trial is open to this account, and
 * the three ways a card leaves for the payment provider. The calls are v1's,
 * through the same `lib/api` functions with the same arguments, so the
 * provider returns the buyer to the same three addresses v2 already claims
 * (`PlanPaymentCallback`).
 *
 *   GET  /subscriptions/plans        the plans this account is offered; needs a
 *                                    session (401 when signed out, measured
 *                                    5 October 2026)
 *   GET  /trial/eligibility          read only for an account pricing in Naira
 *   POST /subscriptions/initialize   a new plan: a checkout address
 *   POST /subscriptions/upgrade      a dearer plan: a checkout address, or the
 *                                    upgrade done outright when the credit
 *                                    left on the current plan covers it
 *   POST /trial/start                a free trial: a card check at Paystack
 *
 * The current plan is Billing's own query (`billingQueries.current`), so a
 * plan bought here and confirmed on return shows on both screens at once.
 */
export const pricingQueries = {
  all: ['pricing'] as const,

  plans: () =>
    queryOptions({
      queryKey: [...pricingQueries.all, 'plans'] as const,
      queryFn: async () => (await subscriptionsApi.getPlans()).data,
      staleTime: STALE_TIMES.reference,
    }),

  trialEligibility: (enabled: boolean) =>
    queryOptions({
      queryKey: [...pricingQueries.all, 'trial-eligibility'] as const,
      queryFn: async () => (await trialApi.checkEligibility()).data ?? null,
      staleTime: STALE_TIMES.standard,
      enabled,
    }),
};

/** Where a press on a card ends: at the provider's checkout, or already done. */
export type CheckoutOutcome =
  | { kind: 'checkout'; url: string }
  | { kind: 'upgraded'; message: string | null }
  | { kind: 'no-checkout' };

/**
 * A new plan or an upgrade, as v1 started either. The caller sends the browser
 * to `url`; an upgrade the credit covered is finished here, so both plan reads
 * are refreshed before the caller moves on to Billing.
 */
export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ plan, upgrade }: { plan: IPlan; upgrade: boolean }): Promise<CheckoutOutcome> => {
      if (upgrade) {
        const result = await subscriptionsApi.initializeUpgrade({ planId: plan.id, currency: plan.currency });
        const data = result.data;
        if (data && 'authorization_url' in data) return { kind: 'checkout', url: data.authorization_url };
        return { kind: 'upgraded', message: result.message || null };
      }
      const result = await subscriptionsApi.initializePayment({ planId: plan.id, currency: plan.currency });
      const url = result.data?.authorization_url;
      return url ? { kind: 'checkout', url } : { kind: 'no-checkout' };
    },
    meta: { silentError: true },
    onSuccess: (outcome) => {
      if (outcome.kind !== 'upgraded') return;
      void queryClient.invalidateQueries({ queryKey: billingQueries.all });
      void queryClient.invalidateQueries({ queryKey: subscriptionQueries.all });
    },
  });
}

/** Start a free trial: the answer is the address of Paystack's card check. */
export function useStartTrial() {
  return useMutation({
    mutationFn: async (plan: IPlan): Promise<string | null> =>
      (await trialApi.startTrial(plan.id)).data?.authorization_url ?? null,
    meta: { silentError: true },
  });
}
