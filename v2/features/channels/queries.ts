import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import {
  channelAiApi,
  channelFilesApi,
  channelListsApi,
  channelsApi,
  messageEngagementApi,
  messagesApi,
  spacesApi,
} from '@/lib/api/collab';
import type {
  ChannelListParams,
  MemberListParams,
  MessageListParams,
  ThreadIndexParams,
} from '@/types/collab';
import { extractApiError } from '@/lib/utils/api-error';
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
 *  - every CHANNEL-ROW list (cross-space `mine` + `myThreads`, per-space
 *    `bySpace` + `threadsBySpace`) lives under the ONE `lists()` prefix, so a
 *    `.channel.unread` writer reaches all of them in a single fan-out;
 *  - `detailsOf(uuid)` / `membersOf(uuid)` / `messagesOf(uuid)` are the
 *    per-channel prefixes writers and invalidations target.
 * The per-space channel list therefore lives HERE, not in the spaces factory
 * (v1 keyed it under spaces): the row type owns the key family. The two THREAD
 * indexes (2026-08-16) follow the same rule for the same reason - a thread IS a
 * channel on the wire, so its rows want the channel writers.
 *
 * ── EVERY ENTRY UNDER `lists()` MUST BE A FLAT `ChannelListResponse` ───────
 * Not a style rule: it is what the writers can parse. `applyChannelCounts` and
 * `applyChannelNotifyLevel` both run `setQueriesData<ChannelListResponse>` over
 * EVERY cached entry beneath this prefix and reach straight into `data.data`.
 * Hand either of them an `infiniteQueryOptions` entry and that is `undefined`,
 * so the fan-out throws on the next unread event anywhere in the app.
 *
 * That, and not the `topLevel()` filter, is the real reason the per-channel
 * `threads` leaf at the bottom of this file stays out of `lists()`: it is
 * page-infinite. The two indexes below are flat, exactly like the channel
 * listings they mirror, so they are safe under it.
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
   * VIEWER-PARTITIONED SINCE W5 (audit note N4). W1 left this leaf on its
   * pre-phase signature because the home section consumed it and was out of
   * that wave's diff budget; W5 owns the home section, so the partition every
   * other leaf in this factory carries is now uniform here too. The rows are
   * as per-viewer as any (`my_role`, `my_notify_level`, both counts), and
   * `V2CacheIdentityGuard` clearing the cache on the identity edge is a
   * safety net, not a substitute for keying the data by whose it is.
   */
  mine: ({ viewerId, ...params }: ChannelListParams & ViewerScoped) =>
    queryOptions({
      queryKey: [
        ...channelsQueries.lists(),
        'mine',
        params,
        { viewerId },
      ] as const,
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

  /* ── The two THREAD indexes (live 2026-08-16) ──────────────────────────────
     `GET /spaces/{uuid}/threads` and `GET /threads`, the thread twins of the
     two listings above, returning the SAME `ChannelResource` rows. They are
     flat and viewer-partitioned exactly like their twins, and they sit under
     `lists()` for the reason spelled out in the key-geography note: that prefix
     is the ONE fan-out `applyChannelCounts` and `applyChannelNotifyLevel` walk,
     so a mention landing in a thread moves that thread's row live instead of
     leaving it stale under a space badge that already counted it - the exact
     mismatch these routes were asked for. `useCachedChannelIdentity` reads the
     same prefix and is now thread-aware for the same reason.

     NOT to be confused with `threadsOf`/`threads` at the bottom of this file:
     that is ONE CHANNEL's threads, page-infinite, and it must stay out of
     `lists()` because the writers there cannot parse an infinite entry.       */

  /**
   * One space's threads (`GET /spaces/{uuid}/threads`) - what the lobby's
   * "Active here" digest merges with the channel rows so the space's mention
   * badge has rows to land on. Newest activity first, a brand-new silent thread
   * at the top.
   *
   * NOT read by the rail or the drawer, and that is not an omission: threads
   * have no rail row by design (`ThreadsSheet` is the channel-level surface),
   * which is why this is mounted by the lobby screen rather than by
   * `CollabFrame` beside `bySpace`: a channel route pays nothing for it.
   */
  threadsBySpace: ({
    spaceUuid,
    viewerId,
    ...params
  }: ThreadIndexParams & BySpaceOptions) =>
    queryOptions({
      queryKey: [
        ...channelsQueries.lists(),
        'space-threads',
        spaceUuid,
        params,
        { viewerId },
      ] as const,
      queryFn: () => spacesApi.getThreads(spaceUuid, params),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),

  /**
   * The caller's threads across every space (`GET /threads`) - the twin of
   * `mine`, merged with it into the one ranked list `/channels` draws
   * (`my-channels/model.ts`, `mergeMyRooms`). Read by `MyChannelsScreen` since
   * 2026-08-16, which is what closed the cross-space half of the hole: the
   * channel listing applies `topLevel()`, so a reader tagged in a thread could
   * not see that thread anywhere on the screen named after their channels.
   *
   * CALLED BARE THERE, with no params, exactly as `mine` is called by both the
   * screen and the nav signal. The params object is part of the key, so the bare
   * entry is the one a second consumer will reach for by default, and both
   * routes default to 20 per page - which keeps the two halves of the merged
   * list cut off at the same depth.
   */
  myThreads: ({ viewerId, ...params }: ThreadIndexParams & ViewerScoped) =>
    queryOptions({
      queryKey: [
        ...channelsQueries.lists(),
        'my-threads',
        params,
        { viewerId },
      ] as const,
      queryFn: () => channelsApi.getMyThreads(params),
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
   *
   * ── `around` IS A SECOND ENTRY, NOT A FILTER (2026-08-12) ──────────────────
   * `around: null` is THE channel's history, anchored at the newest message and
   * growing backwards — the entry that has always been here, that the realtime
   * writers append arrivals to, and that the reader is in whenever they are in
   * the present.
   *
   * `around: <uuid>` is a WINDOW around one old message, and it is a separate
   * cache entry on purpose. Splicing that window into the live entry would put
   * the jumped-to message directly under the oldest loaded one with a gap of
   * unfetched history between them and nothing saying so — a transcript that
   * reads as continuous and is not. Two entries cannot lie about that: each one
   * is contiguous, and the feed shows exactly one of them at a time.
   *
   * BOTH DIRECTIONS PAGE FROM THE WINDOW. `getNextPageParam` walks further back
   * as it always has; `getPreviousPageParam` walks forward towards the present
   * on `prev_cursor`, which is `null` on the live entry's first page (so
   * `hasPreviousPage` is false there and nothing changes for the live view) and
   * `null` again once a window has been paged all the way up to the newest
   * message.
   *
   * The parameter rides page ONE only — see the queryFn.
   */
  messages: ({
    channelUuid,
    viewerId,
    around,
    ...params
  }: Omit<MessageListParams, 'cursor' | 'around_message_uuid'> &
    MessagesOptions & {
      /** The message to open a window around; `null` = the live history. */
      around: string | null;
    }) =>
    infiniteQueryOptions({
      queryKey: [
        ...channelsQueries.messagesOf(channelUuid),
        params,
        { around },
        { viewerId },
      ] as const,
      queryFn: ({ pageParam }) =>
        messagesApi.list(channelUuid, {
          ...params,
          cursor: pageParam ?? undefined,
          // PAGE ONE ONLY. Every page after it is reached by one of the two
          // cursors the window came back with, and the server lets a cursor win
          // over this parameter anyway.
          around_message_uuid: pageParam === null ? (around ?? undefined) : undefined,
        }),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage) => lastPage.pagination.next_cursor ?? undefined,
      getPreviousPageParam: (firstPage) =>
        firstPage.pagination.prev_cursor ?? undefined,
      // A 422 IS THE SERVER'S FINAL ANSWER, so it must not be spent twice. The
      // route answers 422 for a message that is not in this channel — the same
      // answer it gives for a uuid that never existed anywhere, deliberately, so
      // it cannot be used to probe elsewhere. Nothing about a second attempt
      // could change it. Every other failure keeps the client default's one
      // retry.
      retry: (failureCount, error) =>
        extractApiError(error).status !== 422 && failureCount < 1,
      staleTime: STALE_TIMES.realtime,
      gcTime: GC_TIMES.list,
    }),

  /* ── Task lists & files (phase-5 W2, audit note N3) ────────────────────────
     The v2 keys the ported `.list.changed` / `.file.changed` snapshot writers
     (`./lists-files-cache.ts`) fan over. Named `taskLists*` because `lists()`
     above is already this factory's CHANNEL-ROW list prefix — the two key
     families must never collide. Same tier reasoning as `messages`: REALTIME
     (`staleTime: Infinity`) because the presence-room events are the
     staleness signal while the screen is open, and the room hook reconciles
     once per (re)join for the events missed while away (`./room.ts`) — a
     timed refetch would only race the writers. Single page of 50, v1 parity
     (LF pagination out of scope for this wave). */

  /** Invalidation/write handle for one channel's task-list INDEX (summaries). */
  taskListsOf: (channelUuid: string) =>
    [...channelsQueries.all, 'task-lists', channelUuid] as const,

  /** A channel's task lists — INDEX shape (`TaskListSummary`: counts, NO items). */
  taskLists: ({ channelUuid, viewerId }: MessagesOptions) =>
    queryOptions({
      queryKey: [...channelsQueries.taskListsOf(channelUuid), { viewerId }] as const,
      queryFn: () => channelListsApi.getList(channelUuid, { per_page: 50 }),
      staleTime: STALE_TIMES.realtime,
      gcTime: GC_TIMES.list,
    }),

  /** Invalidation/write handle for one list's DETAIL (all viewer variants).
   *  Lists are globally addressable by uuid (`GET /lists/{uuid}`), so the
   *  detail key is channel-independent — exactly v1's key geometry. */
  taskListDetailOf: (listUuid: string) =>
    [...channelsQueries.all, 'task-list-detail', listUuid] as const,

  /** One list with its items — DETAIL shape (`TaskList`: items, NO counts). */
  taskListDetail: (listUuid: string, { viewerId }: ViewerScoped) =>
    queryOptions({
      queryKey: [...channelsQueries.taskListDetailOf(listUuid), { viewerId }] as const,
      queryFn: () => channelListsApi.show(listUuid),
      staleTime: STALE_TIMES.realtime,
      gcTime: GC_TIMES.list,
    }),

  /** Invalidation/write handle for one channel's file library. */
  filesOf: (channelUuid: string) =>
    [...channelsQueries.all, 'files', channelUuid] as const,

  /** A channel's file library (completed uploads only; files use integer id). */
  files: ({ channelUuid, viewerId }: MessagesOptions) =>
    queryOptions({
      queryKey: [...channelsQueries.filesOf(channelUuid), { viewerId }] as const,
      queryFn: () => channelFilesApi.getList(channelUuid, { per_page: 50 }),
      staleTime: STALE_TIMES.realtime,
      gcTime: GC_TIMES.list,
    }),

  /* ── Engagement surfaces (phase-5 W3) ──────────────────────────────────────
     Pins and saves are LISTS OF MESSAGES, not message history, so they get
     their own key families — the message writers must never fan over them (a
     pinned row and its feed twin are separate cache entries by design, and the
     panels are refetched, not hand-patched, when pin/save state moves).

     STANDARD tier, not realtime: `.message.pinned` invalidates the pins list
     explicitly (the event carries no message body, so a write is impossible),
     and saves have no event at all — REST is their entire transport (§F.2).
     Both mount only while their panel is open. */

  /** Invalidation handle for one channel's pinned-messages list. */
  pinsOf: (channelUuid: string) =>
    [...channelsQueries.all, 'pins', channelUuid] as const,

  /** The channel's pinned messages (`pinned_at DESC`, rows add `pinned_by`). */
  pins: ({ channelUuid, viewerId }: MessagesOptions) =>
    queryOptions({
      queryKey: [...channelsQueries.pinsOf(channelUuid), { viewerId }] as const,
      queryFn: () => messageEngagementApi.getPins(channelUuid, { per_page: 50 }),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),

  /** Invalidation handle for the VIEWER's saved messages in one channel. */
  savedOf: (channelUuid: string) =>
    [...channelsQueries.all, 'saved', channelUuid] as const,

  /** The viewer's private saves here. Viewer-partitioned like everything else,
   *  and privately scoped server-side — two readers never share this entry. */
  saved: ({ channelUuid, viewerId }: MessagesOptions) =>
    queryOptions({
      queryKey: [...channelsQueries.savedOf(channelUuid), { viewerId }] as const,
      queryFn: () => messageEngagementApi.getBookmarks(channelUuid, { per_page: 50 }),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),

  /* ── The channel's own threads (Threads Phase 4) ───────────────────────────
     A list of CHANNELS, not of messages, and deliberately NOT under the
     `lists()` prefix, BECAUSE IT IS PAGE-INFINITE, which is a shape the
     writers over that prefix cannot read (`data.data` is `undefined` on an
     `InfiniteData` entry; see the key-geography note at the top of this file).

     THE REASON RECORDED HERE UNTIL 2026-08-16 WAS THE WRONG ONE. It said filing
     thread rows under `lists()` "would hand those writers rows that the rail and
     the drawer must never show". It would not: those writers are uuid-matched
     assignments onto rows that are already cached, and the rail and the drawer
     read the `bySpace` ENTRY, not the prefix, and a sibling entry under the same
     prefix puts nothing in their list. `threadsBySpace` above is exactly that
     sibling and it does no such harm. The shape constraint is the real one, and
     it is the one that would have crashed.

     The consequence, stated rather than hidden: this sheet's rows do NOT get
     live count writes, so a thread open in the sheet and the same thread in the
     space digest can disagree until the sheet refetches. That is unchanged
     behaviour, not a regression, and the sheet's `staleTime` is what covers it. */

  /** Invalidation handle for one channel's threads list (both filters). */
  threadsOf: (channelUuid: string) =>
    [...channelsQueries.all, 'threads', channelUuid] as const,

  /**
   * The threads branched out of one channel — newest activity first, with a
   * brand-new silent thread at the TOP so a standalone one is reachable.
   *
   * PAGE-INFINITE, NOT CURSOR. `messages` two leaves up is cursor-paginated and
   * this is not; the endpoint ignores `?cursor=` outright (measured on prod
   * 2026-08-12), so copying that leaf's `getNextPageParam` here would page for
   * ever over page one.
   *
   * `mine` IS IN THE KEY because it is a different list, not a filter over one:
   * All and Following are separate server queries with their own totals, so
   * they must not share a cache entry and overwrite each other's pages.
   *
   * STANDARD tier and no `REFETCH_ON_VISIT`. The panel is `enabled: open`, so
   * its observer is mounted long before the reader opens anything and a
   * mount-time flag would fire while the query was still disabled — inert
   * configuration. `staleTime` is the lever that actually works here: opening
   * the panel more than a minute after the last fetch re-reads the unread
   * tallies, which are the reason this list exists.
   */
  threads: ({
    channelUuid,
    mine,
    viewerId,
  }: MessagesOptions & { mine: boolean }) =>
    infiniteQueryOptions({
      queryKey: [
        ...channelsQueries.threadsOf(channelUuid),
        { mine },
        { viewerId },
      ] as const,
      queryFn: ({ pageParam }) =>
        channelsApi.getThreads(channelUuid, { mine, per_page: 20, page: pageParam }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) =>
        lastPage.pagination.current_page < lastPage.pagination.last_page
          ? lastPage.pagination.current_page + 1
          : undefined,
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
    }),

  /* ── Lawexa sessions (phase-5 W3) ──────────────────────────────────────────
     The session INDEX is length-aware; a session's TRANSCRIPT is cursor-
     paginated (newest-first, like message history) and complete — it carries
     the tool machinery as well as the dialogue. Both mount only while the
     sessions sheet is open. */

  /** Invalidation handle for a channel's AI-session index (all page variants). */
  aiSessionsOf: (channelUuid: string) =>
    [...channelsQueries.all, 'ai-sessions', channelUuid] as const,

  /** A channel's Lawexa sessions, newest-first, page-infinite. */
  aiSessions: ({ channelUuid, viewerId }: MessagesOptions) =>
    infiniteQueryOptions({
      queryKey: [...channelsQueries.aiSessionsOf(channelUuid), { viewerId }] as const,
      queryFn: ({ pageParam }) =>
        channelAiApi.getSessions(channelUuid, { per_page: 20, page: pageParam }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) =>
        lastPage.pagination.current_page < lastPage.pagination.last_page
          ? lastPage.pagination.current_page + 1
          : undefined,
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
    }),

  /** Invalidation handle for ONE session's transcript. */
  aiSessionTranscriptOf: (sessionUuid: string) =>
    [...channelsQueries.all, 'ai-session', sessionUuid] as const,

  /** One session's COMPLETE transcript — cursor, newest-first (so each
   *  `fetchNextPage()` loads an OLDER page and the view renders reversed).
   *  Machinery rows are filtered client-side, never server-side: the dialogue
   *  view is a lens over the whole record, and "show everything" must not
   *  need a second request. */
  aiSessionTranscript: ({
    channelUuid,
    sessionUuid,
    viewerId,
  }: MessagesOptions & { sessionUuid: string }) =>
    infiniteQueryOptions({
      queryKey: [
        ...channelsQueries.aiSessionTranscriptOf(sessionUuid),
        { viewerId },
      ] as const,
      queryFn: ({ pageParam }) =>
        channelAiApi.getSession(channelUuid, sessionUuid, {
          per_page: 30,
          cursor: pageParam ?? undefined,
        }),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage) => lastPage.pagination.next_cursor ?? undefined,
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
    }),
};
