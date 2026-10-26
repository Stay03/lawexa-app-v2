'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { spaceRadarsApi } from '@/lib/api/radars';
import type { CreateSpaceRadarPayload, RadarDetailResponse } from '@/types/radar';
import { markFirstScanDispatched, markRadarNamePending } from '@/v2/features/radars/naming';
import { radarsQueries } from '@/v2/features/radars/queries';
import { useV2Session } from '@/v2/runtime/session-context';
import { spacesQueries } from '../../queries';

/**
 * useCreateSpaceRadar — `useCreateRadar` for a Radar made in a space
 * (`POST /spaces/{uuid}/radars`, the personal create's body and answer). The
 * same cache seeding: the new Radar is written into its detail entry, a
 * nameless one gets the naming shimmer, and a dispatched first scan its
 * placeholder row. The space's Radars list re-reads; the personal list is
 * left alone, since a Space Radar never shows there.
 *
 * `silentError`: a refusal renders in the form, never as a toast.
 */
export function useCreateSpaceRadar(spaceUuid: string) {
  const queryClient = useQueryClient();
  const { userId: viewerId } = useV2Session();

  return useMutation({
    mutationFn: (payload: CreateSpaceRadarPayload) => spaceRadarsApi.create(spaceUuid, payload),
    meta: {
      silentError: true,
      invalidates: [spacesQueries.radarsOf(spaceUuid)],
    },
    onSuccess: (response, variables) => {
      const { radar, first_scan } = response.data;
      queryClient.setQueryData<RadarDetailResponse>(radarsQueries.detail(radar.uuid, { viewerId }).queryKey, {
        success: response.success,
        message: response.message,
        data: radar,
      });
      if (!variables.name) markRadarNamePending(queryClient, radar.uuid, radar.name);
      if (first_scan.dispatched) markFirstScanDispatched(queryClient, radar.uuid);
    },
  });
}
