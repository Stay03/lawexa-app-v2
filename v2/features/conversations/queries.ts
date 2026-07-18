import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { chatApi } from '@/lib/api/chat';
import type { ConversationsListResponse, ListConversationsParams } from '@/types/chat';
import { STALE_TIMES } from '@/v2/runtime/query';

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
 */
const INFINITE_RECENTS_PARAMS: Omit<ListConversationsParams, 'page'> = {
  per_page: 20,
  status: 'active',
  sort_by: 'updated_at',
  sort_order: 'desc',
};

export const conversationsQueries = {
  all: ['conversations'] as const,

  lists: () => [...conversationsQueries.all, 'list'] as const,

  /**
   * Paginated conversation list. STANDARD tier — a 60s staleTime keeps a
   * revisit instant without letting the list drift for long; conversation
   * titles/order change often enough that the reference tier would be too stale.
   */
  list: (params: ListConversationsParams = {}) =>
    queryOptions({
      queryKey: [...conversationsQueries.lists(), params] as const,
      queryFn: () => chatApi.listConversations(params),
      staleTime: STALE_TIMES.standard,
    }),

  /** The read-only Recents PEEK (single page) shared by the Design B home panel. */
  recents: () => conversationsQueries.list(RECENTS_PARAMS),

  /**
   * The infinite Recents list backing the sidebar rail + mobile drawer (owner
   * #26). Pages accumulate as the user scrolls the sidebar's own scroll region;
   * `getNextPageParam` reads the API's `pagination` envelope (current/last page),
   * matching v1's `useInfiniteConversations`. STANDARD tier, same reasoning as
   * `list()`. `enabled` stays a call-site concern (guests never fetch).
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
    }),
};
