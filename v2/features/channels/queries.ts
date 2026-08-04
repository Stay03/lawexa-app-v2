import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { channelsApi, messagesApi, spacesApi } from '@/lib/api/collab';
import type {
  ChannelListParams,
  MemberListParams,
  MessageListParams,
} from '@/types/collab';
import { GC_TIMES, REFETCH_ON_VISIT, STALE_TIMES } from '@/v2/runtime/query';

/**
 * Channels query factory (the `v2/features/cases/queries.ts` exemplar pattern)
 * — phase-5 W1 grew the phase-3 `mine()` stub into the full viewer-scoped
 * family: per-space channel lists, channel detail, members, and the
 * cursor-infinite message history the W2 feed will render. Sources:
 * `docs/v2-docs/phases/phase-5-collab-notifications/plan.md` (W1 item 5) and
 * `api-digest.md` §C (2026-08-04).
 *
 * KEY GEOGRAPHY, LOAD-BEARING FOR THE SPINE'S WRITERS (`./cache.ts`):
 *  - every CHANNEL-ROW list (cross-space `mine`, per-space `bySpace`) lives
 *    under the ONE `lists()` prefix, so a `.channel.unread` writer reaches all
 *    of them in a single fan-out;
 *  - `detailsOf(uuid)` / `membersOf(uuid)` / `messagesOf(uuid)` are the
 *    per-channel prefixes writers and invalidations target.
 * The per-space channel list therefore lives HERE, not in the spaces factory
 * (v1 keyed it under spaces): the row type owns the key family.
 *
 * `enabled` is a call-site concern, gated on the collab access state
 * (`v2/features/collab/model.ts`) — never baked into the leaves.
 */

/**
 * VIEWER PARTITION — same rule and reasoning as `conversationsQueries`:
 * `viewerId` is a CACHE PARTITION, not a request parameter, and it is REQUIRED
 * so that forgetting it is a type error rather than a silent cross-account
 * leak. Channel rows are heavily per-viewer (`my_role`, `my_notify_level`,
 * `unread_count`, `mention_count`), so the partition is not optional here.
 */
export interface ViewerScoped {
  /** The server-verified viewer id (`V2SessionSnapshot.userId`), `null` if signed out. */
  viewerId: number | null;
}

/** Identity of a per-space channel-list cache entry. */
export interface BySpaceOptions extends ViewerScoped {
  spaceUuid: string;
}

/** Identity of a channel's message-history cache entry (cursor rides the
 *  pageParam, never the key — standards §2). */
export interface MessagesOptions extends ViewerScoped {
  channelUuid: string;
}

export const channelsQueries = {
  all: ['channels'] as const,

  lists: () => [...channelsQueries.all, 'list'] as const,

  /**
   * The caller's cross-space channels (GET /api/channels) — server-sorted and
   * `last_message`-preview-stamped. Keyed by `params` so search / page variants
   * stay distinct cache entries.
   *
   * PRE-W1 SIGNATURE, KEPT VERBATIM: `HomeSections.tsx` consumes this leaf and
   * is out of W1's diff budget, so `mine` stays param-keyed without the viewer
   * segment (the `V2CacheIdentityGuard` covers the identity edge). Migrating it
   * onto `ViewerScoped` is a one-line follow-up owned by the wave that next
   * touches the home section.
   */
  mine: (params: ChannelListParams = {}) =>
    queryOptions({
      queryKey: [...channelsQueries.lists(), 'mine', params] as const,
      queryFn: () => channelsApi.getMine(params),
      staleTime: STALE_TIMES.standard,
      // Home-glance retention: outlive TanStack's 5-minute default so a return to
      // the home paints this module from cache instead of a skeleton. Without it
      // the conversations recents were warm while every other module was cold.
      gcTime: GC_TIMES.list,
    }),

  /**
   * Channels within one space (GET /api/spaces/{space}/channels). Non-channel-
   * members see `space_public` rows only (server-enforced); member rows carry
   * `my_role`, `my_notify_level` and the live-count pair the spine assigns
   * into. Backs the W4 space-detail channel list.
   */
  bySpace: ({ spaceUuid, viewerId, ...params }: ChannelListParams & BySpaceOptions) =>
    queryOptions({
      queryKey: [
        ...channelsQueries.lists(),
        'by-space',
        spaceUuid,
        params,
        { viewerId },
      ] as const,
      queryFn: () => spacesApi.getChannels(spaceUuid, params),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),

  details: () => [...channelsQueries.all, 'detail'] as const,

  /**
   * Every cached variant of ONE channel's detail, whatever the viewer segment —
   * the handle the unread writers and membership invalidations fan over.
   */
  detailsOf: (uuid: string) => [...channelsQueries.details(), uuid] as const,

  /**
   * Full channel detail (settings incl. `ai_mentions_notify`, `my_notify_level`,
   * counts). ALSO the dispatcher's mute-oracle: when a mention arrives for a
   * channel with no cached row, the spine `fetchQuery`s this leaf to learn
   * `my_notify_level` before it may toast (Ruling A must be exact —
   * design-research.md, Discord mute complaint).
   */
  detail: (uuid: string, { viewerId }: ViewerScoped) =>
    queryOptions({
      queryKey: [...channelsQueries.detailsOf(uuid), { viewerId }] as const,
      queryFn: () => channelsApi.getByUuid(uuid),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
    }),

  /** Invalidation handle for one channel's member roster (all params variants). */
  membersOf: (channelUuid: string) =>
    [...channelsQueries.all, 'members', channelUuid] as const,

  /**
   * A channel's member roster — rows carry `last_read_message_uuid` (receipts
   * pointer; D2 says no receipts UI, the pointer still syncs badges) and
   * `notify_level` on the caller's own row only.
   */
  members: (
    channelUuid: string,
    { viewerId, ...params }: MemberListParams & ViewerScoped,
  ) =>
    queryOptions({
      queryKey: [
        ...channelsQueries.membersOf(channelUuid),
        params,
        { viewerId },
      ] as const,
      queryFn: () => channelsApi.getMembers(channelUuid, params),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),

  /**
   * Invalidation/write handle for one channel's message history — the prefix
   * the realtime message writers (`./cache.ts`) and the spine's reconnect
   * gap-recovery invalidate against.
   */
  messagesOf: (channelUuid: string) =>
    [...channelsQueries.all, 'messages', channelUuid] as const,

  /**
   * Message history: cursor-paginated, NEWEST-FIRST, so each `fetchNextPage()`
   * loads an OLDER page and the W2 feed renders the flattened pages reversed.
   * Stop is a null `next_cursor`.
   *
   * REALTIME TIER (`staleTime: Infinity`) — the target architecture from
   * foundation-standards §2: socket events are the staleness signal. The W2
   * room subscription feeds `applyMessageCreated/Updated/Deleted` and the
   * spine invalidates this prefix on every reconnect (gap recovery), so a
   * timed refetch would only race the writers. Deliberately NO
   * `REFETCH_ON_VISIT`: an infinite history refetches every loaded page, and
   * re-entering a busy channel five pages deep must paint from cache instantly
   * (the owner feel directive), not re-download its history.
   */
  messages: ({
    channelUuid,
    viewerId,
    ...params
  }: Omit<MessageListParams, 'cursor'> & MessagesOptions) =>
    infiniteQueryOptions({
      queryKey: [
        ...channelsQueries.messagesOf(channelUuid),
        params,
        { viewerId },
      ] as const,
      queryFn: ({ pageParam }) =>
        messagesApi.list(channelUuid, {
          ...params,
          cursor: pageParam ?? undefined,
        }),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage) => lastPage.pagination.next_cursor ?? undefined,
      staleTime: STALE_TIMES.realtime,
      gcTime: GC_TIMES.list,
    }),
};
