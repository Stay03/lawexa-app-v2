import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { radarsApi } from '@/lib/api/radars';
import type {
  RadarListParams,
  RadarScanListParams,
  RadarScanListResponse,
  ScanStatus,
} from '@/types/radar';
import type { InfiniteData } from '@tanstack/react-query';
import { GC_TIMES, REFETCH_ON_VISIT, STALE_TIMES } from '@/v2/runtime/query';

/**
 * Radar query factory (the `cases` exemplar pattern) — the full v2 radar
 * surface: the saved-watch list, the per-radar detail, the scan lists behind
 * the workflow tabs, and both shapes of the scan report. Wraps the shared
 * `lib/api/radars.ts` fetchers unchanged; only this query-policy wrapper is new.
 *
 * ── VIEWER SCOPING ──────────────────────────────────────────────────────────
 * Radar data is entirely per-user (the endpoints 403 across owners), so every
 * authenticated leaf takes {@link ViewerScoped} and carries the viewer id in
 * its key — the same structural cross-account guarantee `casesQueries` and
 * `conversationsQueries` give, made a type error to forget rather than a
 * convention to remember. `publicScan` is the one deliberate exception: the
 * published-report endpoint is unauthenticated and answers identically for
 * every caller, so partitioning it would only cold-start the cache per viewer.
 *
 * ── POLLING IS DATA-DRIVEN AND LIVES IN THE LEAF ────────────────────────────
 * A scan stays queued ≤60s then runs for 30s–3min, so the scan list polls at
 * {@link SCAN_LIST_POLL_MS} while any visible row is in flight and the scan
 * detail polls at {@link SCAN_DETAIL_POLL_MS} while the scan itself is — the
 * v1-proven cadence, expressed as `refetchInterval` FUNCTIONS that read the
 * query's own data, so polling starts and stops with the data and no consumer
 * has to remember to switch it on. `refetchIntervalInBackground` stays `false`
 * (the TanStack default, declared for the record): polling pauses while the
 * tab is unfocused and resumes with the reader.
 *
 * The one polling concern that CANNOT live here is the async-naming poll —
 * it reads a cache-only marker through the QueryClient, which a leaf cannot
 * reach. That lives in `naming.ts`, layered over `detail` at the call site.
 *
 * ── `REFETCH_ON_VISIT` ON THE MOVING SURFACES ───────────────────────────────
 * Unlike the case library, radar data changes WITHOUT the user doing anything
 * in this tab: the backend runs scans on a schedule. So arriving at the list,
 * a radar, or a scan list is exactly the "what is new since I was last here?"
 * moment `REFETCH_ON_VISIT` exists for — the cached rows paint instantly and
 * the check lands behind them.
 */

/** Scan statuses that mean the agent is still working. */
export const IN_FLIGHT_SCAN_STATUSES: ReadonlySet<ScanStatus> = new Set([
  'queued',
  'running',
]);

/** v1's proven polling cadences — scans stay queued ≤60s, then run 30s–3min. */
export const SCAN_LIST_POLL_MS = 15_000;
export const SCAN_DETAIL_POLL_MS = 10_000;

/** Page size shared by every radar list surface. */
export const RADARS_PAGE_SIZE = 15;

/** The viewer partition — see the factory docblock. */
export interface ViewerScoped {
  viewerId: number | null;
}

/** True when any page of a scan list holds a queued/running row. */
export function hasInFlightScan(
  data: InfiniteData<RadarScanListResponse> | undefined,
): boolean {
  return (
    data?.pages.some((page) =>
      page.data.some((scan) => IN_FLIGHT_SCAN_STATUSES.has(scan.status)),
    ) ?? false
  );
}

/**
 * The scan LIST poll decision, exported so the detail screen's hook can extend
 * it (it also polls while a dispatched first scan's queued row has not landed
 * yet — a fact only the create flow knows, so it cannot live in the leaf).
 *
 * Typed STRUCTURALLY (just the state it reads) rather than as TanStack's
 * `Query<…>`: the class is invariant in its page-param generic, so a nominal
 * signature cannot serve both the leaf and the hook's extension without
 * re-stating the exact generics at every site.
 */
export function scanListPollInterval(query: {
  state: { data: InfiniteData<RadarScanListResponse, unknown> | undefined };
}): number | false {
  return hasInFlightScan(query.state.data) ? SCAN_LIST_POLL_MS : false;
}

export const radarsQueries = {
  all: ['radars'] as const,

  lists: () => [...radarsQueries.all, 'list'] as const,

  /**
   * One page of the radar list — the compact shape a home module would read.
   * Kept beside {@link radarsQueries.infiniteList} because the two shapes are
   * different cache entries by TanStack rule (an envelope vs `{ pages }`).
   */
  list: ({ viewerId, ...params }: RadarListParams & ViewerScoped) =>
    queryOptions({
      queryKey: [...radarsQueries.lists(), params, { viewerId }] as const,
      queryFn: () => radarsApi.getList(params),
      staleTime: STALE_TIMES.standard,
      // Home-glance retention: outlive TanStack's 5-minute default so a return
      // paints from cache instead of a skeleton.
      gcTime: GC_TIMES.list,
    }),

  /**
   * The `/radars` browse list, one status tab per entry. Scans complete
   * server-side while the user is elsewhere, so `REFETCH_ON_VISIT` keeps the
   * unread badges and last-scan lines honest on every arrival.
   */
  infiniteList: ({
    viewerId,
    ...params
  }: Omit<RadarListParams, 'page' | 'per_page'> & ViewerScoped) =>
    infiniteQueryOptions({
      queryKey: [
        ...radarsQueries.lists(),
        'infinite',
        params,
        { viewerId },
      ] as const,
      queryFn: ({ pageParam }) =>
        radarsApi.getList({
          ...params,
          per_page: RADARS_PAGE_SIZE,
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
    }),

  details: () => [...radarsQueries.all, 'detail'] as const,

  /**
   * Full radar detail (perimeter, channels, schedule). The async-naming poll
   * layers over this leaf in `naming.ts` — see the factory docblock.
   */
  detail: (uuid: string, { viewerId }: ViewerScoped) =>
    queryOptions({
      queryKey: [...radarsQueries.details(), uuid, { viewerId }] as const,
      queryFn: () => radarsApi.getByUuid(uuid),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),

  /** Root key for everything scan-shaped under one radar — the triage
   *  mutation's cancel/patch handle. */
  scans: (radarUuid: string) =>
    [...radarsQueries.all, 'scans', radarUuid] as const,

  /** The "all scan lists for this radar" prefix — invalidation + optimistic
   *  patch handle across every workflow tab's list. */
  scanLists: (radarUuid: string) =>
    [...radarsQueries.scans(radarUuid), 'list'] as const,

  /**
   * One workflow tab's scan list. `staleTime` matches the poll cadence — data
   * that refreshes itself every 15s while moving should not also refetch on
   * every focus in between.
   */
  infiniteScans: (
    radarUuid: string,
    { viewerId, ...params }: Omit<RadarScanListParams, 'page' | 'per_page'> &
      ViewerScoped,
  ) =>
    infiniteQueryOptions({
      queryKey: [
        ...radarsQueries.scanLists(radarUuid),
        params,
        { viewerId },
      ] as const,
      queryFn: ({ pageParam }) =>
        radarsApi.getScans(radarUuid, {
          ...params,
          per_page: RADARS_PAGE_SIZE,
          page: pageParam,
        }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => {
        const { current_page, last_page } = lastPage.pagination;
        return current_page < last_page ? current_page + 1 : undefined;
      },
      staleTime: SCAN_LIST_POLL_MS,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
      refetchInterval: scanListPollInterval,
      refetchIntervalInBackground: false,
    }),

  /**
   * The OWNER read of one scan (`GET /radars/{r}/scans/{s}`). For a published
   * scan the same endpoint answers a signed-in NON-owner with the trimmed
   * reader shape — `report/viewer.ts` is the seam that tells them apart.
   * Polls itself while the scan is still running.
   */
  scanDetail: (radarUuid: string, scanUuid: string, { viewerId }: ViewerScoped) =>
    queryOptions({
      queryKey: [
        ...radarsQueries.scans(radarUuid),
        'detail',
        scanUuid,
        { viewerId },
      ] as const,
      queryFn: () => radarsApi.getScan(radarUuid, scanUuid),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
      refetchInterval: (query) => {
        const status = query.state.data?.data.status;
        return status !== undefined && IN_FLIGHT_SCAN_STATUSES.has(status)
          ? SCAN_DETAIL_POLL_MS
          : false;
      },
      refetchIntervalInBackground: false,
    }),

  /**
   * The PUBLIC read of a published scan (`GET /public/radars/…`) — the shape
   * served to signed-out visitors and guest accounts. Deliberately NOT
   * viewer-scoped (see the factory docblock). It polls while the scan is in
   * flight too: v1 froze a running scan's page for guests, and a share link
   * opened mid-scan should resolve into the report without a manual reload.
   */
  publicScan: (radarUuid: string, scanUuid: string) =>
    queryOptions({
      queryKey: [
        ...radarsQueries.scans(radarUuid),
        'public',
        scanUuid,
      ] as const,
      queryFn: () => radarsApi.getPublicScan(radarUuid, scanUuid),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchInterval: (query) => {
        const status = query.state.data?.data.status;
        return status !== undefined && IN_FLIGHT_SCAN_STATUSES.has(status)
          ? SCAN_DETAIL_POLL_MS
          : false;
      },
      refetchIntervalInBackground: false,
    }),
};
