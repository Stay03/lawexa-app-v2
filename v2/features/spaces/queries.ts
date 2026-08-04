import { queryOptions } from '@tanstack/react-query';
import { spacesApi } from '@/lib/api/collab';
import type { MemberListParams, SpaceListParams } from '@/types/collab';
import { GC_TIMES, REFETCH_ON_VISIT, STALE_TIMES } from '@/v2/runtime/query';

/**
 * Spaces query factory (the `v2/features/cases/queries.ts` exemplar pattern) —
 * phase-5 W1 grew the phase-3 list stub into the full viewer-scoped family the
 * notification spine writes into and the W4 `/spaces` screens will read.
 * Sources: `docs/v2-docs/phases/phase-5-collab-notifications/plan.md` (W1 item
 * 5) and `api-digest.md` §C/§D (2026-08-04).
 *
 * List and detail rows carry the §17 activity rollups for members:
 * `unread_channels_count` (muted channels EXCLUDED — the blue activity dot) and
 * `mention_count` (muted channels INCLUDED — the numeric badge; backend Ruling
 * A). Between refetches those two fields are kept live by the realtime spine's
 * cache writers (`./cache.ts`), which is why the tiers below can stay honest
 * without going `live`.
 *
 * `enabled` is deliberately NOT baked into the leaves (call-site concern —
 * collab queries are gated on the collab access state, see
 * `v2/features/collab/model.ts`).
 */

/**
 * VIEWER PARTITION — required on every leaf, same rule and same reasoning as
 * `conversationsQueries.ViewerScoped`: `viewerId` is NOT a request parameter
 * (the bearer token authorizes the request); it is a CACHE PARTITION, and it is
 * REQUIRED so that forgetting it is a type error rather than a silent
 * cross-account leak. `V2CacheIdentityGuard` already clears on identity edges;
 * the partition makes the same guarantee local and reviewable.
 */
export interface ViewerScoped {
  /** The server-verified viewer id (`V2SessionSnapshot.userId`), `null` if signed out. */
  viewerId: number | null;
}

export const spacesQueries = {
  all: ['spaces'] as const,

  lists: () => [...spacesQueries.all, 'list'] as const,

  /**
   * The caller's spaces, each row stamped with `my_role` + the §17 rollups.
   * ALSO the notification spine's badge baseline: `RealtimeSpine` mounts the
   * `{}`-params variant of this leaf and derives the app-level mention total
   * (title / favicon / `setAppBadge`) from its rows — so the W4 `/spaces`
   * screen sharing this key paints from an already-warm cache (the owner feel
   * directive: fluidity = cache-first paints).
   *
   * Standard tier + `REFETCH_ON_VISIT`: membership changes (an accepted invite,
   * a new space) arrive from other people, so an arrival at `/spaces` must ask;
   * the in-between is covered by the spine's `.channel.unread` writers and the
   * reconnect invalidation.
   */
  list: ({ viewerId, ...params }: SpaceListParams & ViewerScoped) =>
    queryOptions({
      queryKey: [...spacesQueries.lists(), params, { viewerId }] as const,
      queryFn: () => spacesApi.getList(params),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),

  details: () => [...spacesQueries.all, 'detail'] as const,

  /**
   * Every cached variant of ONE space's detail, whatever the viewer segment —
   * the invalidation/write handle the spine's rollup writers fan over.
   */
  detailsOf: (uuid: string) => [...spacesQueries.details(), uuid] as const,

  /** Full space detail (identity header, roster on `show`, rollups). */
  detail: (uuid: string, { viewerId }: ViewerScoped) =>
    queryOptions({
      queryKey: [...spacesQueries.detailsOf(uuid), { viewerId }] as const,
      queryFn: () => spacesApi.getByUuid(uuid),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),

  /** Invalidation handle for one space's member roster (all params variants). */
  membersOf: (spaceUuid: string) =>
    [...spacesQueries.all, 'members', spaceUuid] as const,

  /**
   * A space's member roster — drives the members sheet and role management
   * (W4). Standard tier; membership mutations and the W2 room's
   * `member.joined/left` handlers invalidate through {@link membersOf}.
   */
  members: (
    spaceUuid: string,
    { viewerId, ...params }: MemberListParams & ViewerScoped,
  ) =>
    queryOptions({
      queryKey: [...spacesQueries.membersOf(spaceUuid), params, { viewerId }] as const,
      queryFn: () => spacesApi.getMembers(spaceUuid, params),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),
};
