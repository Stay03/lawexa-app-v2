import { queryOptions } from '@tanstack/react-query';
import { channelsApi } from '@/lib/api/collab';
import type { ChannelListParams } from '@/types/collab';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * Channels query factory (the `cases` exemplar pattern) — backs the Work home's
 * "Jump back in" module.
 *
 * ASK-B, LIVE. `mine()` wraps `channelsApi.getMine()` (GET /api/channels): the
 * caller's active-membership channels across ALL their spaces, server-sorted by
 * `last_message_at` desc (empty channels last), muted excluded unless
 * @mentioned, each row carrying its `space` context and a `last_message`
 * preview. This replaced the earlier per-space `bySpace` fan-out + client
 * merge/sort in `work/JumpBackInModule.tsx` — one leaf, one request, all ranking
 * server-side.
 *
 * Standard tier: `last_message_at` / `unread_count` move with channel traffic,
 * and refetch-on-focus keeps the rows honest until the phase-5 realtime spine
 * (`.channel.*` events) takes over.
 */
export const channelsQueries = {
  all: ['channels'] as const,

  lists: () => [...channelsQueries.all, 'list'] as const,

  /**
   * The caller's cross-space channels (GET /api/channels) — server-sorted and
   * `last_message`-preview-stamped. Keyed by `params` so search / page variants
   * stay distinct cache entries.
   */
  mine: (params: ChannelListParams = {}) =>
    queryOptions({
      queryKey: [...channelsQueries.lists(), 'mine', params] as const,
      queryFn: () => channelsApi.getMine(params),
      staleTime: STALE_TIMES.standard,
    }),
};
