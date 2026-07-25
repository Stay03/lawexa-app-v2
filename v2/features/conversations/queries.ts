import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { chatApi } from '@/lib/api/chat';
import type {
  ConversationData,
  ConversationsListResponse,
  ListConversationsParams,
} from '@/types/chat';
import { GC_TIMES, STALE_TIMES } from '@/v2/runtime/query';

/**
 * Conversations query policy — copies the `v2/features/cases/queries.ts`
 * exemplar exactly: a hierarchical key factory whose leaves are `queryOptions()`
 * objects, wrapping the shared `lib/api/chat.ts` fetcher unchanged (the same data
 * layer v1 uses). Only this query-policy wrapper is new.
 *
 * Structure convention (mirrored from the exemplar):
 *  - `all`             the feature root key segment (a value, not a function).
 *  - `lists()`         the "all lists" invalidation handle for every list variant.
 *  - `list(p)`         a concrete list query (leaf → `queryOptions`).
 *  - `recents()`       the home "recents" PEEK — a single fixed-size page (Design B
 *                      home). Delegates to `list()`, so every `recents()` caller
 *                      resolves to ONE cache entry and never refetches.
 *  - `infiniteRecents()` the sidebar + drawer Recents — a paginated infinite list
 *                      (owner #26). Its own cache entry, shared by BOTH chrome
 *                      surfaces (identical key), so the rail and the drawer read
 *                      the same accumulating pages and load-more only once.
 *
 * `enabled` is intentionally NOT baked into the leaves — it's a call-site concern
 * (`useInfiniteQuery({ ...conversationsQueries.infiniteRecents(), enabled })`), the
 * same policy the exemplar documents (a leaf must stay legal for the suspense form).
 */

/**
 * The recents PEEK params — newest active conversations first, one small page. A
 * module constant so every `recents()` caller produces a structurally-identical
 * query key and shares the single cache entry.
 */
const RECENTS_PARAMS: ListConversationsParams = {
  per_page: 10,
  status: 'active',
  sort_by: 'updated_at',
  sort_order: 'desc',
};

/**
 * The infinite-Recents params — same sort/filter as the peek, but a larger first
 * page (owner #26: "initial page ~20") and no `page` (the infinite query threads
 * that per fetch). A module constant so the sidebar and drawer produce identical
 * keys and share ONE accumulating cache entry.
 *
 * EXPORTED + `satisfies` (not annotated) so the wave-4 server prefetcher
 * (`server.ts`) reads the SAME concrete params to build its query string — one
 * source of truth for the infinite-recents key, no client/server drift. `satisfies`
 * keeps the literal types (`status: 'active'`, …) the fetcher needs.
 */
export const INFINITE_RECENTS_PARAMS = {
  per_page: 20,
  status: 'active',
  sort_by: 'updated_at',
  sort_order: 'desc',
} satisfies Omit<ListConversationsParams, 'page'>;

/**
 * Options for the full conversations LIST PAGE (`/conversations`, wave-5). Only
 * `search` varies at the call site — the rest of the params are fixed below.
 */
export interface ConversationsListPageOptions {
  /** Title search (`?search=`). Empty / whitespace is treated as no filter. */
  search?: string;
}

/**
 * The list page's fixed page size. Matches v1's `/conversations` (`per_page 15`)
 * — a smaller page than the sidebar peek because the page is a fuller row and the
 * user scrolls it deliberately (the sentinel loads more).
 */
const LIST_PAGE_PER_PAGE = 15;

/**
 * Thrown by {@link conversationsQueries.detail}'s fetcher when the server hands back
 * a record flagged `is_confidential`. A confidential conversation's CONTENT is
 * device-owned (IndexedDB, `v2/runtime/chat-engine/confidential-transcript.ts`) and
 * must never enter a shared cache, so the fetcher refuses to RETURN such a record —
 * throwing is what keeps it out of the cache entirely (a resolved value would be
 * stored). The conversation screen catches this and falls back to the device-owned
 * transcript path, which is the only place that content legitimately lives.
 *
 * In practice the server 404s confidential conversations by design; this exists so
 * the "no confidential content in the query cache" guarantee holds STRUCTURALLY
 * rather than by trusting that behaviour.
 */
export class ConfidentialConversationError extends Error {
  constructor() {
    super('confidential');
    this.name = 'ConfidentialConversationError';
  }
}

/** Read an HTTP status off an unknown (axios-shaped) error, or `undefined`. */
function httpStatusOf(error: unknown): number | undefined {
  const response = (error as { response?: { status?: number } } | null | undefined)?.response;
  return typeof response?.status === 'number' ? response.status : undefined;
}

/**
 * Identity of a conversation-detail cache entry. `viewerId` is NOT a request
 * parameter — the request is authorized by the bearer token — it is a CACHE
 * PARTITION (see the `detail()` docblock).
 */
export interface ConversationDetailOptions {
  conversationId: string;
  /** The server-verified viewer id (`V2SessionSnapshot.userId`), `null` if signed out. */
  viewerId: number | null;
}

export const conversationsQueries = {
  all: ['conversations'] as const,

  lists: () => [...conversationsQueries.all, 'list'] as const,

  /**
   * Paginated conversation list. STANDARD tier — a 60s staleTime keeps a
   * revisit instant without letting the list drift for long; conversation
   * titles/order change often enough that the reference tier would be too stale.
   *
   * `GC_TIMES.list` RETENTION (orthogonal to the staleTime above). Leaving the
   * page unmounts the last observer; on TanStack's 5-minute default gcTime the
   * entry is then dropped, so any return past that is a genuinely COLD query —
   * a full skeleton over rows we used to have. 30 minutes covers the whole
   * working session, and the 60s staleTime still forces a background refetch on
   * every remount, so the retained rows paint instantly and the refresh lands
   * behind them (the "never skeleton over cached content" rule).
   */
  list: (params: ListConversationsParams = {}) =>
    queryOptions({
      queryKey: [...conversationsQueries.lists(), params] as const,
      queryFn: () => chatApi.listConversations(params),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
    }),

  /** The read-only Recents PEEK (single page) shared by the Design B home panel. */
  recents: () => conversationsQueries.list(RECENTS_PARAMS),

  /**
   * The infinite Recents list backing the sidebar rail + mobile drawer (owner
   * #26). Pages accumulate as the user scrolls the sidebar's own scroll region;
   * `getNextPageParam` reads the API's `pagination` envelope (current/last page),
   * matching v1's `useInfiniteConversations`. STANDARD tier, same reasoning as
   * `list()`. `enabled` stays a call-site concern (guests never fetch).
   *
   * `GC_TIMES.list` matters MORE here than anywhere: this entry accumulates
   * pages as the user scrolls the rail, and on the default gcTime every one of
   * them is thrown away five minutes after the last v2 surface unmounts (a
   * detour into v1). Retention rebuilds the rail at its previous depth instead
   * of at page 1.
   */
  infiniteRecents: () =>
    infiniteQueryOptions({
      queryKey: [
        ...conversationsQueries.lists(),
        'infinite',
        INFINITE_RECENTS_PARAMS,
      ] as const,
      queryFn: ({ pageParam }) =>
        chatApi.listConversations({ ...INFINITE_RECENTS_PARAMS, page: pageParam }),
      initialPageParam: 1,
      getNextPageParam: (lastPage: ConversationsListResponse) => {
        const { current_page, last_page } = lastPage.pagination;
        return current_page < last_page ? current_page + 1 : undefined;
      },
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
    }),

  /**
   * The infinite list backing the `/conversations` PAGE (wave-5). Deliberately
   * DIFFERENT params from the recents rail: it omits `status`, so ARCHIVED rows
   * appear inline (the list page is the only surface where archived
   * conversations are reachable — v1-keep-drop §E), and pages at `per_page 15`
   * (v1 parity). Optional `search` maps to `?search=` for the title search.
   *
   * KEY FAMILY. Its queryKey lives under `lists()` (the same prefix
   * `infiniteRecents()` uses), so every `conversationsCache` write
   * (send-bump / create-upsert / title-patch / delete-remove) fans out to this
   * entry too via `setQueriesData({ queryKey: lists() })` — that free
   * propagation is the whole reason wave-5 follows wave-4. The `params` object
   * (no `status`, `per_page 15`, optional `search`) can never collide with the
   * recents key (`status:'active'`, `per_page 20`), and each distinct `search`
   * is its own cache entry that also receives the fan-out.
   *
   * A single `params` object feeds BOTH the queryKey and the queryFn, so the key
   * and the request can never drift. STANDARD tier — same reasoning as `list()`.
   * `enabled` stays a call-site concern (guests never fetch).
   *
   * `GC_TIMES.list` is what makes "go read a conversation, come back" render the
   * SAME list at the SAME scroll depth instead of a cold skeleton — the exact
   * return the `NewRowsPill` then reconciles: retained rows paint immediately,
   * the mount refetch lands behind them, and anything that arrived above the
   * user's position is announced rather than spliced in under their eyes.
   * (Each distinct `search` is its own entry and retains independently, so
   * clearing a search also returns to a warm unfiltered list.)
   */
  infiniteList: ({ search }: ConversationsListPageOptions = {}) => {
    const trimmed = search?.trim();
    const params: ListConversationsParams = {
      per_page: LIST_PAGE_PER_PAGE,
      sort_by: 'updated_at',
      sort_order: 'desc',
      ...(trimmed ? { search: trimmed } : {}),
    };
    return infiniteQueryOptions({
      queryKey: [...conversationsQueries.lists(), 'infinite', params] as const,
      queryFn: ({ pageParam }) =>
        chatApi.listConversations({ ...params, page: pageParam }),
      initialPageParam: 1,
      getNextPageParam: (lastPage: ConversationsListResponse) => {
        const { current_page, last_page } = lastPage.pagination;
        return current_page < last_page ? current_page + 1 : undefined;
      },
      staleTime: STALE_TIMES.standard,
      // Long retention for the UNFILTERED list only (review F5). Each distinct
      // `search` is its own entry, and the 300ms debounce commits intermediate
      // strings — pinning those for 30 minutes would retain dozens of dead
      // entries for no benefit, since the warm-on-return value comes from the
      // unfiltered entry. Filtered searches keep the 5-minute default.
      gcTime: trimmed ? undefined : GC_TIMES.list,
    });
  },

  /**
   * The "all conversation details" invalidation handle. Deliberately a SIBLING of
   * `lists()`, not a child: every `conversationsCache` writer fans out over
   * `setQueriesData({ queryKey: lists() })`, and those writers understand only the
   * two LIST shapes. Keeping details outside that prefix means a list write can
   * never reach a transcript entry (and vice versa).
   */
  details: () => [...conversationsQueries.all, 'detail'] as const,

  /**
   * ONE conversation's full transcript — the entry that makes re-opening a
   * conversation paint instantly instead of re-downloading it.
   *
   * VIEWER-PARTITIONED KEY (privacy — read this before changing it). The key ends
   * with the server-verified viewer id, so two different signed-in users on ONE
   * device can never read each other's cached transcript. This is not paranoia:
   * the v2 QueryClient is a MODULE SINGLETON (`v2/runtime/query-provider.tsx`) and
   * v1's logout (`lib/hooks/useAuth.ts`) calls `queryClient.clear()` on the
   * NEAREST provider — the v1 client — then soft-navigates to `/login`. The v2
   * cache therefore SURVIVES a sign-out on this device. Partitioning by viewer is
   * what makes that survival harmless for transcripts: user B's render asks for a
   * different key and gets a cold entry. (`null` — signed out — is its own
   * partition.) The id is only ever the DAL's `verifySession()` value threaded
   * through `<V2SessionProvider>`; it never authorizes anything, the backend still
   * authorizes every fetch on its own.
   *
   * NEVER CONFIDENTIAL. A confidential conversation's content lives only in the
   * device-owned IndexedDB transcript and 404s from the server by design; the
   * fetcher additionally refuses to return any record flagged `is_confidential`
   * (see {@link ConfidentialConversationError}), so no confidential content can
   * reach this cache even if the backend's behaviour changes. The screen also
   * leaves this query DISABLED for a conversation it already knows is
   * confidential, so the request is never even made.
   *
   * FRESHNESS. `STALE_TIMES.standard` (60s): a conversation the viewer is not
   * actively driving changes only from another tab/device, and the mount +
   * window-focus refetches then reconcile it. What keeps it from being
   * STALE-WRONG after the viewer's OWN turn is explicit invalidation at the turn
   * boundaries, wired in `useConversationController` — a connect marks the entry
   * invalid (`refetchType: 'none'`, because the live stream is the truth on
   * screen) and the terminal `completed` revalidates it, so the cached transcript
   * converges on server truth before the next open.
   *
   * `GC_TIMES.list` (30 min) — the same session-retention reasoning as the lists:
   * "read a conversation, go research, come back" must return to a warm
   * transcript, and TanStack's 5-minute default expires well inside that window.
   * Retention is bounded by how many conversations one viewer opens in half an
   * hour, which is what keeps the memory cost of holding transcripts acceptable.
   */
  detail: ({ conversationId, viewerId }: ConversationDetailOptions) =>
    queryOptions({
      queryKey: [
        ...conversationsQueries.details(),
        conversationId,
        { viewerId },
      ] as const,
      queryFn: async (): Promise<ConversationData> => {
        const response = await chatApi.getConversation(conversationId);
        // Mirrors the engine's former inline check exactly, so the screen's error
        // copy is unchanged: a non-success envelope surfaces the API's message.
        if (!response.success || !response.data.messages) {
          throw new Error(response.message || 'Failed to load conversation');
        }
        if (response.data.is_confidential) throw new ConfidentialConversationError();
        return response.data;
      },
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      // A missing / forbidden / device-owned conversation is a settled answer, not
      // a blip: retrying it only delays the "not available" screen. Everything else
      // keeps the client's default single retry.
      retry: (failureCount, error) => {
        if (error instanceof ConfidentialConversationError) return false;
        const status = httpStatusOf(error);
        if (status !== undefined && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
    }),
};
