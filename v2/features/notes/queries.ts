import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { GC_TIMES, REFETCH_ON_VISIT, STALE_TIMES } from '@/v2/runtime/query';
import { notesApi, type NotesListParams } from './api';
import { noteFirstReadDelay, retryNoteFirstRead } from './first-read-retry';

/**
 * Notes query factory — the `bookmarksQueries` exemplar applied to notes: a
 * hierarchical key factory whose leaves are `queryOptions()` objects over the
 * v2 wire layer (`./api.ts`).
 *
 * Two detail leaves ON PURPOSE:
 *  - `detail({slug})` — the READER's fetch; slug is the public address.
 *  - `byId({id})`     — the EDITOR's fetch; ids survive renames, and the
 *    editor must never re-derive its subject from a URL that a rename could
 *    have invalidated in another tab.
 * They are separate cache entries. The editor's save mutations should write
 * the fresh envelope into BOTH (`setQueryData`) rather than invalidating, so
 * a save never repaints the editor from the network.
 */

/** Same required-not-optional viewer partition as every other v2 list key. */
export interface ViewerScoped {
  /** The server-verified viewer id (`V2SessionSnapshot.userId`), `null` if signed out. */
  viewerId: number | null;
}

/** One library page-size everywhere so tabs and search share the rhythm. */
export const NOTES_PAGE_SIZE = 20;

/**
 * Retry policy shared by the notes leaves: a 4xx is a settled answer, not a
 * blip. The status is read straight off the axios error — NOT through
 * `extractApiError`, which returns `status: 0` for a body-less response and
 * would send a settled 403/404 around the retry loop once more.
 */
function retrySettledClientErrors(failureCount: number, error: unknown): boolean {
  const status = isAxiosError(error) ? (error.response?.status ?? 0) : 0;
  if (status >= 400 && status < 500) return false;
  return failureCount < 1;
}

export const notesQueries = {
  all: ['notes'] as const,

  lists: () => [...notesQueries.all, 'list'] as const,
  details: () => [...notesQueries.all, 'detail'] as const,

  /**
   * The public library stream (free published notes only — enforced in the
   * wire layer, not per call site). Viewer-partitioned: `is_bookmarked` in
   * the payload varies by account.
   */
  library: ({ viewerId, ...params }: NotesListParams & ViewerScoped) =>
    infiniteQueryOptions({
      meta: { persist: 'list' },
      queryKey: [
        ...notesQueries.lists(),
        'library',
        { search: params.search ?? null },
        { viewerId },
      ] as const,
      queryFn: ({ pageParam }) =>
        notesApi.library({ ...params, per_page: NOTES_PAGE_SIZE, page: pageParam }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => {
        const { current_page, last_page } = lastPage.pagination;
        return current_page < last_page ? current_page + 1 : undefined;
      },
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      retry: retrySettledClientErrors,
    }),

  /**
   * The viewer's own notes (drafts included). `REFETCH_ON_VISIT` because this
   * is the user's OWN collection and the editor that writes to it is a
   * different screen (or a different device) — same argument as the bookmarks
   * page, and unlike the public library where nobody publishes from another tab.
   */
  mine: ({ viewerId, ...params }: NotesListParams & ViewerScoped) =>
    infiniteQueryOptions({
      meta: { persist: 'list' },
      queryKey: [
        ...notesQueries.lists(),
        'mine',
        { search: params.search ?? null, fromChats: params.from_chats ?? null },
        { viewerId },
      ] as const,
      queryFn: ({ pageParam }) =>
        notesApi.mine({ ...params, per_page: NOTES_PAGE_SIZE, page: pageParam }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => {
        const { current_page, last_page } = lastPage.pagination;
        return current_page < last_page ? current_page + 1 : undefined;
      },
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
      retry: retrySettledClientErrors,
    }),

  /** The reader's note, by public address. */
  detail: ({ slug, viewerId }: { slug: string } & ViewerScoped) =>
    queryOptions({
      meta: { persist: 'gated' },
      queryKey: [...notesQueries.details(), 'slug', slug, { viewerId }] as const,
      queryFn: () => notesApi.bySlug(slug),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      retry: retrySettledClientErrors,
    }),

  /** The editor's note, by id (rename-proof). */
  byId: ({ id, viewerId }: { id: number } & ViewerScoped) =>
    queryOptions({
      meta: { persist: 'gated' },
      queryKey: [...notesQueries.details(), 'id', id, { viewerId }] as const,
      queryFn: () => notesApi.byId(id),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      retry: retrySettledClientErrors,
    }),

  /**
   * The editor's OPEN read, by address: always the server, never the device.
   *
   * NO `meta.persist`, and its own key outside `details()`, on purpose. The
   * device persister answers a persisted leaf's fetch from IndexedDB when the
   * cache is empty (a fresh load), and that answer counts as "fetched after
   * mount"; so the editor opened on the kept copy, and the persister's own
   * server refetch was folded into the fetch already running (Tester Claude,
   * 19 October 2026, 20:51Z: 2 of 3 fresh loads opened an old copy). This
   * leaf is never kept, so its fetch is the server's answer. `gcTime: 0`: no
   * later open can start from this one's copy either.
   */
  editorOpen: ({ slug, viewerId }: { slug: string } & ViewerScoped) =>
    queryOptions({
      queryKey: [...notesQueries.all, 'editor-open', slug, { viewerId }] as const,
      queryFn: () => notesApi.bySlug(slug),
      staleTime: 0,
      gcTime: 0,
      retry: retrySettledClientErrors,
    }),

  /**
   * A chat's drafts as notes (`notesApi.draftNotes`). Always the server's
   * answer and never kept on the device, like `editorOpen`: the panel opens its
   * editor on the note this names, and a kept copy could be older than a save
   * made since. Refetched when an answer with a draft finishes, after a
   * restore, and every 2 s while a note catches up (draft-note-state.ts).
   */
  draftNotes: ({ conversationId, viewerId }: { conversationId: string } & ViewerScoped) =>
    queryOptions({
      queryKey: [...notesQueries.all, 'draft-notes', conversationId, { viewerId }] as const,
      queryFn: () => notesApi.draftNotes(conversationId),
      staleTime: 0,
      gcTime: GC_TIMES.list,
      // The note is made by a job just after the answer: a 404 or a dropped
      // request on the panel's first read is tried twice more (first-read-retry.ts).
      retry: retryNoteFirstRead,
      retryDelay: noteFirstReadDelay,
    }),

  /**
   * The draft panel's OPEN read of a draft's note, by id: always the server,
   * never the device, as `editorOpen` (the editor starts from it, and a kept
   * copy could be older than a save made since).
   */
  draftNoteOpen: ({ id, viewerId }: { id: number } & ViewerScoped) =>
    queryOptions({
      queryKey: [...notesQueries.all, 'draft-note-open', id, { viewerId }] as const,
      queryFn: () => notesApi.byId(id),
      staleTime: 0,
      gcTime: 0,
      // The editor opens on one read; coming back to the tab reads nothing again.
      refetchOnWindowFocus: false,
      retry: retryNoteFirstRead,
      retryDelay: noteFirstReadDelay,
    }),

  /** A draft note's saved versions, a page at a time, newest first. Never kept on the device. */
  revisions: ({ id, page }: { id: number; page: number }) =>
    queryOptions({
      queryKey: [...notesQueries.all, 'revisions', id, page] as const,
      queryFn: () => notesApi.revisions(id, page),
      staleTime: 0,
      retry: retrySettledClientErrors,
    }),

  /** One saved version with its text: it never changes, so it is read once. */
  revision: ({ id, revision }: { id: number; revision: number }) =>
    queryOptions({
      queryKey: [...notesQueries.all, 'revision', id, revision] as const,
      queryFn: () => notesApi.revision(id, revision),
      staleTime: Infinity,
      retry: retrySettledClientErrors,
    }),

  /**
   * Tags the server suggests at the publish step. Keyed on the saved version
   * (`updatedAt`): the sheet opens only while autosave is clean, so one open
   * of one version asks once, and reopening it unchanged reuses that answer.
   * No retry: a failure or a slow answer shows the empty tag box, as before.
   * Never kept on the device (no `meta.persist`).
   */
  suggestedTags: ({ id, slug, updatedAt }: { id: number; slug: string; updatedAt: string | null }) =>
    queryOptions({
      queryKey: [...notesQueries.all, 'suggested-tags', id, updatedAt] as const,
      queryFn: () => notesApi.suggestedTags(slug),
      staleTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
    }),
};
