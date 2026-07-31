'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { radarsApi } from '@/lib/api/radars';
import type { RadarDetailResponse } from '@/types/radar';
import { useV2Session } from '@/v2/runtime/session-context';
import { markFirstScanDispatched, markRadarNamePending } from '../naming';
import { radarsQueries } from '../queries';

/**
 * useCreateRadar — the create write plus the cache seeding the rest of the
 * feature runs on:
 *
 *  - the returned radar is written straight into the detail cache, so the
 *    post-create navigation paints the radar with zero fetches;
 *  - a NAMELESS create seeds the name-pending marker (`naming.ts`), which is
 *    what makes the detail show the "Naming this radar…" shimmer and poll for
 *    the AI title;
 *  - a DISPATCHED first scan seeds the first-scan flag, which keeps the empty
 *    inbox polling and shows the first-scan placeholder row until the queued
 *    row lands.
 *
 * `silentError` is set: create failures render IN THE FORM (field errors or
 * the in-page banner — the study's rule), never as a toast.
 */
export function useCreateRadar() {
  const queryClient = useQueryClient();
  const { userId: viewerId } = useV2Session();

  return useMutation({
    mutationFn: radarsApi.create,
    meta: {
      silentError: true,
      invalidates: [radarsQueries.lists()],
    },
    onSuccess: (response, variables) => {
      const { radar, first_scan } = response.data;
      queryClient.setQueryData<RadarDetailResponse>(
        radarsQueries.detail(radar.uuid, { viewerId }).queryKey,
        { success: response.success, message: response.message, data: radar },
      );
      // No name was sent → the backend gave an instant fallback and will
      // upgrade it asynchronously. Mark it so the detail polls + shimmers.
      if (!variables.name) {
        markRadarNamePending(queryClient, radar.uuid, radar.name);
      }
      if (first_scan.dispatched) {
        markFirstScanDispatched(queryClient, radar.uuid);
      }
    },
  });
}
