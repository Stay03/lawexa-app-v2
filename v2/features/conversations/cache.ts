import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { ConversationListItem, ConversationsListResponse } from '@/types/chat';
import type { SpaceConversationListResponse } from '@/types/collab';
import { spacesQueries } from '@/v2/features/spaces/queries';
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
function extractRow<T extends ConversationListItem>(
  rows: T[],
  id: string,
): readonly [T[], T | undefined] {
  const index = rows.findIndex((row) => sameId(row, id));
  if (index === -1) return [rows, undefined] as const;
  const found = rows[index];
  return [[...rows.slice(0, index), ...rows.slice(index + 1)], found] as const;
}

/**
 * A row as a new message leaves it: its `last_message_at` now (the order every
 * chat list sorts by, Stay's "the chat with the most recent message goes to the
 * top"), and the title when one comes with the write. `updated_at` is left
 * alone: it means "the chat itself changed" and orders nothing any more.
 */
function withNewMessage<T extends ConversationListItem>(row: T, at: string, title?: string): T {
  return { ...row, last_message_at: at, ...(title !== undefined && { title }) };
}

/** Move a row to the head of the first page of an infinite cache; the cache
 *  unchanged when no page holds it (or nothing is fetched yet). */
function bumpInPages<P extends { data: T[] }, T extends ConversationListItem>(
  cache: InfiniteData<P>,
  id: string,
  bump: (row: T) => T,
): InfiniteData<P> {
  if (cache.pages.length === 0) return cache;
  let found: T | undefined;
  const stripped = cache.pages.map((page) => {
    const [rows, hit] = extractRow(page.data, id);
    if (hit) found = hit;
    return rows === page.data ? page : { ...page, data: rows };
  });
  if (!found) return cache;
  const bumped = bump(found);
  return {
    ...cache,
    pages: stripped.map((page, index) =>
      index === 0 ? { ...page, data: [bumped, ...page.data] } : page,
    ),
  };
}

/**
 * Move an existing row to the head of the FIRST page (infinite) / of `data` (flat)
 * with a fresh `last_message_at` and an optional title patch — the "bump on a new
 * message" write. No-op-stable: an absent id returns the input cache unchanged. A
 * found row always yields a new structure (the caller only bumps on a discrete
 * message event, never in render), which reorders it and refreshes the time the
 * rows show.
 */
function bumpInCache(
  cache: ListCache,
  id: string,
  patch: { title?: string },
  at: string,
): ListCache {
  const bump = (row: ConversationListItem) => withNewMessage(row, at, patch.title);
  if (isInfinite(cache)) return bumpInPages(cache, id, bump);
  const [rows, found] = extractRow(cache.data, id);
  if (!found) return cache;
  return { ...cache, data: [bump(found), ...rows] };
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
   * A new message in a conversation (the reader's send, an answer completing, a
   * colleague's turn in a space chat): bump it to the top of every list with a
   * fresh `last_message_at`, and of its space's chats list when `spaceUuid` is
   * given (a bump only: the space list is never inserted into). Optionally sets
   * the title in the same write. No-op-stable when the id isn't in a given list
   * (a confidential stub the server omits, a chat past the loaded pages, a
   * colleague's chat not in the reader's own lists): the refetch, which sorts by
   * the same field, puts those in the same place.
   */
  touch(
    queryClient: QueryClient,
    id: string,
    patch: { title?: string; spaceUuid?: string | null } = {},
  ): void {
    const at = new Date().toISOString();
    writeEveryList(queryClient, (cache) => bumpInCache(cache, id, patch, at));
    if (patch.spaceUuid) {
      queryClient.setQueriesData<InfiniteData<SpaceConversationListResponse>>(
        { queryKey: [...spacesQueries.contentsOf(patch.spaceUuid), 'conversations'] },
        (cache) => (cache ? bumpInPages(cache, id, (row) => withNewMessage(row, at)) : cache),
      );
    }
  },

  /**
   * Patch a conversation's title in place WITHOUT reordering (a rename, the async
   * AI-name upgrade). Position is owned by the latest message, so this never moves
   * the row. No-op-stable when the title already matches — so it stays idempotent
   * across the title effect's re-runs.
   */
  patch(queryClient: QueryClient, id: string, fields: { title: string }): void {
    writeEveryList(queryClient, (cache) =>
      mapListCache(cache, (rows) => patchTitleRows(rows, id, fields.title)),
    );
  },

  /** A visibility change (share, make private) in place, WITHOUT reordering:
   *  it is not a message. No-op-stable when it already matches. */
  setVisibility(queryClient: QueryClient, id: string, isPrivate: boolean): void {
    writeEveryList(queryClient, (cache) =>
      mapListCache(cache, (rows) => {
        const index = rows.findIndex((row) => sameId(row, id));
        if (index === -1 || rows[index].is_private === isPrivate) return rows;
        const next = rows.slice();
        next[index] = { ...rows[index], is_private: isPrivate };
        return next;
      }),
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
    last_message_at: now,
  };
}
