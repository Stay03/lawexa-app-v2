import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
} from '@tanstack/react-query';

import { messagePacksApi } from '@/lib/api/message-packs';
import type { TCurrency } from '@/types/payment';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * Message packs: the balance, the price list, the purchase history and the
 * purchase, against the endpoints measured on 21 September 2026 (all three
 * reads answer, paginated with real totals):
 *
 *   GET  /message-packs/balance          { payg_remaining }
 *   GET  /message-packs/pricing          messages_per_pack, one price per currency
 *   GET  /message-packs?page=&per_page=  the account's packs, newest first
 *   POST /message-packs/purchase         a payment session; the page leaves for
 *                                        the provider's checkout
 *   GET  /message-packs/verify/{ref}     on return, completes the purchase
 */
export const messagePacksQueries = {
  all: ['settings', 'message-packs'] as const,

  balance: () =>
    queryOptions({
      queryKey: [...messagePacksQueries.all, 'balance'] as const,
      queryFn: async () => (await messagePacksApi.getBalance()).data?.payg_remaining ?? 0,
      staleTime: STALE_TIMES.standard,
    }),

  pricing: () =>
    queryOptions({
      queryKey: [...messagePacksQueries.all, 'pricing'] as const,
      queryFn: async () => (await messagePacksApi.getPricing()).data ?? null,
      staleTime: STALE_TIMES.reference,
    }),

  /** 15 per page, the API's default; "Show more" reads the next page. */
  history: () =>
    infiniteQueryOptions({
      queryKey: [...messagePacksQueries.all, 'history'] as const,
      queryFn: ({ pageParam }) => messagePacksApi.list({ page: pageParam, per_page: 15 }),
      initialPageParam: 1,
      getNextPageParam: (last) =>
        last.pagination.current_page < last.pagination.last_page
          ? last.pagination.current_page + 1
          : undefined,
      staleTime: STALE_TIMES.standard,
    }),
};

/**
 * Start a purchase. On success the caller sends the browser to the provider's
 * checkout; the provider returns it to `/payg/callback`, where v2 verifies.
 */
export function usePurchasePacks() {
  return useMutation({
    mutationFn: (input: { quantity: number; currency: TCurrency }) =>
      messagePacksApi.purchase({
        quantity: input.quantity,
        currency: input.currency,
        callbackUrl: `${window.location.origin}/payg/callback`,
      }),
    meta: { silentError: true },
  });
}

/** Complete a purchase from the reference the provider returned with. */
export function useVerifyPurchase() {
  return useMutation({
    mutationFn: (reference: string) => messagePacksApi.verify(reference),
    meta: { silentError: true },
  });
}
