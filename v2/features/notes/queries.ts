import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { GC_TIMES, REFETCH_ON_VISIT, STALE_TIMES } from '@/v2/runtime/query';
import { notesApi, type NotesListParams } from './api';

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
      queryKey: [
        ...notesQueries.lists(),
        'mine',
        { search: params.search ?? null },
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
      queryKey: [...notesQueries.details(), 'slug', slug, { viewerId }] as const,
      queryFn: () => notesApi.bySlug(slug),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      retry: retrySettledClientErrors,
    }),

  /** The editor's note, by id (rename-proof). */
  byId: ({ id, viewerId }: { id: number } & ViewerScoped) =>
    queryOptions({
      queryKey: [...notesQueries.details(), 'id', id, { viewerId }] as const,
      queryFn: () => notesApi.byId(id),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      retry: retrySettledClientErrors,
    }),
};
