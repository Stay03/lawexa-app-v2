import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import type {
  Notification,
  NotificationListResponse,
  UnreadCountResponse,
} from '@/types/notification';
import { notificationsQueries, type NotificationReadFilter } from './queries';

/**
 * Notification CACHE WRITERS — every optimistic change the bell and the inbox
 * make to cached rows, as pure functions over one cached stream, plus the
 * `QueryClient` appliers that run them across EVERY cached stream at once.
 *
 * ── WHY EVERY STREAM, AND WHY EACH ONE READS ITS OWN KEY ──────────────────
 * The bell and the page share the All stream, and the page adds an Unread
 * stream. A press on either surface has to land on both, or the bell keeps a
 * gold dot on a row the page has already settled. So each applier walks every
 * entry under `notificationsQueries.lists()` with `getQueriesData` and writes it
 * with `setQueryData` (the `invitations/mutations.ts` pattern). What a write
 * MEANS differs per entry, and the entry says which it is through the `{ read }`
 * segment of its own key ({@link listFilterOf}): a row marked read is restyled
 * in place in the All stream and LEAVES the Unread stream. A Read stream (the
 * API supports one; no tab shows it today) is left for its refetch to fill,
 * because only the server knows where a newly read row sorts in it.
 *
 * ── ROW-SCOPED ROLLBACK, NEVER A SNAPSHOT RESTORE ─────────────────────────
 * Every single-row write returns what it changed, and its rollback undoes
 * exactly that: it un-stamps the one row, or puts the one row back at its old
 * position. Restoring a whole snapshot would resurrect a sibling row that a
 * concurrent delete had already taken out, or un-read a sibling a concurrent
 * press had just read (the `bookmarks/list-cache.ts` lesson). Mark-all is the
 * one exception, documented on {@link applyStampAllRead}.
 *
 * ── A WRITE THAT CHANGES NOTHING RETURNS THE SAME OBJECT ──────────────────
 * TanStack treats a new reference as new data and re-renders every observer.
 * So a stream that does not hold the row, or holds it already read, is handed
 * back untouched, and the applier skips the write entirely.
 *
 * Pure apart from the appliers, and importable from `node:test` (no React).
 */

export type NotificationPages = InfiniteData<NotificationListResponse>;

/* ── Reading a stream ─────────────────────────────────────────────────────── */

/**
 * The read filter a cached stream was fetched with, read back off its key
 * (`['notifications', 'list', 'infinite', { read }]`). `null` is the All
 * stream, and anything unrecognised is treated as All: restyling in place is
 * the write that can never hide a row.
 */
export function listFilterOf(queryKey: QueryKey): NotificationReadFilter | null {
  const segment = queryKey[3];
  if (typeof segment !== 'object' || segment === null) return null;
  const read = (segment as { read?: unknown }).read;
  return read === 'unread' || read === 'read' ? read : null;
}

/**
 * Flatten the loaded pages, dropping any row already seen.
 *
 * Offset pagination over a LIVE inbox repeats itself: a notification that
 * arrives between "page 1" and "page 2" pushes the boundary row down into the
 * next page, which would then render twice under the same React key. The first
 * copy wins, so the newest page's version of a row is the one kept.
 */
export function flattenUnique(
  pages: readonly NotificationListResponse[] | undefined,
): Notification[] {
  const seen = new Set<string>();
  const unique: Notification[] = [];
  for (const page of pages ?? []) {
    for (const row of page.data) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      unique.push(row);
    }
  }
  return unique;
}

/** `pagination.total` moved by `delta`, never below zero. */
function withTotal(
  page: NotificationListResponse,
  delta: number,
): NotificationListResponse {
  return {
    ...page,
    pagination: {
      ...page.pagination,
      total: Math.max(0, page.pagination.total + delta),
    },
  };
}

/* ── Remove and reinsert ──────────────────────────────────────────────────── */

/** One removed row, with everything needed to put it back where it was. */
export interface RemovedRow {
  pageIndex: number;
  index: number;
  row: Notification;
}

/**
 * Take the row out of the stream, wherever it is. Every page carries the same
 * `total`, so every page's total drops, keeping the stream's own count
 * consistent with its rows.
 */
export function removeRow(
  data: NotificationPages,
  id: string,
): { next: NotificationPages; removed: RemovedRow | null } {
  for (let pageIndex = 0; pageIndex < data.pages.length; pageIndex += 1) {
    const rows = data.pages[pageIndex].data;
    const index = rows.findIndex((row) => row.id === id);
    if (index === -1) continue;
    return {
      next: {
        ...data,
        pages: data.pages.map((page, current) =>
          current === pageIndex
            ? { ...withTotal(page, -1), data: rows.filter((row) => row.id !== id) }
            : withTotal(page, -1),
        ),
      },
      removed: { pageIndex, index, row: rows[index] },
    };
  }
  return { next: data, removed: null };
}

/**
 * Put a removed row back at its old position. A row that is already back (a
 * refetch brought it) is left alone, and so is a stream that no longer has the
 * page it came from: the refetch that shrank it is the authority on that page.
 */
export function reinsertRow(
  data: NotificationPages,
  removed: RemovedRow,
): NotificationPages {
  const present = data.pages.some((page) =>
    page.data.some((row) => row.id === removed.row.id),
  );
  if (present || removed.pageIndex >= data.pages.length) return data;
  return {
    ...data,
    pages: data.pages.map((page, current) => {
      if (current !== removed.pageIndex) return withTotal(page, 1);
      const index = Math.min(removed.index, page.data.length);
      return {
        ...withTotal(page, 1),
        data: [...page.data.slice(0, index), removed.row, ...page.data.slice(index)],
      };
    }),
  };
}

/* ── Mark one read ────────────────────────────────────────────────────────── */

/** What one mark-read did to one stream, so its rollback can undo exactly it. */
export type ReadUndo =
  | { kind: 'unstamp'; id: string; readAt: string }
  | { kind: 'reinsert'; removed: RemovedRow };

/**
 * Mark one row read in one stream. All: stamp `read_at` on the row if it is
 * unread. Unread: the row leaves. Read: untouched.
 */
export function stampRead(
  data: NotificationPages,
  id: string,
  readAt: string,
  filter: NotificationReadFilter | null,
): { next: NotificationPages; undo: ReadUndo | null } {
  if (filter === 'read') return { next: data, undo: null };

  if (filter === 'unread') {
    const { next, removed } = removeRow(data, id);
    return { next, undo: removed ? { kind: 'reinsert', removed } : null };
  }

  let stamped = false;
  const pages = data.pages.map((page) => {
    const index = page.data.findIndex((row) => row.id === id && row.read_at === null);
    if (index === -1) return page;
    stamped = true;
    return {
      ...page,
      data: page.data.map((row, current) =>
        current === index ? { ...row, read_at: readAt } : row,
      ),
    };
  });
  if (!stamped) return { next: data, undo: null };
  return { next: { ...data, pages }, undo: { kind: 'unstamp', id, readAt } };
}

/**
 * Undo one {@link stampRead}. An un-stamp clears only OUR stamp: a row whose
 * `read_at` has since changed (a refetch brought the server's own) is left as
 * the server says.
 */
export function revertRead(data: NotificationPages, undo: ReadUndo): NotificationPages {
  if (undo.kind === 'reinsert') return reinsertRow(data, undo.removed);
  return unstamp(data, (row) => row.id === undo.id && row.read_at === undo.readAt);
}

/** Clear `read_at` on every row `matches` picks; the same object when none. */
function unstamp(
  data: NotificationPages,
  matches: (row: Notification) => boolean,
): NotificationPages {
  let changed = false;
  const pages = data.pages.map((page) => {
    if (!page.data.some(matches)) return page;
    changed = true;
    return {
      ...page,
      data: page.data.map((row) => (matches(row) ? { ...row, read_at: null } : row)),
    };
  });
  return changed ? { ...data, pages } : data;
}

/* ── Mark all read ────────────────────────────────────────────────────────── */

/**
 * Mark every row read in one stream. All: stamp every unread row. Unread: the
 * stream empties to ONE empty first page whose pagination says it is the last,
 * so the sentinel cannot ask the server for a page 2 of nothing. Read:
 * untouched.
 */
export function stampAllRead(
  data: NotificationPages,
  readAt: string,
  filter: NotificationReadFilter | null,
): NotificationPages {
  if (filter === 'read') return data;

  if (filter === 'unread') {
    const [first] = data.pages;
    if (!first || data.pages.every((page) => page.data.length === 0)) return data;
    return {
      pages: [
        {
          ...first,
          data: [],
          pagination: {
            ...first.pagination,
            current_page: 1,
            last_page: 1,
            total: 0,
            from: null,
            to: null,
          },
        },
      ],
      pageParams: data.pageParams.slice(0, 1),
    };
  }

  let changed = false;
  const pages = data.pages.map((page) => {
    if (!page.data.some((row) => row.read_at === null)) return page;
    changed = true;
    return {
      ...page,
      data: page.data.map((row) => (row.read_at === null ? { ...row, read_at: readAt } : row)),
    };
  });
  return changed ? { ...data, pages } : data;
}

/** Undo {@link stampAllRead} on an All stream: clear exactly our stamp. */
export function unstampAllRead(data: NotificationPages, readAt: string): NotificationPages {
  return unstamp(data, (row) => row.read_at === readAt);
}

/* ── The count ────────────────────────────────────────────────────────────── */

/** The badge count moved by `delta`, clamped at zero. */
export function adjustUnreadCount(
  previous: UnreadCountResponse | undefined,
  delta: number,
): UnreadCountResponse | undefined {
  if (!previous) return previous;
  return {
    ...previous,
    data: { unread_count: Math.max(0, previous.data.unread_count + delta) },
  };
}

export function zeroUnreadCount(
  previous: UnreadCountResponse | undefined,
): UnreadCountResponse | undefined {
  if (!previous || previous.data.unread_count === 0) return previous;
  return { ...previous, data: { unread_count: 0 } };
}

/* ── The appliers ─────────────────────────────────────────────────────────── */

function cachedStreams(queryClient: QueryClient) {
  return queryClient.getQueriesData<NotificationPages>({
    queryKey: notificationsQueries.lists(),
  });
}

/**
 * Was this row UNREAD anywhere we hold it? Decides whether a mark-read or a
 * delete lowers the badge. A row we hold nowhere does not move the count: the
 * count is the server's, and the next read of it settles it.
 */
export function wasUnreadInAnyList(queryClient: QueryClient, id: string): boolean {
  return cachedStreams(queryClient).some(([queryKey, data]) => {
    if (!data) return false;
    const filter = listFilterOf(queryKey);
    if (filter === 'read') return false;
    return data.pages.some((page) =>
      page.data.some((row) => row.id === id && (filter === 'unread' || row.read_at === null)),
    );
  });
}

/** One stream's part of a mark-read, for its rollback. */
export interface StreamReadUndo {
  queryKey: QueryKey;
  undo: ReadUndo;
}

export function applyStampRead(
  queryClient: QueryClient,
  id: string,
  readAt: string,
): StreamReadUndo[] {
  const undos: StreamReadUndo[] = [];
  for (const [queryKey, data] of cachedStreams(queryClient)) {
    if (!data) continue;
    const { next, undo } = stampRead(data, id, readAt, listFilterOf(queryKey));
    if (!undo) continue;
    queryClient.setQueryData<NotificationPages>(queryKey, next);
    undos.push({ queryKey, undo });
  }
  return undos;
}

export function applyRevertRead(
  queryClient: QueryClient,
  undos: readonly StreamReadUndo[],
): void {
  for (const { queryKey, undo } of undos) {
    queryClient.setQueryData<NotificationPages>(queryKey, (data) =>
      data ? revertRead(data, undo) : data,
    );
  }
}

/** One stream's part of a delete, for its rollback. */
export interface StreamRemoval {
  queryKey: QueryKey;
  removed: RemovedRow;
}

export function applyRemoveRow(queryClient: QueryClient, id: string): StreamRemoval[] {
  const removals: StreamRemoval[] = [];
  for (const [queryKey, data] of cachedStreams(queryClient)) {
    if (!data) continue;
    const { next, removed } = removeRow(data, id);
    if (!removed) continue;
    queryClient.setQueryData<NotificationPages>(queryKey, next);
    removals.push({ queryKey, removed });
  }
  return removals;
}

export function applyReinsertRow(
  queryClient: QueryClient,
  removals: readonly StreamRemoval[],
): void {
  for (const { queryKey, removed } of removals) {
    queryClient.setQueryData<NotificationPages>(queryKey, (data) =>
      data ? reinsertRow(data, removed) : data,
    );
  }
}

/** An emptied Unread stream as it was, for a failed mark-all. */
export interface StreamSnapshot {
  queryKey: QueryKey;
  data: NotificationPages;
}

/**
 * Mark every row read in every stream. Returns the Unread streams as they were
 * before they were emptied.
 *
 * THE ONE SNAPSHOT RESTORE, and why it is safe here: an emptied stream has no
 * rows left for a concurrent write to touch, so putting the old rows back can
 * only undo this write. The rows a concurrent delete took out in the meantime
 * stay hidden by `useHiddenNotificationIds`, and the failure path refetches
 * every stream regardless, so the server settles anything this guessed at.
 */
export function applyStampAllRead(
  queryClient: QueryClient,
  readAt: string,
): StreamSnapshot[] {
  const snapshots: StreamSnapshot[] = [];
  for (const [queryKey, data] of cachedStreams(queryClient)) {
    if (!data) continue;
    const filter = listFilterOf(queryKey);
    const next = stampAllRead(data, readAt, filter);
    if (next === data) continue;
    if (filter === 'unread') snapshots.push({ queryKey, data });
    queryClient.setQueryData<NotificationPages>(queryKey, next);
  }
  return snapshots;
}

export function applyRevertAllRead(
  queryClient: QueryClient,
  readAt: string,
  snapshots: readonly StreamSnapshot[],
): void {
  for (const [queryKey, data] of cachedStreams(queryClient)) {
    if (!data || listFilterOf(queryKey) !== null) continue;
    const next = unstampAllRead(data, readAt);
    if (next !== data) queryClient.setQueryData<NotificationPages>(queryKey, next);
  }
  for (const { queryKey, data } of snapshots) {
    queryClient.setQueryData<NotificationPages>(queryKey, data);
  }
}
