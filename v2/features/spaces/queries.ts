import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { spacesApi } from '@/lib/api/collab';
import { spaceRadarsApi } from '@/lib/api/radars';
import type {
  MemberListParams,
  SpaceItemsParams,
  SpaceItemsType,
  SpaceListParams,
} from '@/types/collab';
import { GC_TIMES, REFETCH_ON_VISIT, STALE_TIMES } from '@/v2/runtime/query';

/** A read this recent is the visit's own: a list mounting after the frame
 *  started its read uses it instead of asking again. */
export const JUST_READ_MS = 3000;

/** One page of a space's feed. Twenty fills a phone twice over, so the
 *  sentinel has a page in hand before the reader reaches it. */
const SPACE_CONTENT_PER_PAGE = 20;

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

/**
 * THE BASELINE LIST PARAMS — the ONE param shape the spine's badge query and
 * the `/spaces` screen's unfiltered tab both pass, so they resolve to the SAME
 * cache entry.
 *
 * WHY THIS CONSTANT EXISTS (W4 fix round, 2026-08-04). The two call sites drifted
 * the moment they were written independently: the spine mounted `list({ viewerId })`
 * while the screen asked for `list({ viewerId, per_page: 50 })`. TanStack hashes the
 * params object into the key, so those are two ENTRIES — every arrival at `/spaces`
 * skeletoned over an already-warm list and fired a second identical-in-spirit request,
 * which is exactly the cache-first paint the owner feel directive is about. Sharing a
 * constant makes the divergence impossible to reintroduce silently: change it here and
 * both move together.
 *
 * `per_page` is deliberately absent — the API's own default (30) is the baseline, and
 * naming a number here would only be a second place to keep in sync. A FILTERED tab
 * (Work / Study) still gets its own entry, which is correct: it is a different
 * question with a different answer.
 */
export const SPACES_BASELINE_PARAMS: SpaceListParams = {};

/**
 * What the feed asks to have joined in. The rooms join All and Conversations
 * for a reader who has team channels (`rooms`); the space Radars' reports
 * join All only (Radar in Spaces, Backend's B3, 26 October 2026): a report
 * is not a conversation, and the Radars pill lists the Radars themselves.
 */
export function spaceItemsInclude({ type, rooms }: { type?: SpaceItemsType; rooms: boolean }): string | undefined {
  const parts: string[] = [];
  if (rooms && (type === undefined || type === 'conversations')) parts.push('channels', 'threads');
  if (type === undefined) parts.push('radar_reports');
  return parts.length > 0 ? parts.join(',') : undefined;
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

  /**
   * ── A SPACE'S CONTENTS: chats, folders, files (backend B3, design 4.2) ────
   * Since design B4 (17 October 2026) one feed every member may read
   * ({@link items}), cursor-paged.
   *
   * IT LIVES UNDER `['spaces']`, NOT UNDER THE FEATURES IT LISTS. It must stay
   * OUT of `conversationsQueries.lists()`: every `conversationsCache` writer
   * fans over that prefix and treats what it finds as the VIEWER'S OWN list (a
   * send bumps a row to the top, a create upserts one), which a space's list of
   * other people's chats is not. One handle per space ({@link contentsOf})
   * invalidates it when something is moved or added.
   *
   * Standard tier, 30-minute retention, `REFETCH_ON_VISIT`: other members add
   * to a space while the reader is away, so an arrival must ask (the
   * conversations list's reasoning, word for word).
   */
  /** Every space's contents at once: what a MOVE dirties (Spaces F3), since
   *  an item leaves one space and enters another, and the client may know
   *  only one of the two. */
  contents: () => [...spacesQueries.all, 'contents'] as const,

  contentsOf: (spaceUuid: string) =>
    [...spacesQueries.contents(), spaceUuid] as const,

  /** Every cached page set of one space's one-list feed (`items`), whatever the
   *  pill or search: the handle its re-reads invalidate. */
  itemsOf: (spaceUuid: string) => [...spacesQueries.contentsOf(spaceUuid), 'items'] as const,

  /** Every cached page set of one space's files in none of its folders. */
  looseFilesOf: (spaceUuid: string) =>
    [...spacesQueries.contentsOf(spaceUuid), 'loose-files'] as const,

  /**
   * The space's files in none of the space's folders
   * (`GET /spaces/{uuid}/files?unfiled=1`, backend e76a5957), newest first:
   * what the Folders pill lists under the folders (Stay, 22 October 2026,
   * like the Folders page's loose files). Under the space's contents key, so
   * an upload, a delete, a remove and a move re-read it, and
   * `FOLDER_ITEM_INVALIDATES` names the prefix too: the server works the
   * list out per request, so a filing takes a file off it and an unfiling
   * puts it back.
   */
  looseFiles: (spaceUuid: string, { viewerId }: ViewerScoped) =>
    infiniteQueryOptions({
      queryKey: [...spacesQueries.looseFilesOf(spaceUuid), { viewerId }] as const,
      queryFn: ({ pageParam }) =>
        spacesApi.getUnfiledFiles(spaceUuid, { per_page: SPACE_CONTENT_PER_PAGE, page: pageParam }),
      initialPageParam: 1,
      getNextPageParam: (last) => {
        const { current_page, last_page } = last.pagination;
        return current_page < last_page ? current_page + 1 : undefined;
      },
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),

  /**
   * A space's conversations, files and root folders as one list, newest first
   * (the Space home, design B4; `GET /spaces/{uuid}/items`). One pill is one
   * `type`, none is All; `search` is the server's (conversation titles and file
   * names, or folder names under the Folders pill). Cursor-paged forward.
   *
   * Under the space's contents key, so every write that already re-reads a
   * space's contents (an add, a remove, a move, a new chat) re-reads this too.
   * No live event feeds it: a new message elsewhere marks it stale
   * (`conversationsCache.touch`).
   */
  items: (
    spaceUuid: string,
    {
      viewerId,
      type,
      search = '',
      rooms = false,
    }: ViewerScoped & {
      type?: SpaceItemsType;
      search?: string;
      /** The space's channels and the reader's followed threads join All and
       *  Conversations (Stay, 17 October 2026): for a reader who has team
       *  channels, in a team space (`spaceShowsChannels`). The server keeps
       *  the same rule, so asking is never a leak; asking only where they show
       *  keeps everyone else's cache entry what it was. */
      rooms?: boolean;
    },
  ) => {
    const include = spaceItemsInclude({ type, rooms });
    const params: SpaceItemsParams = {
      per_page: SPACE_CONTENT_PER_PAGE,
      ...(type ? { type } : {}),
      ...(search ? { search } : {}),
      ...(include ? { include } : {}),
    };
    return infiniteQueryOptions({
      queryKey: [...spacesQueries.itemsOf(spaceUuid), params, { viewerId }] as const,
      queryFn: ({ pageParam }) => spacesApi.getItems(spaceUuid, { ...params, cursor: pageParam }),
      initialPageParam: null as string | null,
      getNextPageParam: (last) => (last.pagination.has_more ? last.pagination.next_cursor : undefined),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      // The All list is read beside the space's details for a member
      // (`early-feed.ts`, speed step 5); the home mounting a moment
      // later must not read it a second time.
      refetchOnMount: (query) =>
        Date.now() - query.state.dataUpdatedAt < JUST_READ_MS ? false : REFETCH_ON_VISIT,
    });
  },

  /**
   * One level of the space's folders: the root when `parentUuid` is null, one
   * folder's children when it names one, filtered by `search`
   * (`GET /spaces/{uuid}/folders`, backend B3). The "Move to folder" picker
   * browses a space file's destinations here (Stay, 22 October 2026): the
   * viewer's own list (`foldersQueries.level`) holds the folders they made,
   * and a space's folders are every member's. Under the space's contents key,
   * so a new folder or a filing re-reads it. Page-numbered, as the route is.
   */
  folders: (
    spaceUuid: string,
    {
      viewerId,
      parentUuid = null,
      search,
    }: ViewerScoped & { parentUuid?: string | null; search?: string },
  ) =>
    infiniteQueryOptions({
      queryKey: [
        ...spacesQueries.contentsOf(spaceUuid),
        'folders',
        { parentUuid, search: search ?? null },
        { viewerId },
      ] as const,
      queryFn: ({ pageParam }) =>
        spacesApi.getFolders(spaceUuid, {
          parent_id: parentUuid ?? undefined,
          search,
          per_page: SPACE_CONTENT_PER_PAGE,
          page: pageParam,
        }),
      initialPageParam: 1,
      getNextPageParam: (last) => {
        const { current_page, last_page } = last.pagination;
        return current_page < last_page ? current_page + 1 : undefined;
      },
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),

  /** Every space's cached Radar lists: a chat's Radar tool may have changed any. */
  allRadars: () => [...spacesQueries.all, 'radars'] as const,

  /** Every cached list of one space's Radars, live and archived. */
  radarsOf: (spaceUuid: string) => [...spacesQueries.allRadars(), spaceUuid] as const,

  /**
   * The space's Radars (`GET /spaces/{uuid}/radars`, Radar in Spaces), each
   * with the reader's unread count and the newest report: the Radars pill.
   * Scans finish while the reader is away, so an arrival asks
   * (`REFETCH_ON_VISIT`, the personal Radars list's reasoning). One Radar's
   * own reads stay on `radarsQueries`, keyed by its uuid.
   */
  radars: (
    spaceUuid: string,
    { viewerId, status }: ViewerScoped & { status?: 'archived' },
  ) =>
    infiniteQueryOptions({
      queryKey: [...spacesQueries.radarsOf(spaceUuid), { status: status ?? null }, { viewerId }] as const,
      queryFn: ({ pageParam }) =>
        spaceRadarsApi.getList(spaceUuid, { status, per_page: SPACE_CONTENT_PER_PAGE, page: pageParam }),
      initialPageParam: 1,
      getNextPageParam: (last) => {
        const { current_page, last_page } = last.pagination;
        return current_page < last_page ? current_page + 1 : undefined;
      },
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
