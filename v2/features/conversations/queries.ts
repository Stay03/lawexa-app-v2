import { queryOptions } from '@tanstack/react-query';
import { chatApi } from '@/lib/api/chat';
import type { ListConversationsParams } from '@/types/chat';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * Conversations query policy — copies the `v2/features/cases/queries.ts`
 * exemplar exactly: a hierarchical key factory whose leaves are `queryOptions()`
 * objects, wrapping the shared `lib/api/chat.ts` fetcher unchanged (the same data
 * layer v1 uses). Only this query-policy wrapper is new.
 *
 * Structure convention (mirrored from the exemplar):
 *  - `all`       the feature root key segment (a value, not a function).
 *  - `lists()`   the "all lists" invalidation handle for every list variant.
 *  - `list(p)`   a concrete list query (leaf → `queryOptions`).
 *  - `recents()` the shell/home "recents" list — delegates to `list()` with the
 *                fixed params below, so the sidebar, drawer, and Design B panel
 *                all resolve to ONE cache entry (identical key) and never refetch
 *                three times for the same data.
 *
 * `enabled` is intentionally NOT baked into the leaves — it's a call-site concern
 * (`useQuery({ ...conversationsQueries.recents(), enabled: signedIn })`), the same
 * policy the exemplar documents (a leaf must stay legal for `useSuspenseQuery`).
 */

/**
 * The recents params — newest active conversations first, capped at ten. A module
 * constant so every `recents()` caller produces a structurally-identical query
 * key and shares the single cache entry.
 */
const RECENTS_PARAMS: ListConversationsParams = {
  per_page: 10,
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

  /** The read-only Recents list shared by the sidebar, drawer, and Design B. */
  recents: () => conversationsQueries.list(RECENTS_PARAMS),
};
