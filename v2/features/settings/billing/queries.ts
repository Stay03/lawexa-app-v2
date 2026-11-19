import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { subscriptionsApi } from '@/lib/api/subscriptions';
import { extractApiError } from '@/lib/utils/api-error';
import type { CancellationFeedbackBody } from '@/types/feedback';
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
 *   POST /subscriptions/cancellation-feedback   why, after a paid cancel
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

/**
 * "Update card": asks for a fresh Paystack card link each time and opens it in
 * a new tab. The tab is opened AT THE TAP, before the request, because a
 * browser may block a tab opened after an await (iOS Safari gives no grace);
 * it is pointed at the link when it arrives, or closed with the reason when it
 * does not. A 404 means the plan no longer has a card to change, so the plan
 * is read again and the button goes.
 */
export function useUpdateCard(onFailure: (status: number | undefined, message: string | undefined) => void) {
  const queryClient = useQueryClient();
  const fetchLink = useMutation({
    mutationFn: async () => (await subscriptionsApi.getManageLink()).data?.link ?? null,
    meta: { silentError: true },
  });
  const open = () => {
    if (fetchLink.isPending) return;
    const tab = window.open('', '_blank');
    fetchLink.mutate(undefined, {
      onSuccess: (link) => {
        if (!link) {
          tab?.close();
          onFailure(undefined, undefined);
          return;
        }
        if (tab) {
          tab.opener = null;
          tab.location.href = link;
        } else {
          // The browser refused a new tab: go there in this one.
          window.location.assign(link);
        }
      },
      onError: (error) => {
        tab?.close();
        const { status, message } = extractApiError(error);
        if (status === 404) void queryClient.invalidateQueries({ queryKey: billingQueries.all });
        onFailure(status, message);
      },
    });
  };
  return { open, opening: fetchLink.isPending };
}

/** "Why are you cancelling?": one send; the plan is already cancelled. */
export function useSendCancellationFeedback() {
  return useMutation({
    mutationFn: (body: CancellationFeedbackBody) => subscriptionsApi.sendCancellationFeedback(body),
    meta: { silentError: true },
  });
}
