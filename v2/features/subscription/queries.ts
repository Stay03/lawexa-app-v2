import { queryOptions } from '@tanstack/react-query';
import { subscriptionsApi } from '@/lib/api/subscriptions';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * Subscription query policy — same exemplar pattern as
 * `v2/features/cases/queries.ts`, wrapping the shared `lib/api/subscriptions.ts`
 * `getCurrent` fetcher unchanged. Only the plan-name for the shell footer is
 * needed this wave; the rest of the subscription surface lands with its feature.
 *
 * STANDARD tier (60s) rather than `reference`: the current plan is account
 * state, not slowly-changing catalogue data, so a refocus after an upgrade in v1
 * should reflect the new plan quickly. `enabled` stays a call-site concern —
 * the footer passes `enabled: !!user` so it never fetches for signed-out
 * visitors (`/subscriptions/current` requires auth).
 */
export const subscriptionQueries = {
  all: ['subscription'] as const,

  /** The signed-in user's current subscription (plan + free-tier flag). */
  current: () =>
    queryOptions({
      queryKey: [...subscriptionQueries.all, 'current'] as const,
      queryFn: () => subscriptionsApi.getCurrent(),
      staleTime: STALE_TIMES.standard,
    }),
};
