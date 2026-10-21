import { queryOptions } from '@tanstack/react-query';
import { filesApi } from '@/lib/api/files';

/**
 * The v2 files query factory (standards §2, `cases/queries.ts` is the
 * exemplar). One leaf so far: the link a player plays from.
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
};
