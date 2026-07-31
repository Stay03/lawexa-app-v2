'use client';

import { useEffect, useRef } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { RadarScanListParams } from '@/types/radar';
import { useV2Session } from '@/v2/runtime/session-context';
import {
  IN_FLIGHT_SCAN_STATUSES,
  SCAN_LIST_POLL_MS,
  radarsQueries,
  scanListPollInterval,
} from './queries';

/**
 * useRadarScans — one workflow tab's scan list, with the two behaviours the
 * bare leaf cannot carry (both ported from v1's proven implementation):
 *
 *  1. FIRST-SCAN BRIDGE. A dispatched first scan's queued row takes up to
 *     ~60s to land in the list. `awaitingFirstScan` (a fact only the create
 *     flow knows, read via `useFirstScanDispatched`) keeps the empty list
 *     polling across that gap; the leaf's own data-driven poll takes over the
 *     moment the row appears.
 *
 *  2. COMPLETION FAN-OUT. When a previously in-flight scan reaches a terminal
 *     state — observed here, on whatever tab is polling — the radar detail and
 *     the radar lists are invalidated once, so unread counts and the last/next
 *     scan lines refresh without their own polls. Leaving the page mid-scan
 *     invalidates on unmount instead, so the completion signal is never lost.
 *
 * The tracking effect only calls `invalidateQueries` (an external-store write,
 * no `setState`), so it is legal under the React Compiler lint.
 */

interface UseRadarScansOptions {
  /** Keep polling while the list has no in-flight rows yet — covers the ~60s
   *  window between dispatching a first scan and its queued row landing. */
  awaitingFirstScan?: boolean;
  enabled?: boolean;
}

export function useRadarScans(
  radarUuid: string,
  params: Omit<RadarScanListParams, 'page' | 'per_page'> = {},
  options: UseRadarScansOptions = {},
) {
  const { signedIn, userId: viewerId, role } = useV2Session();
  const queryClient = useQueryClient();
  const { awaitingFirstScan = false, enabled = true } = options;
  const authEnabled = signedIn && role !== 'guest';

  const query = useInfiniteQuery({
    ...radarsQueries.infiniteScans(radarUuid, { ...params, viewerId }),
    enabled: authEnabled && enabled && !!radarUuid,
    refetchInterval: (activeQuery) =>
      scanListPollInterval(activeQuery) ||
      (awaitingFirstScan ? SCAN_LIST_POLL_MS : false),
  });

  const trackedRef = useRef<{ key: string; inFlight: ReadonlySet<string> }>({
    key: '',
    inFlight: new Set(),
  });
  const { data } = query;
  const trackingKey = `${radarUuid}|${JSON.stringify(params)}`;

  useEffect(() => {
    if (!data) return;

    const scans = data.pages.flatMap((page) => page.data);
    const nowInFlight = new Set(
      scans
        .filter((scan) => IN_FLIGHT_SCAN_STATUSES.has(scan.status))
        .map((scan) => scan.uuid),
    );

    // A key change (e.g. switching workflow tabs) means previously tracked
    // in-flight scans can no longer be observed here — refresh the radar data
    // once instead of silently dropping them.
    if (trackedRef.current.key !== trackingKey) {
      const lostInFlight = trackedRef.current.inFlight.size > 0;
      trackedRef.current = { key: trackingKey, inFlight: nowInFlight };
      if (lostInFlight) {
        queryClient.invalidateQueries({
          queryKey: [...radarsQueries.details(), radarUuid],
        });
        queryClient.invalidateQueries({ queryKey: radarsQueries.lists() });
      }
      return;
    }

    const someScanFinished = [...trackedRef.current.inFlight].some((uuid) => {
      const scan = scans.find((candidate) => candidate.uuid === uuid);
      return scan !== undefined && !IN_FLIGHT_SCAN_STATUSES.has(scan.status);
    });
    trackedRef.current = { key: trackingKey, inFlight: nowInFlight };

    if (someScanFinished) {
      queryClient.invalidateQueries({
        queryKey: [...radarsQueries.details(), radarUuid],
      });
      queryClient.invalidateQueries({ queryKey: radarsQueries.lists() });
    }
  }, [data, trackingKey, queryClient, radarUuid]);

  // Leaving the page mid-scan would otherwise lose the completion signal —
  // mark the radar data stale so the next mount refetches it. The ref is read
  // inside the cleanup on purpose: it must see the state at unmount, not at
  // effect setup.
  useEffect(() => {
    return () => {
      if (trackedRef.current.inFlight.size > 0) {
        queryClient.invalidateQueries({
          queryKey: [...radarsQueries.details(), radarUuid],
        });
        queryClient.invalidateQueries({ queryKey: radarsQueries.lists() });
      }
    };
  }, [queryClient, radarUuid]);

  return query;
}
