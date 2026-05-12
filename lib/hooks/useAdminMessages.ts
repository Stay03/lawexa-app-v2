'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { adminMessagesApi } from '@/lib/api/admin-messages';
import type {
  AdminMessageListParams,
  AdminMessageListResponse,
} from '@/types/admin-messages';

export const adminMessagesKeys = {
  all: ['admin', 'messages'] as const,
  list: (params: Omit<AdminMessageListParams, 'cursor'>) =>
    [...adminMessagesKeys.all, 'list', params] as const,
};

export function useAdminMessages(
  params: Omit<AdminMessageListParams, 'cursor'> = {}
) {
  return useInfiniteQuery<
    AdminMessageListResponse,
    Error,
    {
      pages: AdminMessageListResponse[];
      pageParams: (string | undefined)[];
    },
    ReturnType<typeof adminMessagesKeys.list>,
    string | undefined
  >({
    queryKey: adminMessagesKeys.list(params),
    queryFn: ({ pageParam }) =>
      adminMessagesApi.list({ ...params, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) =>
      last.pagination.has_more
        ? (last.pagination.next_cursor ?? undefined)
        : undefined,
    staleTime: 30_000,
  });
}
