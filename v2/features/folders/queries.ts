import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { GC_TIMES, REFETCH_ON_VISIT, STALE_TIMES } from '@/v2/runtime/query';
import { foldersApi } from './api';

/**
 * Folders query factory — the `notesQueries` exemplar applied to folders.
 *
 * THE SHAPE OF THE TREE IS THE SHAPE OF THE KEYS. `my-folders` is root-only
 * unless `parent_id` names a folder, so a LEVEL is the unit of caching: the
 * root level and each opened folder's children are separate entries under
 * `lists()`, which is what lets a drill-down repaint instantly on the way back
 * up. Nothing here holds "the whole tree" — no such payload exists.
 *
 * `REFETCH_ON_VISIT` on the levels and the items, deliberately: a folder is
 * written to from OUTSIDE this screen (the Add-to-folder picker on a case, a
 * statute or a note page, on another tab or another device), which is exactly
 * the case `staleTime` alone cannot answer.
 */

/** The same required-not-optional viewer partition every v2 list key carries. */
export interface ViewerScoped {
  /** The server-verified viewer id (`V2SessionSnapshot.userId`), `null` if signed out. */
  viewerId: number | null;
}

/** One page size for every folder surface. */
export const FOLDERS_PAGE_SIZE = 20;

/** A 4xx is a settled answer, not a blip — read the status off the axios error. */
function retrySettledClientErrors(failureCount: number, error: unknown): boolean {
  const status = isAxiosError(error) ? (error.response?.status ?? 0) : 0;
  if (status >= 400 && status < 500) return false;
  return failureCount < 1;
}

export const foldersQueries = {
  all: ['folders'] as const,

  lists: () => [...foldersQueries.all, 'list'] as const,
  details: () => [...foldersQueries.all, 'detail'] as const,
  itemLists: () => [...foldersQueries.all, 'items'] as const,

  /**
   * ONE LEVEL of the viewer's tree: the root when `parentUuid` is null, or one
   * folder's children when it names one. Search applies within the level.
   */
  level: ({
    parentUuid = null,
    search,
    viewerId,
  }: {
    parentUuid?: string | null;
    /**
     * Matches at EVERY depth from the root (probed) and DIRECT CHILDREN ONLY
     * when `parentUuid` names a folder — so a root search is a whole-tree
     * finder and a drilled search is not. Paging is this factory's business,
     * not the caller's: accepting `page`/`per_page` here and leaving them out
     * of the key would let two different page sizes share one cache entry.
     */
    search?: string;
  } & ViewerScoped) =>
    infiniteQueryOptions({
      queryKey: [
        ...foldersQueries.lists(),
        { parentUuid, search: search ?? null },
        { viewerId },
      ] as const,
      queryFn: ({ pageParam }) =>
        foldersApi.mine({
          search,
          parent_id: parentUuid ?? undefined,
          per_page: FOLDERS_PAGE_SIZE,
          page: pageParam,
        }),
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

  /**
   * One folder. The ONLY payload carrying `children` (unpaginated) and
   * `parent` (one level) — which is why a create/update response, which
   * carries neither, must never be written into this cache.
   */
  detail: ({ uuid, viewerId }: { uuid: string } & ViewerScoped) =>
    queryOptions({
      queryKey: [...foldersQueries.details(), uuid, { viewerId }] as const,
      queryFn: () => foldersApi.byUuid(uuid),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
      retry: retrySettledClientErrors,
    }),

  /** A folder's CONTENTS. Subfolders are not here — they ride on the detail. */
  items: ({
    uuid,
    type,
    viewerId,
  }: { uuid: string; type?: string } & ViewerScoped) =>
    infiniteQueryOptions({
      queryKey: [
        ...foldersQueries.itemLists(),
        uuid,
        { type: type ?? null },
        { viewerId },
      ] as const,
      queryFn: ({ pageParam }) =>
        foldersApi.items(uuid, { type, per_page: FOLDERS_PAGE_SIZE, page: pageParam }),
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
};
