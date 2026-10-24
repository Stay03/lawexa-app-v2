import { queryOptions } from '@tanstack/react-query';
import { filesApi } from '@/lib/api/files';

/**
 * The v2 files query factory (standards §2, `cases/queries.ts` is the
 * exemplar): the link a player plays from, the link a picture shows from,
 * one file's facts, and a Word file's pages.
 */

/** A minted download link holds for an hour; a player reuses one for 50 minutes. */
export const MEDIA_URL_STALE_MS = 50 * 60 * 1000;

export const filesQueries = {
  all: ['files'] as const,

  /**
   * A fresh link for a file's bytes (`GET /files/{id}/download`, the same
   * gated route "Open file" uses), for a player's `src`. Minted when a player
   * first needs it and shared by every player of that file: a space file's
   * card and the player dialog read one entry (the card's own key since 20
   * October 2026). `retry: false` and no toast: a player that cannot get a
   * link says so where it stands.
   */
  downloadUrl: (fileId: number) =>
    queryOptions({
      queryKey: [...filesQueries.all, 'download-url', fileId] as const,
      queryFn: () => filesApi.getDownloadUrl(fileId),
      staleTime: MEDIA_URL_STALE_MS,
      retry: false,
      meta: { silentError: true },
    }),

  /**
   * A link that SHOWS the file (`?inline=1`), for a picture drawn in the
   * chat's side panel. Kept apart from `downloadUrl`, whose link downloads.
   */
  inlineUrl: (fileId: number) =>
    queryOptions({
      queryKey: [...filesQueries.all, 'inline-url', fileId] as const,
      queryFn: () => filesApi.getDownloadUrl(fileId, { inline: true }),
      staleTime: MEDIA_URL_STALE_MS,
      retry: false,
      meta: { silentError: true },
    }),

  /**
   * A Word or RTF file's pages (`GET /files/{id}/preview`), for the chat's
   * side panel. The server converts on the call and keeps the result a day,
   * so a fetched one is kept for the visit. `retry: false`: a refusal (422)
   * will not change on a second ask, and the panel offers Try again for the
   * failures that might.
   */
  preview: (fileId: number) =>
    queryOptions({
      queryKey: [...filesQueries.all, 'preview', fileId] as const,
      queryFn: () => filesApi.getPreview(fileId),
      staleTime: Infinity,
      retry: false,
      meta: { silentError: true },
    }),

  /**
   * One file's facts (`GET /files/{id}`): its name, type, size and uploader,
   * for a file opened by its id alone (`?side=file:ID`). The same `view`
   * policy as the download, so a file the reader cannot open answers 403 or
   * 404 and the host says so.
   */
  detail: (fileId: number) =>
    queryOptions({
      queryKey: [...filesQueries.all, 'detail', fileId] as const,
      queryFn: () => filesApi.getById(fileId),
      staleTime: 5 * 60 * 1000,
      retry: false,
      meta: { silentError: true },
    }),
};
