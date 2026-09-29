import { queryOptions } from '@tanstack/react-query';

import { messagePacksApi } from '@/lib/api/message-packs';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * Usage: one read, `GET /users/limits` (the plan, the AI messages, the pack
 * balance, notes and bookmarks, as the server counts them).
 */
export const usageQueries = {
  all: ['settings', 'usage'] as const,

  limits: () =>
    queryOptions({
      queryKey: [...usageQueries.all, 'limits'] as const,
      queryFn: async () => (await messagePacksApi.getUserLimits()).data ?? null,
      staleTime: STALE_TIMES.standard,
    }),
};
