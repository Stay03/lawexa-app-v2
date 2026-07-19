import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { ConversationListItem, ConversationsListResponse } from '@/types/chat';
import { conversationsQueries } from './queries';

/**
 * conversations cache — the ONE shape-aware writer over every cached conversations
 * list (wave-4 "kill the chat↔sidebar staleness" work).
 *
 * WHY THIS EXISTS. `conversationsQueries.lists()` names TWO cache shapes that both
 * hold `ConversationListItem` rows:
 *   - the flat {@link ConversationsListResponse} (`recents()` peek — Work/Study home
 *     strips), and
 *   - the paginated `InfiniteData<ConversationsListResponse>` (`infiniteRecents()` —
 *     the sidebar rail + mobile drawer).
 * A direct cache write (send bumps a row, create inserts one, delete removes one, a
 * title upgrade patches one) must handle BOTH shapes identically. Before this module
 * that shape discrimination lived inline in `deleteConfidential`; every writer now
 * routes through here so the shape logic exists exactly ONCE.
 *
 * EVERY writer is REFERENTIALLY STABLE on a no-op: when an operation changes nothing
 * (id absent, title already equal) the updater returns the exact input reference.
 * THE REAL INVARIANT (review F1 — be precise): TanStack does NOT skip the write on a
 * same-reference return — `setQueryData` still dispatches success and resets the
 * entry's `dataUpdatedAt`/staleTime clock. What suppresses the re-render is the
 * observer's TRACKED-PROPS optimization: consumers read `.data`/`.isPending`/etc. and
 * never `.dataUpdatedAt`, and since `data` is same-reference, no tracked prop changed.
 * ⇒ Recents consumers must not read `dataUpdatedAt` or set `notifyOnChangeProps:
 * 'all'`, or every fan-out write (each send/complete/create of ANY conversation)
 * re-renders them. This matters because `setQueriesData({ queryKey: lists() })` fans
 * out to EVERY list cache — most of which won't contain the target id on any write.
 *
 * PAGINATION-ENVELOPE SEMANTICS (honest by omission). The `pagination` block
 * (`total`/`from`/`to`/`current_page`/`last_page`) is a SERVER page snapshot. These
 * optimistic client writes never fabricate new totals or offsets — they touch ONLY
 * `data` / `pages[].data`. `getNextPageParam` reads `current_page`/`last_page`, which
 * are left untouched, so infinite pagination keeps working; nothing in the recents UI
 * reads `total`/`from`/`to`. Any transient `data.length` vs `total` drift is settled
 * by the caller's follow-up invalidation / natural refetch. This deliberately keeps
 * every write minimal and never invents server state.
 */

/** The two cached shapes stored under `conversationsQueries.lists()`. */
type ListCache =
  | ConversationsListResponse
  | InfiniteData<ConversationsListResponse>;

function isInfinite(
  cache: ListCache,
): cache is InfiniteData<ConversationsListResponse> {
  return 'pages' in cache;
}

/** Same id predicate the pre-refactor delete used (defensive `String()` — list ids
 *  are typed `string`, but this never trips on a stray numeric id at runtime). */
function sameId(row: ConversationListItem, id: string): boolean {
  return String(row.id) === id;
}

/**
 * Apply a rows→rows transform to the flat `data` array or to EACH infinite page,
 * preserving referential identity wherever the transform is a no-op. The transform
 * MUST return its exact input array when it changes nothing.
 */
function mapListCache(
  cache: ListCache,
  transform: (rows: ConversationListItem[]) => ConversationListItem[],
): ListCache {
  if (isInfinite(cache)) {
    let changed = false;
    const pages = cache.pages.map((page) => {
      const next = transform(page.data);
      if (next === page.data) return page;
      changed = true;
      return { ...page, data: next };
    });
    return changed ? { ...cache, pages } : cache;
  }
  const next = transform(cache.data);
  return next === cache.data ? cache : { ...cache, data: next };
}

/** Filter an id out of a row array; returns the same array when the id is absent. */
function removeRows(rows: ConversationListItem[], id: string): ConversationListItem[] {
  const next = rows.filter((row) => !sameId(row, id));
  return next.length === rows.length ? rows : next;
}

/** Patch a row's title in place (no reorder); same array when nothing changes. */
function patchTitleRows(
  rows: ConversationListItem[],
  id: string,
  title: string,
): ConversationListItem[] {
  const index = rows.findIndex((row) => sameId(row, id));
  if (index === -1 || rows[index].title === title) return rows;
  const next = rows.slice();
  next[index] = { ...rows[index], title };
  return next;
}

/** Pull a row out of an array by id → `[without, found?]`; same array when absent. */
function extractRow(
  rows: ConversationListItem[],
  id: string,
): readonly [ConversationListItem[], ConversationListItem | undefined] {
  const index = rows.findIndex((row) => sameId(row, id));
  if (index === -1) return [rows, undefined] as const;
  const found = rows[index];
  return [[...rows.slice(0, index), ...rows.slice(index + 1)], found] as const;
}

/**
 * Move an existing row to the head of the FIRST page (infinite) / of `data` (flat)
 * with a fresh `updated_at` and an optional title patch — the "bump on activity"
 * write. No-op-stable: an absent id returns the input cache unchanged. A found row
 * always yields a new structure (the caller only bumps on a discrete send/complete
 * event, never in render), which both reorders it and refreshes the timestamp the
 * home's relative-time strip reads.
 */
function bumpInCache(
  cache: ListCache,
  id: string,
  patch: { title?: string },
): ListCache {
  const updated_at = new Date().toISOString();

  if (isInfinite(cache)) {
    if (cache.pages.length === 0) return cache;
    let found: ConversationListItem | undefined;
    const stripped = cache.pages.map((page) => {
      const [rows, hit] = extractRow(page.data, id);
      if (hit) found = hit;
      return rows === page.data ? page : { ...page, data: rows };
    });
    if (!found) return cache;
    const bumped: ConversationListItem = {
      ...found,
      updated_at,
      ...(patch.title !== undefined && { title: patch.title }),
    };
    return {
      ...cache,
      pages: stripped.map((page, index) =>
        index === 0 ? { ...page, data: [bumped, ...page.data] } : page,
      ),
    };
  }

  const [rows, found] = extractRow(cache.data, id);
  if (!found) return cache;
  const bumped: ConversationListItem = {
    ...found,
    updated_at,
    ...(patch.title !== undefined && { title: patch.title }),
  };
  return { ...cache, data: [bumped, ...rows] };
}

/**
 * Insert a row at the head of the FIRST page (infinite) / of `data` (flat),
 * de-duplicating any existing entry with the same id first — the "create" write.
 * Always changes the cache (a create is a discrete event). An empty infinite cache
 * (no pages fetched) is left untouched so a partial entry never masks a real fetch.
 */
function upsertInCache(cache: ListCache, row: ConversationListItem): ListCache {
  const id = String(row.id);

  if (isInfinite(cache)) {
    if (cache.pages.length === 0) return cache;
    const stripped = cache.pages.map((page) => {
      const [rows] = extractRow(page.data, id);
      return rows === page.data ? page : { ...page, data: rows };
    });
    return {
      ...cache,
      pages: stripped.map((page, index) =>
        index === 0 ? { ...page, data: [row, ...page.data] } : page,
      ),
    };
  }

  const [rows] = extractRow(cache.data, id);
  return { ...cache, data: [row, ...rows] };
}

/** Run a shape-aware transform across every cached conversations list. */
function writeEveryList(
  queryClient: QueryClient,
  transform: (cache: ListCache) => ListCache,
): void {
  queryClient.setQueriesData<ListCache>(
    { queryKey: conversationsQueries.lists() },
    (cache) => (cache ? transform(cache) : cache),
  );
}

export const conversationsCache = {
  /**
   * Remove a conversation from every cached list (device-owned confidential delete).
   * No-op-stable on lists that don't hold the id.
   */
  remove(queryClient: QueryClient, id: string): void {
    writeEveryList(queryClient, (cache) =>
      mapListCache(cache, (rows) => removeRows(rows, id)),
    );
  },

  /**
   * Bump a conversation to the top of every list with a fresh `updated_at` (a turn
   * was sent or completed). Optionally sets the title in the same write. No-op-stable
   * when the id isn't in a given list (e.g. a confidential stub the server omits, or
   * a conversation past the loaded pages — the natural refetch reconciles those).
   */
  touch(queryClient: QueryClient, id: string, patch: { title?: string } = {}): void {
    writeEveryList(queryClient, (cache) => bumpInCache(cache, id, patch));
  },

  /**
   * Patch a conversation's title in place WITHOUT reordering (the async AI-name
   * upgrade arriving on the open conversation). Position is owned by recency, not by
   * when the title resolved, so this never moves the row. No-op-stable when the title
   * already matches — so it stays idempotent across the title effect's re-runs.
   */
  patch(queryClient: QueryClient, id: string, fields: { title: string }): void {
    writeEveryList(queryClient, (cache) =>
      mapListCache(cache, (rows) => patchTitleRows(rows, id, fields.title)),
    );
  },

  /**
   * Insert a freshly-created conversation at the top of every list, de-duplicated by
   * id. See {@link makeOptimisticConversation} for the placeholder row the create
   * flow hands in.
   */
  upsert(queryClient: QueryClient, row: ConversationListItem): void {
    writeEveryList(queryClient, (cache) => upsertInCache(cache, row));
  },
};

/**
 * Build the transient placeholder row the create flow upserts before the server
 * echoes the real conversation. Only `id`, `title`, and `updated_at` are ever
 * rendered by a recents surface (the rail/drawer show `id` + `title`; the home strip
 * adds `updated_at`); the remaining structural fields are neutral fillers that the
 * create flow's follow-up invalidation replaces with server truth within a moment.
 * The title is the user's own first message — the single most honest thing to show
 * instantly — cleaned for display by each consumer's `stripPastedTags`.
 */
export function makeOptimisticConversation(id: string, title: string): ConversationListItem {
  const now = new Date().toISOString();
  return {
    id,
    user_id: 0,
    agent_id: 0,
    title,
    status: 'active',
    is_private: false,
    agent: { id: 0, name: '', slug: '', description: null },
    messages_count: 1,
    created_at: now,
    updated_at: now,
  };
}
