import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { subscriptionsApi } from '@/lib/api/subscriptions';
import { trialApi } from '@/lib/api/trial';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * Billing: the current plan, the trial when there is one, the invoices, and
 * the two cancellations.
 *
 *   GET  /subscriptions/current           the plan and subscription, or the free tier
 *   GET  /trial/status                    read only while the subscription is trialing
 *   GET  /subscriptions/invoices          paged, 10 a page
 *   POST /subscriptions/cancel            a paid subscription
 *   POST /trial/cancel                    a free trial
 */
export const billingQueries = {
  all: ['settings', 'billing'] as const,

  current: () =>
    queryOptions({
      queryKey: [...billingQueries.all, 'current'] as const,
      queryFn: async () => (await subscriptionsApi.getCurrent()).data ?? null,
      staleTime: STALE_TIMES.standard,
    }),

  trial: (enabled: boolean) =>
    queryOptions({
      queryKey: [...billingQueries.all, 'trial'] as const,
      queryFn: async () => (await trialApi.getStatus()).data ?? null,
      staleTime: STALE_TIMES.standard,
      enabled,
    }),

  invoices: () =>
    infiniteQueryOptions({
      queryKey: [...billingQueries.all, 'invoices'] as const,
      queryFn: ({ pageParam }) => subscriptionsApi.getInvoices({ page: pageParam, per_page: 10 }),
      initialPageParam: 1,
      getNextPageParam: (last) =>
        last.pagination.current_page < last.pagination.last_page
          ? last.pagination.current_page + 1
          : undefined,
      staleTime: STALE_TIMES.standard,
    }),
};

/** Cancel a paid subscription, or a free trial; either re-reads the plan. */
export function useCancelPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    // The two answers carry different records; the screen reads only the message.
    mutationFn: async (kind: 'subscription' | 'trial'): Promise<{ message?: string }> =>
      kind === 'trial' ? trialApi.cancelTrial() : subscriptionsApi.cancel(),
    meta: { silentError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: billingQueries.all });
    },
  });
}
