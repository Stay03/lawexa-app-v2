'use client';

import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { radarsApi } from '@/lib/api/radars';
import type {
  RadarDetailResponse,
  RadarListResponse,
  RadarScan,
  RadarScanDetailResponse,
  RadarScanListResponse,
  TriageScanPayload,
} from '@/types/radar';
import { radarsQueries } from './queries';

/**
 * useTriageScan — v1's optimistic triage engine (`lib/hooks/useRadars.ts`),
 * ported AS-IS onto the v2 query keys. The logic is deliberately unchanged —
 * it was the best code in the v1 feature — only the key factory and the error
 * channel are v2:
 *
 *  - every cached scan LIST for the radar is patched instantly (prefix match
 *    over `scanLists`, so every workflow tab's entry is reached);
 *  - the scan DETAIL is patched (prefix match over the detail segment, so the
 *    viewer-scoped key needs no plumbing here);
 *  - when the read state flips, unread counts on the radar detail and every
 *    radar list are adjusted in place;
 *  - everything snapshots in `onMutate` and rolls back in `onError`;
 *  - on success the SERVER's record replaces the optimistic one everywhere
 *    (the server owns timestamps).
 *
 * ERROR VOICE: no manual toast here — the global `MutationCache.onError`
 * (v2/runtime/query.ts) is the one error channel, and the rollback above means
 * the UI is already truthful by the time it fires.
 */

interface TriageScanVariables {
  radarUuid: string;
  scanUuid: string;
  payload: TriageScanPayload;
}

type Snapshot = { queryKey: readonly unknown[]; data: unknown };

function applyTriagePatch(
  scan: RadarScan,
  payload: TriageScanPayload,
): RadarScan {
  return {
    ...scan,
    read_at:
      payload.read === undefined
        ? scan.read_at
        : payload.read
          ? (scan.read_at ?? new Date().toISOString())
          : null,
    workflow_status: payload.workflow_status ?? scan.workflow_status,
    priority: payload.priority ?? scan.priority,
  };
}

function adjustUnreadCount<T extends { unread_reports_count: number }>(
  radar: T,
  delta: number,
): T {
  return {
    ...radar,
    unread_reports_count: Math.max(0, radar.unread_reports_count + delta),
  };
}

/** The scan-detail entries for one scan, whatever viewer segment they carry. */
function scanDetailPrefix(radarUuid: string, scanUuid: string) {
  return [...radarsQueries.scans(radarUuid), 'detail', scanUuid] as const;
}

/** The radar-detail entries for one radar, whatever viewer segment they carry. */
function radarDetailPrefix(radarUuid: string) {
  return [...radarsQueries.details(), radarUuid] as const;
}

function patchScanEverywhere(
  queryClient: QueryClient,
  radarUuid: string,
  scanUuid: string,
  patch: (scan: RadarScan) => RadarScan,
  snapshots?: Snapshot[],
): void {
  const scanListQueries = queryClient.getQueriesData<
    InfiniteData<RadarScanListResponse>
  >({ queryKey: radarsQueries.scanLists(radarUuid) });
  for (const [queryKey, data] of scanListQueries) {
    if (!data) continue;
    if (!data.pages.some((page) => page.data.some((s) => s.uuid === scanUuid))) {
      continue;
    }
    snapshots?.push({ queryKey, data });
    queryClient.setQueryData<InfiniteData<RadarScanListResponse>>(queryKey, {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        data: page.data.map((scan) =>
          scan.uuid === scanUuid ? patch(scan) : scan,
        ),
      })),
    });
  }

  const scanDetailQueries = queryClient.getQueriesData<RadarScanDetailResponse>(
    { queryKey: scanDetailPrefix(radarUuid, scanUuid) },
  );
  for (const [queryKey, detail] of scanDetailQueries) {
    if (!detail) continue;
    snapshots?.push({ queryKey, data: detail });
    queryClient.setQueryData<RadarScanDetailResponse>(queryKey, {
      ...detail,
      data: { ...detail.data, ...patch(detail.data) },
    });
  }
}

export function useTriageScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ radarUuid, scanUuid, payload }: TriageScanVariables) =>
      radarsApi.triageScan(radarUuid, scanUuid, payload),

    onMutate: async ({ radarUuid, scanUuid, payload }) => {
      const snapshots: Snapshot[] = [];

      await queryClient.cancelQueries({
        queryKey: radarsQueries.scans(radarUuid),
      });
      await queryClient.cancelQueries({
        queryKey: radarDetailPrefix(radarUuid),
      });
      await queryClient.cancelQueries({ queryKey: radarsQueries.lists() });

      // Establish the scan's pre-mutation read state to compute count deltas.
      // The first cache that holds the scan wins — null is a meaningful
      // "unread" value, so only assign while still undefined.
      let previousReadAt: string | null | undefined;
      const scanListQueries = queryClient.getQueriesData<
        InfiniteData<RadarScanListResponse>
      >({ queryKey: radarsQueries.scanLists(radarUuid) });
      for (const [, data] of scanListQueries) {
        if (previousReadAt !== undefined) break;
        const target = data?.pages
          .flatMap((page) => page.data)
          .find((scan) => scan.uuid === scanUuid);
        if (target) previousReadAt = target.read_at;
      }
      if (previousReadAt === undefined) {
        const [, detail] =
          queryClient.getQueriesData<RadarScanDetailResponse>({
            queryKey: scanDetailPrefix(radarUuid, scanUuid),
          })[0] ?? [];
        if (detail) previousReadAt = detail.data.read_at;
      }

      patchScanEverywhere(
        queryClient,
        radarUuid,
        scanUuid,
        (scan) => applyTriagePatch(scan, payload),
        snapshots,
      );

      // Only a genuine read-state flip moves the unread counters.
      const readFlipped =
        payload.read !== undefined &&
        previousReadAt !== undefined &&
        payload.read === (previousReadAt === null);
      const unreadDelta = readFlipped ? (payload.read ? -1 : 1) : 0;

      if (unreadDelta !== 0) {
        const radarDetailQueries =
          queryClient.getQueriesData<RadarDetailResponse>({
            queryKey: radarDetailPrefix(radarUuid),
          });
        for (const [queryKey, detail] of radarDetailQueries) {
          if (!detail) continue;
          snapshots.push({ queryKey, data: detail });
          queryClient.setQueryData<RadarDetailResponse>(queryKey, {
            ...detail,
            data: adjustUnreadCount(detail.data, unreadDelta),
          });
        }

        // Radar lists come in two shapes (single-page envelope + infinite);
        // patch whichever holds the radar.
        const radarListQueries = queryClient.getQueriesData<
          RadarListResponse | InfiniteData<RadarListResponse>
        >({ queryKey: radarsQueries.lists() });
        for (const [queryKey, data] of radarListQueries) {
          if (!data) continue;
          if ('pages' in data) {
            if (
              !data.pages.some((page) =>
                page.data.some((radar) => radar.uuid === radarUuid),
              )
            ) {
              continue;
            }
            snapshots.push({ queryKey, data });
            queryClient.setQueryData<InfiniteData<RadarListResponse>>(queryKey, {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                data: page.data.map((radar) =>
                  radar.uuid === radarUuid
                    ? adjustUnreadCount(radar, unreadDelta)
                    : radar,
                ),
              })),
            });
          } else {
            if (!data.data?.some((radar) => radar.uuid === radarUuid)) continue;
            snapshots.push({ queryKey, data });
            queryClient.setQueryData<RadarListResponse>(queryKey, {
              ...data,
              data: data.data.map((radar) =>
                radar.uuid === radarUuid
                  ? adjustUnreadCount(radar, unreadDelta)
                  : radar,
              ),
            });
          }
        }
      }

      return { snapshots };
    },

    onError: (_error, _variables, context) => {
      if (context?.snapshots) {
        for (const { queryKey, data } of context.snapshots) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },

    onSuccess: (response, { radarUuid, scanUuid }) => {
      // The server owns timestamps — its record replaces the optimistic one.
      const serverScan = response.data;
      patchScanEverywhere(queryClient, radarUuid, scanUuid, () => serverScan);
    },
  });
}
