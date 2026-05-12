'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { adminPaystackWebhooksApi } from '@/lib/api/admin-paystack-webhooks';
import { extractApiError } from '@/lib/utils/api-error';
import type {
  PaystackWebhookDetailResponse,
  PaystackWebhookListParams,
  PaystackWebhookListResponse,
} from '@/types/admin-paystack-webhooks';

export const adminPaystackWebhookKeys = {
  all: ['admin', 'paystack-webhooks'] as const,
  list: (params: Omit<PaystackWebhookListParams, 'cursor'>) =>
    [...adminPaystackWebhookKeys.all, 'list', params] as const,
  detail: (id: number) =>
    [...adminPaystackWebhookKeys.all, 'detail', id] as const,
};

interface UseListOptions {
  live: boolean;
  pollMs?: number;
}

// Volume is ~5 deliveries/day per backend — 20s default cadence is plenty.
export function usePaystackWebhooks(
  params: Omit<PaystackWebhookListParams, 'cursor'> = {},
  { live, pollMs = 20_000 }: UseListOptions = { live: true }
) {
  return useInfiniteQuery<
    PaystackWebhookListResponse,
    Error,
    {
      pages: PaystackWebhookListResponse[];
      pageParams: (string | undefined)[];
    },
    ReturnType<typeof adminPaystackWebhookKeys.list>,
    string | undefined
  >({
    queryKey: adminPaystackWebhookKeys.list(params),
    queryFn: ({ pageParam }) =>
      adminPaystackWebhooksApi.list({ ...params, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) =>
      last.pagination.has_more
        ? last.pagination.next_cursor ?? undefined
        : undefined,
    refetchInterval: live ? pollMs : false,
    refetchIntervalInBackground: false,
    staleTime: live ? 0 : 30_000,
  });
}

export function usePaystackWebhook(id: number | null) {
  return useQuery<PaystackWebhookDetailResponse>({
    queryKey: adminPaystackWebhookKeys.detail(id ?? -1),
    queryFn: () => adminPaystackWebhooksApi.get(id as number),
    enabled: id !== null,
    staleTime: 10_000,
  });
}

export function useReplayPaystackWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminPaystackWebhooksApi.replay(id),
    onSuccess: (data) => {
      toast.success(data.message || 'Webhook replayed.');
      qc.invalidateQueries({ queryKey: adminPaystackWebhookKeys.all });
    },
    onError: (error: unknown) => {
      if (error instanceof AxiosError && error.response?.status === 429) {
        toast.error('Rate limit reached — try again in a minute.');
        return;
      }
      // Backend's own 422 message is descriptive (signature/truncation refusal).
      toast.error(extractApiError(error).message);
    },
  });
}
