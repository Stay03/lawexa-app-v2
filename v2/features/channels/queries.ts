import { queryOptions } from '@tanstack/react-query';
import { spacesApi } from '@/lib/api/collab';
import type { ChannelListParams } from '@/types/collab';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * Channels query factory (the `cases` exemplar pattern) — the per-space channel
 * list backing the Work home's "Jump back in" module. Wraps
 * `spacesApi.getChannels(spaceUuid, params)` unchanged; only this query-policy
 * wrapper is new.
 *
 * THE ASK-B SEAM. "Jump back in" wants the caller's most-active channels ACROSS
 * their spaces, but no cross-space endpoint exists yet, so today it fans out a
 * bounded set of these `bySpace` queries over the top work spaces and merges the
 * result (see `work/JumpBackInModule.tsx`). When the cross-space my-channels
 * endpoint ships (backend Ask B), that module swaps its data source to a single
 * `channelsQueries.mine()` leaf added HERE — one function boundary, no change to
 * the module's layout or row rendering.
 *
 * Standard tier: `last_message_at` / `unread_count` move with channel traffic,
 * and refetch-on-focus keeps the rows honest until the phase-5 realtime spine
 * (`.channel.*` events) takes over.
 */
export const channelsQueries = {
  all: ['channels'] as const,

  lists: () => [...channelsQueries.all, 'list'] as const,

  /** One space's channels. Keyed by `spaceUuid` + `params` so each space's
   *  list is its own cache entry and the fan-out never collides. */
  bySpace: (spaceUuid: string, params: ChannelListParams = {}) =>
    queryOptions({
      queryKey: [...channelsQueries.lists(), spaceUuid, params] as const,
      queryFn: () => spacesApi.getChannels(spaceUuid, params),
      staleTime: STALE_TIMES.standard,
    }),
};
