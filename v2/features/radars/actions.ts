'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { RadarDetailResponse, UpdateRadarPayload } from '@/types/radar';
import { useV2Session } from '@/v2/runtime/session-context';
import { spacesQueries } from '@/v2/features/spaces/queries';
import { radarsQueries } from './queries';
import { radarCalls, type RadarScope } from './scope';
import { useRadarScope } from './scope-context';

/**
 * actions.ts — THE radar action layer. v1 implemented scan-now / pause /
 * resume / archive three times (list card, inbox header, settings sheet), each
 * with its own toast copy; every v2 surface calls these hooks instead, so the
 * behaviour and the voice exist exactly once.
 *
 * FEEDBACK POLICY (standards §2): success feedback is a single quiet toast per
 * action, written here; error feedback is the GLOBAL `MutationCache.onError`
 * channel, so no `try/catch`-and-toast appears at any call site. Pause /
 * resume write the server's returned radar straight into the detail cache
 * (whatever viewer segment holds it) and invalidate the lists via
 * `meta.invalidates` — the one invalidation channel.
 *
 * DELIBERATELY PLAIN, NOT OPTIMISTIC. A status flip is a rare, deliberate
 * action, and every surface that fires one shows a LIVE pending affordance
 * (button spinners; the row/header menus swap their trigger for a spinner
 * while a mutation is in flight) — so the honest one-round-trip wait is
 * visible rather than papered over with a guess that would need rollback.
 */

/**
 * WHERE THE CALL GOES (Radar in Spaces, 26 October 2026). Each hook reads the
 * Radar's scope from the screen (`scope-context`): a personal screen has none
 * and calls `/radars/...`; the space's Radar page calls `/spaces/{s}/radars/...`.
 * A space Radar's action also refreshes the space's Radars list.
 */
function spaceListKeys(scope: RadarScope) {
  return scope.kind === 'space' ? [spacesQueries.radarsOf(scope.spaceUuid)] : [];
}

/** Write the mutation's returned radar into every cached detail entry for it. */
function useWriteRadarDetail() {
  const queryClient = useQueryClient();
  const { userId: viewerId } = useV2Session();
  return (response: RadarDetailResponse) => {
    queryClient.setQueryData(
      radarsQueries.detail(response.data.uuid, { viewerId }).queryKey,
      response,
    );
  };
}

/**
 * Manual "Scan now". The queued row lands in the scan list on invalidation,
 * which switches the list's own polling on until the scan settles.
 */
export function useScanNow() {
  const queryClient = useQueryClient();
  const scope = useRadarScope();
  return useMutation({
    mutationFn: (uuid: string) => radarCalls(scope).scanNow(uuid),
    onSuccess: (_response, uuid) => {
      toast.success('Scan dispatched', {
        description: 'The report will land in the inbox shortly.',
      });
      void queryClient.invalidateQueries({
        queryKey: radarsQueries.scanLists(uuid),
      });
      void queryClient.invalidateQueries({
        queryKey: [...radarsQueries.details(), uuid],
      });
    },
  });
}

export function usePauseRadar() {
  const writeDetail = useWriteRadarDetail();
  const scope = useRadarScope();
  return useMutation({
    mutationFn: (uuid: string) => radarCalls(scope).pause(uuid),
    meta: { invalidates: [radarsQueries.lists(), ...spaceListKeys(scope)] },
    onSuccess: (response) => {
      writeDetail(response);
      toast.success('Radar paused', {
        description: 'Scans are stopped — nothing is billed while paused.',
      });
    },
  });
}

export function useResumeRadar() {
  const writeDetail = useWriteRadarDetail();
  const scope = useRadarScope();
  return useMutation({
    mutationFn: (uuid: string) => radarCalls(scope).resume(uuid),
    meta: { invalidates: [radarsQueries.lists(), ...spaceListKeys(scope)] },
    onSuccess: (response) => {
      writeDetail(response);
      toast.success('Radar resumed', {
        description: 'The schedule picks back up from here.',
      });
    },
  });
}

/**
 * Archive — permanent. The confirm lives in `ArchiveRadarDialog`; this only
 * performs the write. The detail and scan caches are REMOVED (not
 * invalidated): an archived radar's detail would 404 on refetch.
 */
export function useArchiveRadar() {
  const queryClient = useQueryClient();
  const scope = useRadarScope();
  return useMutation({
    mutationFn: (uuid: string) => radarCalls(scope).archive(uuid),
    onSuccess: (_response, uuid) => {
      void queryClient.invalidateQueries({ queryKey: radarsQueries.lists() });
      for (const queryKey of spaceListKeys(scope)) void queryClient.invalidateQueries({ queryKey });
      queryClient.removeQueries({
        queryKey: [...radarsQueries.details(), uuid],
      });
      queryClient.removeQueries({ queryKey: radarsQueries.scans(uuid) });
    },
  });
}

/** Settings-sheet save. The server's radar replaces the cached detail; lists
 *  refresh through the invalidation channel (the name may have changed). */
export function useUpdateRadar() {
  const writeDetail = useWriteRadarDetail();
  const scope = useRadarScope();
  return useMutation({
    mutationFn: ({
      uuid,
      payload,
    }: {
      uuid: string;
      payload: UpdateRadarPayload;
    }) => {
      // The space routes refuse `channels`: a space Radar's reports reach its members.
      if (scope.kind === 'space') {
        const spacePayload = { ...payload };
        delete spacePayload.channels;
        return radarCalls(scope).update(uuid, spacePayload);
      }
      return radarCalls(scope).update(uuid, payload);
    },
    meta: {
      invalidates: [radarsQueries.lists(), ...spaceListKeys(scope)],
      // The settings form renders 422 validation errors on its own fields —
      // a toast on top of an inline error would double-report it.
      silentError: true,
    },
    onSuccess: (response) => {
      writeDetail(response);
      toast.success('Radar updated');
    },
  });
}
