'use client';

import { useEffect, useRef } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { notificationChannelsApi, radarsApi } from '@/lib/api/radars';
import { useAuthStore } from '@/lib/stores/authStore';
import type {
  RadarChannelType,
  RadarDetailResponse,
  RadarListParams,
  RadarListResponse,
  RadarScan,
  RadarScanDetailResponse,
  RadarScanListParams,
  RadarScanListResponse,
  RadarScanResponse,
  ScanStatus,
  TriageScanPayload,
  UpdateRadarPayload,
} from '@/types/radar';

// Query key factory
export const radarKeys = {
  all: ['radars'] as const,
  lists: () => [...radarKeys.all, 'list'] as const,
  list: (params: RadarListParams) => [...radarKeys.lists(), params] as const,
  details: () => [...radarKeys.all, 'detail'] as const,
  detail: (uuid: string) => [...radarKeys.details(), uuid] as const,
  scans: (radarUuid: string) => [...radarKeys.all, 'scans', radarUuid] as const,
  scanLists: (radarUuid: string) => [...radarKeys.scans(radarUuid), 'list'] as const,
  scanList: (radarUuid: string, params: RadarScanListParams) =>
    [...radarKeys.scanLists(radarUuid), params] as const,
  scanDetail: (radarUuid: string, scanUuid: string) =>
    [...radarKeys.scans(radarUuid), 'detail', scanUuid] as const,
  publicScan: (radarUuid: string, scanUuid: string) =>
    [...radarKeys.scans(radarUuid), 'public-detail', scanUuid] as const,
  firstScanDispatched: (radarUuid: string) =>
    [...radarKeys.all, 'first-scan-dispatched', radarUuid] as const,
  namePending: (radarUuid: string) =>
    [...radarKeys.all, 'name-pending', radarUuid] as const,
};

export const notificationChannelKeys = {
  all: ['notification-channels'] as const,
};

export const IN_FLIGHT_SCAN_STATUSES: ReadonlySet<ScanStatus> = new Set([
  'queued',
  'running',
]);

// Scans stay queued ≤60s, then run for 30s–3min — poll while one is in flight.
const SCAN_LIST_POLL_MS = 15_000;
const SCAN_DETAIL_POLL_MS = 10_000;

// After a nameless create the backend upgrades the instant placeholder name
// via a queue job — poll the detail briefly until the AI title lands.
const NAME_POLL_MS = 3_000;
const NAME_POLL_WINDOW_MS = 45_000;

/** Cache-only marker seeded at create time, read by useRadar's poll. */
interface PendingName {
  fallback: string;
  since: number;
}

function useIsRadarQueryEnabled(): boolean {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = useAuthStore((s) => s.isGuest);
  return isAuthenticated && !isGuest;
}

/**
 * Paginated radar list. Archived radars only appear under status=archived.
 */
export function useRadars(params: RadarListParams = {}) {
  const enabled = useIsRadarQueryEnabled();

  return useQuery({
    queryKey: radarKeys.list(params),
    queryFn: () => radarsApi.getList(params),
    enabled,
    staleTime: 30 * 1000,
  });
}

/**
 * Full radar detail (perimeter, channels, conversation_uuid).
 */
export function useRadar(uuid: string, options: { enabled?: boolean } = {}) {
  const authEnabled = useIsRadarQueryEnabled();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: radarKeys.detail(uuid),
    queryFn: () => radarsApi.getByUuid(uuid),
    enabled: authEnabled && !!uuid && (options.enabled ?? true),
    staleTime: 30 * 1000,
    // Poll only while a freshly created radar still shows its placeholder
    // name, until the async AI title replaces it (or the window elapses).
    refetchInterval: (query) => {
      const pending = queryClient.getQueryData<PendingName>(
        radarKeys.namePending(uuid)
      );
      if (!pending) return false;

      const currentName = query.state.data?.data.name;
      const upgraded = !!currentName && currentName !== pending.fallback;
      const expired = Date.now() - pending.since > NAME_POLL_WINDOW_MS;

      if (upgraded || expired) {
        queryClient.removeQueries({ queryKey: radarKeys.namePending(uuid) });
        // Reflect the new name wherever the radar is also listed.
        if (upgraded) {
          queryClient.invalidateQueries({ queryKey: radarKeys.lists() });
        }
        return false;
      }
      return NAME_POLL_MS;
    },
    refetchIntervalInBackground: false,
  });
}

interface UseRadarScansOptions {
  // Keep polling while the list has no in-flight rows yet — covers the
  // ~60s window between dispatching a first scan and its queued row landing.
  awaitingFirstScan?: boolean;
  enabled?: boolean;
}

/**
 * Infinite scan list for a radar. Polls automatically while any visible scan
 * is queued/running and stops once every scan is terminal; when a previously
 * in-flight scan finishes, the radar detail and list caches are invalidated
 * once so unread counts and last/next scan times refresh.
 */
export function useRadarScans(
  radarUuid: string,
  params: Omit<RadarScanListParams, 'page'> = {},
  options: UseRadarScansOptions = {}
) {
  const authEnabled = useIsRadarQueryEnabled();
  const queryClient = useQueryClient();
  const { awaitingFirstScan = false, enabled = true } = options;

  const query = useInfiniteQuery({
    queryKey: [...radarKeys.scanList(radarUuid, params), 'infinite'] as const,
    queryFn: ({ pageParam }) =>
      radarsApi.getScans(radarUuid, { ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      const { current_page, last_page } = lastPage.pagination;
      return current_page < last_page ? current_page + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: authEnabled && enabled && !!radarUuid,
    staleTime: 15 * 1000,
    refetchInterval: (activeQuery) => {
      const pages = activeQuery.state.data?.pages;
      const hasInFlight =
        pages?.some((page) =>
          page.data.some((scan) => IN_FLIGHT_SCAN_STATUSES.has(scan.status))
        ) ?? false;
      if (hasInFlight || awaitingFirstScan) return SCAN_LIST_POLL_MS;
      return false;
    },
    refetchIntervalInBackground: false,
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
        .map((scan) => scan.uuid)
    );

    // A key change (e.g. switching triage tabs) means previously tracked
    // in-flight scans can no longer be observed here — refresh the radar
    // data once instead of silently dropping them.
    if (trackedRef.current.key !== trackingKey) {
      const lostInFlight = trackedRef.current.inFlight.size > 0;
      trackedRef.current = { key: trackingKey, inFlight: nowInFlight };
      if (lostInFlight) {
        queryClient.invalidateQueries({ queryKey: radarKeys.detail(radarUuid) });
        queryClient.invalidateQueries({ queryKey: radarKeys.lists() });
      }
      return;
    }

    const someScanFinished = [...trackedRef.current.inFlight].some((uuid) => {
      const scan = scans.find((candidate) => candidate.uuid === uuid);
      return scan !== undefined && !IN_FLIGHT_SCAN_STATUSES.has(scan.status);
    });
    trackedRef.current = { key: trackingKey, inFlight: nowInFlight };

    if (someScanFinished) {
      queryClient.invalidateQueries({ queryKey: radarKeys.detail(radarUuid) });
      queryClient.invalidateQueries({ queryKey: radarKeys.lists() });
    }
  }, [data, trackingKey, queryClient, radarUuid]);

  // Leaving the page mid-scan would otherwise lose the completion signal —
  // mark the radar data stale so the next mount refetches it. The ref is
  // read inside the cleanup on purpose: it must see the state at unmount,
  // not at effect setup.
  useEffect(() => {
    return () => {
      if (trackedRef.current.inFlight.size > 0) {
        queryClient.invalidateQueries({ queryKey: radarKeys.detail(radarUuid) });
        queryClient.invalidateQueries({ queryKey: radarKeys.lists() });
      }
    };
  }, [queryClient, radarUuid]);

  return query;
}

/**
 * Scan detail (the report). Polls while the scan itself is still in flight.
 */
export function useRadarScan(radarUuid: string, scanUuid: string) {
  const enabled = useIsRadarQueryEnabled();

  return useQuery({
    queryKey: radarKeys.scanDetail(radarUuid, scanUuid),
    queryFn: () => radarsApi.getScan(radarUuid, scanUuid),
    enabled: enabled && !!radarUuid && !!scanUuid,
    staleTime: 30 * 1000,
    refetchInterval: (activeQuery) => {
      const status = activeQuery.state.data?.data.status;
      return status !== undefined && IN_FLIGHT_SCAN_STATUSES.has(status)
        ? SCAN_DETAIL_POLL_MS
        : false;
    },
    refetchIntervalInBackground: false,
  });
}

/**
 * Public (no-auth) read of a published scan — the trimmed reader shape served
 * to signed-in non-owners and logged-out/guest visitors. Gate `enabled` on a
 * ready guest token (see useGuestAuth).
 */
export function usePublicRadarScan(
  radarUuid: string,
  scanUuid: string,
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: radarKeys.publicScan(radarUuid, scanUuid),
    queryFn: () => radarsApi.getPublicScan(radarUuid, scanUuid),
    enabled: (options.enabled ?? true) && !!radarUuid && !!scanUuid,
    staleTime: 60 * 1000,
  });
}

export function useNotificationChannels() {
  const enabled = useIsRadarQueryEnabled();

  return useQuery({
    queryKey: notificationChannelKeys.all,
    queryFn: () => notificationChannelsApi.getList(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/******************************************************************************
                                Mutations
******************************************************************************/

function writeRadarDetail(queryClient: QueryClient, response: RadarDetailResponse) {
  queryClient.setQueryData(radarKeys.detail(response.data.uuid), response);
}

export function useCreateRadar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: radarsApi.create,
    onSuccess: (response, variables) => {
      const { radar, first_scan } = response.data;
      queryClient.setQueryData<RadarDetailResponse>(radarKeys.detail(radar.uuid), {
        success: response.success,
        message: response.message,
        data: radar,
      });
      // No name was sent → the backend gave us an instant fallback and will
      // upgrade it asynchronously. Mark it so useRadar polls until it lands.
      if (!variables.name) {
        queryClient.setQueryData<PendingName>(radarKeys.namePending(radar.uuid), {
          fallback: radar.name,
          since: Date.now(),
        });
      }
      if (first_scan.dispatched) {
        // Lets the inbox show "First scan running…" only when a scan was
        // actually dispatched (not when first_scan was off or blocked).
        queryClient.setQueryData(
          radarKeys.firstScanDispatched(radar.uuid),
          true
        );
      }
      queryClient.invalidateQueries({ queryKey: radarKeys.lists() });
    },
  });
}

/**
 * Whether this session dispatched an immediate first scan for the radar —
 * a cache-only flag seeded by useCreateRadar, never fetched.
 */
export function useFirstScanDispatched(radarUuid: string): boolean {
  const { data } = useQuery({
    queryKey: radarKeys.firstScanDispatched(radarUuid),
    queryFn: () => false,
    enabled: false,
  });
  return data ?? false;
}

export function useUpdateRadar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ uuid, payload }: { uuid: string; payload: UpdateRadarPayload }) =>
      radarsApi.update(uuid, payload),
    onSuccess: (response) => {
      writeRadarDetail(queryClient, response);
      queryClient.invalidateQueries({ queryKey: radarKeys.lists() });
    },
  });
}

/**
 * Scan report sharing — publish / unpublish / toggle visibility. On success we
 * refresh the scan detail (state + view count) and the inbox lists (the
 * "Shared" badge), mirroring the conversation-sharing hooks.
 */
function useScanVisibilityMutation(
  mutationFn: (vars: { radarUuid: string; scanUuid: string }) => Promise<RadarScanResponse>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (_data, { radarUuid, scanUuid }) => {
      queryClient.invalidateQueries({ queryKey: radarKeys.scanDetail(radarUuid, scanUuid) });
      queryClient.invalidateQueries({ queryKey: radarKeys.scanLists(radarUuid) });
    },
  });
}

export function usePublishScan() {
  return useScanVisibilityMutation(({ radarUuid, scanUuid }) =>
    radarsApi.publishScan(radarUuid, scanUuid)
  );
}

export function useUnpublishScan() {
  return useScanVisibilityMutation(({ radarUuid, scanUuid }) =>
    radarsApi.unpublishScan(radarUuid, scanUuid)
  );
}

export function useToggleScanVisibility() {
  return useScanVisibilityMutation(({ radarUuid, scanUuid }) =>
    radarsApi.toggleScanVisibility(radarUuid, scanUuid)
  );
}

export function usePauseRadar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (uuid: string) => radarsApi.pause(uuid),
    onSuccess: (response) => {
      writeRadarDetail(queryClient, response);
      queryClient.invalidateQueries({ queryKey: radarKeys.lists() });
    },
  });
}

export function useResumeRadar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (uuid: string) => radarsApi.resume(uuid),
    onSuccess: (response) => {
      writeRadarDetail(queryClient, response);
      queryClient.invalidateQueries({ queryKey: radarKeys.lists() });
    },
  });
}

/**
 * Manual "Scan now". The queued row lands in the scan list on invalidation,
 * which switches list polling on until the scan reaches a terminal state.
 */
export function useScanNow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (uuid: string) => radarsApi.scanNow(uuid),
    onSuccess: (_response, uuid) => {
      queryClient.invalidateQueries({ queryKey: radarKeys.scanLists(uuid) });
      queryClient.invalidateQueries({ queryKey: radarKeys.detail(uuid) });
    },
  });
}

export function useArchiveRadar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (uuid: string) => radarsApi.archive(uuid),
    onSuccess: (_response, uuid) => {
      queryClient.invalidateQueries({ queryKey: radarKeys.lists() });
      queryClient.removeQueries({ queryKey: radarKeys.detail(uuid) });
    },
  });
}

interface TriageScanVariables {
  radarUuid: string;
  scanUuid: string;
  payload: TriageScanPayload;
}

type Snapshot = { queryKey: readonly unknown[]; data: unknown };

function applyTriagePatch(scan: RadarScan, payload: TriageScanPayload): RadarScan {
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
  delta: number
): T {
  return {
    ...radar,
    unread_reports_count: Math.max(0, radar.unread_reports_count + delta),
  };
}

/**
 * Triage a scan (read / workflow status / priority) with full optimistic
 * updates: every cached scan list and the scan detail are patched instantly,
 * and when the read state flips, unread counts on the radar detail and the
 * radar lists are adjusted in place. Everything rolls back on error.
 */
export function useTriageScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ radarUuid, scanUuid, payload }: TriageScanVariables) =>
      radarsApi.triageScan(radarUuid, scanUuid, payload),

    onMutate: async ({ radarUuid, scanUuid, payload }) => {
      const snapshots: Snapshot[] = [];

      await queryClient.cancelQueries({ queryKey: radarKeys.scans(radarUuid) });
      await queryClient.cancelQueries({ queryKey: radarKeys.detail(radarUuid) });
      await queryClient.cancelQueries({ queryKey: radarKeys.lists() });

      // Establish the scan's pre-mutation read state to compute count deltas.
      let previousReadAt: string | null | undefined;

      const scanListQueries = queryClient.getQueriesData<
        InfiniteData<RadarScanListResponse>
      >({ queryKey: radarKeys.scanLists(radarUuid) });
      for (const [queryKey, data] of scanListQueries) {
        if (!data) continue;
        const target = data.pages
          .flatMap((page) => page.data)
          .find((scan) => scan.uuid === scanUuid);
        if (!target) continue;

        // First cache that contains the scan wins — null is a meaningful
        // "unread" value here, so only assign while still undefined.
        if (previousReadAt === undefined) previousReadAt = target.read_at;
        snapshots.push({ queryKey, data });
        queryClient.setQueryData<InfiniteData<RadarScanListResponse>>(queryKey, {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            data: page.data.map((scan) =>
              scan.uuid === scanUuid ? applyTriagePatch(scan, payload) : scan
            ),
          })),
        });
      }

      const scanDetailKey = radarKeys.scanDetail(radarUuid, scanUuid);
      const scanDetail =
        queryClient.getQueryData<RadarScanDetailResponse>(scanDetailKey);
      if (scanDetail) {
        if (previousReadAt === undefined) previousReadAt = scanDetail.data.read_at;
        snapshots.push({ queryKey: scanDetailKey, data: scanDetail });
        queryClient.setQueryData<RadarScanDetailResponse>(scanDetailKey, {
          ...scanDetail,
          data: {
            ...scanDetail.data,
            ...applyTriagePatch(scanDetail.data, payload),
          },
        });
      }

      // Only completed unread scans count toward unread_reports_count.
      const readFlipped =
        payload.read !== undefined &&
        previousReadAt !== undefined &&
        payload.read === (previousReadAt === null);
      const unreadDelta = readFlipped ? (payload.read ? -1 : 1) : 0;

      if (unreadDelta !== 0) {
        const detailKey = radarKeys.detail(radarUuid);
        const radarDetail = queryClient.getQueryData<RadarDetailResponse>(detailKey);
        if (radarDetail) {
          snapshots.push({ queryKey: detailKey, data: radarDetail });
          queryClient.setQueryData<RadarDetailResponse>(detailKey, {
            ...radarDetail,
            data: adjustUnreadCount(radarDetail.data, unreadDelta),
          });
        }

        const radarListQueries = queryClient.getQueriesData<RadarListResponse>({
          queryKey: radarKeys.lists(),
        });
        for (const [queryKey, data] of radarListQueries) {
          if (!data?.data?.some((radar) => radar.uuid === radarUuid)) continue;
          snapshots.push({ queryKey, data });
          queryClient.setQueryData<RadarListResponse>(queryKey, {
            ...data,
            data: data.data.map((radar) =>
              radar.uuid === radarUuid
                ? adjustUnreadCount(radar, unreadDelta)
                : radar
            ),
          });
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
      // The server is the source of truth for timestamps — replace the scan
      // in every cache with the returned record.
      const serverScan = response.data;

      const scanListQueries = queryClient.getQueriesData<
        InfiniteData<RadarScanListResponse>
      >({ queryKey: radarKeys.scanLists(radarUuid) });
      for (const [queryKey, data] of scanListQueries) {
        if (!data) continue;
        queryClient.setQueryData<InfiniteData<RadarScanListResponse>>(queryKey, {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            data: page.data.map((scan) =>
              scan.uuid === scanUuid ? serverScan : scan
            ),
          })),
        });
      }

      const scanDetailKey = radarKeys.scanDetail(radarUuid, scanUuid);
      const scanDetail =
        queryClient.getQueryData<RadarScanDetailResponse>(scanDetailKey);
      if (scanDetail) {
        queryClient.setQueryData<RadarScanDetailResponse>(scanDetailKey, {
          ...scanDetail,
          data: { ...scanDetail.data, ...serverScan },
        });
      }
    },
  });
}

export function useCreateNotificationChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (type: RadarChannelType) => notificationChannelsApi.create(type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationChannelKeys.all });
    },
  });
}

export function useDeleteNotificationChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (uuid: string) => notificationChannelsApi.remove(uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationChannelKeys.all });
    },
  });
}

/**
 * True when any scan in the cached list for this radar is queued or running —
 * used to disable "Scan now" and show the running indicator.
 */
export function hasInFlightScan(
  data: InfiniteData<RadarScanListResponse> | undefined
): boolean {
  return (
    data?.pages.some((page) =>
      page.data.some((scan) => IN_FLIGHT_SCAN_STATUSES.has(scan.status))
    ) ?? false
  );
}
