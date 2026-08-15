'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Archive,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  Settings,
  Sparkles,
  Zap,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { extractApiError } from '@/lib/utils/api-error';
import type { RadarScan } from '@/types/radar';
import { useV2Session } from '@/v2/runtime/session-context';
import {
  quietPushUrlParams,
  quietReplaceUrlParams,
} from '@/v2/runtime/url-params';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { usePauseRadar, useResumeRadar, useScanNow } from '../actions';
import { ArchiveRadarDialog } from '../ArchiveRadarDialog';
import { IN_FLIGHT_SCAN_STATUSES, hasInFlightScan } from '../queries';
import {
  useFirstScanDispatched,
  useRadarDetail,
  useRadarNamePending,
} from '../naming';
import { RADAR_STATUS, agoLabel, radarMetaParts } from '../model';
import { RadarTabs, type RadarTab } from '../RadarTabs';
import { useRadarScans } from '../use-radar-scans';
import {
  RadarsGuestState,
  RadarsSignedOutState,
} from '../list/states';
import { ScanInProgressRow, ScanRow } from './ScanRow';
import { SettingsSheet } from './SettingsSheet';
import {
  RadarDetailSkeleton,
  RadarErrorState,
  RadarNotFoundState,
  ScanGapNotice,
  ScanListEmptyState,
  ScanListErrorState,
  ScanListSkeleton,
  ScanRowSkeleton,
  type RadarDetailTab,
} from './states';

/**
 * RadarScreen — the `/radars/[radarUuid]` client root: the radar's inbox.
 *
 * ── URL STATE IS WRITTEN QUIETLY, AND THAT IS LOAD-BEARING ──────────────────
 * This page sits under a DYNAMIC `[radarUuid]` segment served through the v2
 * rewrite proxy — exactly the geometry where a LOUD history write makes the
 * Next-16 restore machinery walk a broken param tree and refetch
 * `/radars/undefined` forever (the case page's documented autopsy,
 * `url-params.ts`). So the workflow tab (`?tab=`) and the settings sheet
 * (`?settings=1`) both live in LOCAL STATE with the URL as a quiet mirror:
 * initialised from the URL once, written with the quiet twins, adopted back
 * on popstate. Tab switches REPLACE (a filter is not a place); the settings
 * open PUSHES (Back closes the sheet).
 *
 * ── THE WORKFLOW TABS ───────────────────────────────────────────────────────
 * Inbox / Completed / Archived / All activity (D3: the scan log folds in as
 * the fourth view — same route, same row component). Triaged tabs ask the
 * SERVER (`status=completed&workflow_status=…`); the inbox merges in-flight
 * rows with active completed reports. Rows are ALSO re-filtered client-side
 * against the tab's workflow status, so an optimistic triage moves a row out
 * of the visible tab in the same frame — the refetch then reconciles arrivals.
 *
 * The INBOX list stays mounted on every tab: it is where queued/running rows
 * live, so it drives the in-flight indicator, the Scan-now guard, and the
 * completion invalidation (`useRadarScans`). Polling pauses automatically
 * while the tab is hidden (`refetchIntervalInBackground: false` in the leaf).
 *
 * ── THE NAMING SHIMMER ──────────────────────────────────────────────────────
 * After a nameless create the backend upgrades the fallback name via a queue.
 * While `useRadarNamePending` holds, the h1 pulses quietly under a
 * "Naming this radar…" caption, and one polite live region announces first
 * the naming state and then the final name — the honest version of v1's
 * silent h1 swap.
 */

const FIRST_SCAN_WINDOW_MS = 5 * 60 * 1000;

const DETAIL_TABS: readonly RadarTab<RadarDetailTab>[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'completed', label: 'Completed' },
  { id: 'archived', label: 'Archived' },
  { id: 'activity', label: 'All activity' },
];

const PANEL_ID = 'radar-scans-panel';

function parseTab(raw: string | null): RadarDetailTab {
  return raw === 'completed' || raw === 'archived' || raw === 'activity'
    ? raw
    : 'inbox';
}

export function RadarScreen({ radarUuid }: { radarUuid: string }) {
  return (
    <Suspense fallback={<RadarDetailFallback />}>
      <RadarBody radarUuid={radarUuid} />
    </Suspense>
  );
}

function RadarBody({ radarUuid }: { radarUuid: string }) {
  const { signedIn, role } = useV2Session();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Quiet-URL state — initialised from the URL once, then locally owned.
  const [tab, setTabState] = useState<RadarDetailTab>(() =>
    parseTab(searchParams.get('tab')),
  );
  const [settingsOpen, setSettingsOpen] = useState(
    () => searchParams.get('settings') === '1',
  );
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [now] = useState(() => Date.now());

  const setTab = useCallback((next: RadarDetailTab) => {
    setTabState(next);
    quietReplaceUrlParams({ tab: next === 'inbox' ? null : next });
  }, []);
  const openSettings = useCallback(() => {
    setSettingsOpen(true);
    quietPushUrlParams({ settings: '1' });
  }, []);
  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    quietReplaceUrlParams({ settings: null });
  }, []);
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      setTabState(parseTab(params.get('tab')));
      setSettingsOpen(params.get('settings') === '1');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const radarQuery = useRadarDetail(radarUuid);
  const radar = radarQuery.data?.data;
  const namePending = useRadarNamePending(radarUuid);
  const firstScanDispatched = useFirstScanDispatched(radarUuid);

  // The naming announcement: only a screen that SAW the pending state may
  // announce a settle, and only a REAL upgrade is announced — the fallback
  // name captured at first sighting is the baseline, so a 45s timeout that
  // keeps the fallback narrates nothing (there is no event to narrate).
  const [namingBaseline, setNamingBaseline] = useState<string | null>(null);
  if (namePending && namingBaseline === null && radarQuery.data) {
    setNamingBaseline(radarQuery.data.data.name);
  }

  // Publish the radar's name to the header centre once known.
  const headerTitle = radar?.name ?? null;
  useEffect(() => {
    if (!headerTitle) return;
    setHeaderContext({ title: headerTitle, confidential: false });
  }, [headerTitle]);
  useEffect(() => () => clearHeaderContext(), []);

  // First-scan bridge (v1's exact gate): only when this session dispatched
  // one, the radar is fresh, and nothing has completed yet. The query's fetch
  // timestamp stands in for the clock, keeping render pure.
  const awaitingFirstScan =
    firstScanDispatched &&
    radar !== undefined &&
    radar.status === 'active' &&
    radar.last_scan_at === null &&
    radarQuery.dataUpdatedAt - Date.parse(radar.created_at) <
      FIRST_SCAN_WINDOW_MS;

  // The inbox list is ALWAYS mounted (in-flight rows, guard, invalidation);
  // the other views fetch when visited.
  const inboxQuery = useRadarScans(
    radarUuid,
    { workflow_status: 'active' },
    { awaitingFirstScan },
  );
  const completedQuery = useRadarScans(
    radarUuid,
    { status: 'completed', workflow_status: 'complete' },
    { enabled: tab === 'completed' },
  );
  const archivedQuery = useRadarScans(
    radarUuid,
    { status: 'completed', workflow_status: 'archive' },
    { enabled: tab === 'archived' },
  );
  const activityQuery = useRadarScans(
    radarUuid,
    {},
    { enabled: tab === 'activity' },
  );

  const activeQuery =
    tab === 'inbox'
      ? inboxQuery
      : tab === 'completed'
        ? completedQuery
        : tab === 'archived'
          ? archivedQuery
          : activityQuery;

  const scanNow = useScanNow();
  const pauseRadar = usePauseRadar();
  const resumeRadar = useResumeRadar();

  const scrollRootRef = useShellScrollRoot();
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    hasNextPage: activeQuery.hasNextPage,
    isFetchingNextPage: activeQuery.isFetchingNextPage,
    fetchNextPage: activeQuery.fetchNextPage,
    rootRef: scrollRootRef,
    rootMargin: '320px',
  });

  if (!signedIn) {
    return (
      <div className={LIST_COLUMN}>
        <RadarsSignedOutState />
      </div>
    );
  }
  if (role === 'guest') {
    return (
      <div className={LIST_COLUMN}>
        <RadarsGuestState />
      </div>
    );
  }

  if (radarQuery.isPending) {
    return (
      <div className={LIST_COLUMN}>
        <RadarDetailSkeleton />
      </div>
    );
  }

  if (radarQuery.isError || !radar) {
    const status = radarQuery.error
      ? extractApiError(radarQuery.error).status
      : 0;
    const notFound = status === 403 || status === 404;
    return (
      <div className={LIST_COLUMN}>
        {notFound ? (
          <RadarNotFoundState />
        ) : (
          <RadarErrorState onRetry={() => void radarQuery.refetch()} />
        )}
      </div>
    );
  }

  const statusConfig = RADAR_STATUS[radar.status];
  const meta = radarMetaParts(radar, now);

  // ── THE LOUD FAILURE (owner, August 3 2026) ───────────────────────────────
  // Derived from the ALWAYS-MOUNTED inbox data, so it speaks on every tab.
  // Newest-by-created_at rather than trusting page order; the banner shows
  // only when that newest scan ended without running. Two guards keep it
  // honest: an in-flight newest scan (the retry) silences it by construction,
  // and `last_scan_at` must not be newer than the failed run — the one case
  // where the inbox's newest row is NOT the radar's newest scan is a newer
  // SUCCESS already triaged out of the inbox, and `last_scan_at` carries that
  // success's time, so the stale banner is suppressed (60s skew tolerance).
  const inboxScans =
    inboxQuery.data?.pages.flatMap((page) => page.data) ?? ([] as RadarScan[]);
  const newestScan = inboxScans.reduce<RadarScan | null>(
    (best, scan) =>
      best === null || Date.parse(scan.created_at) > Date.parse(best.created_at)
        ? scan
        : best,
    null,
  );
  const scanGap =
    newestScan !== null &&
    (newestScan.status === 'failed' ||
      newestScan.status === 'skipped_no_balance') &&
    (radar.last_scan_at === null ||
      Date.parse(newestScan.started_at ?? newestScan.created_at) >=
        Date.parse(radar.last_scan_at) - 60_000)
      ? newestScan
      : null;

  const allScans =
    activeQuery.data?.pages.flatMap((page) => page.data) ?? ([] as RadarScan[]);
  // Client-side re-application of each tab's filter, so optimistically
  // triaged rows leave the visible tab immediately (see the docblock).
  const completedRows =
    tab === 'activity'
      ? allScans
      : allScans.filter(
          (scan) =>
            scan.status === 'completed' &&
            scan.workflow_status ===
              (tab === 'inbox'
                ? 'active'
                : tab === 'completed'
                  ? 'complete'
                  : 'archive'),
        );
  const inFlightScans =
    tab === 'inbox'
      ? allScans.filter((scan) => IN_FLIGHT_SCAN_STATUSES.has(scan.status))
      : [];
  const scanInFlight = hasInFlightScan(inboxQuery.data);
  const showFirstScanPlaceholder =
    tab === 'inbox' &&
    awaitingFirstScan &&
    inFlightScans.length === 0 &&
    completedRows.length === 0;

  const scanNowDisabled =
    scanNow.isPending || scanInFlight || radar.status !== 'active';
  const scanNowReason = scanInFlight
    ? 'A scan is already running for this radar'
    : radar.status !== 'active'
      ? 'Resume this radar to scan'
      : null;

  const showListSkeleton = activeQuery.isPending;
  const showListError = activeQuery.isError && allScans.length === 0;
  const hasRows =
    completedRows.length > 0 ||
    inFlightScans.length > 0 ||
    showFirstScanPlaceholder;

  return (
    <div className={LIST_COLUMN}>
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        {/* ── Header: identity + actions ─────────────────────────────────── */}
        <header className="flex flex-col gap-2 border-b border-border/60 pb-5">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <span
              aria-hidden
              className={cn('size-2 rounded-full', statusConfig.dotClass)}
            />
            {statusConfig.label} radar
          </p>

          <h1
            className={cn(
              'text-xl font-semibold tracking-tight text-foreground',
              namePending && 'motion-safe:animate-pulse',
            )}
          >
            {radar.name}
          </h1>
          {namePending ? (
            <p className="flex items-center gap-1.5 text-xs text-primary motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
              <Sparkles aria-hidden className="size-3.5" />
              Naming this radar…
            </p>
          ) : null}
          {/* The naming flow's one polite voice — see the baseline note. */}
          {namingBaseline !== null ? (
            <span role="status" aria-live="polite" className="sr-only">
              {namePending
                ? 'Naming this radar'
                : radar.name !== namingBaseline
                  ? `This radar is named ${radar.name}`
                  : ''}
            </span>
          ) : null}

          {radar.description ? (
            <p className="max-w-prose text-sm text-muted-foreground">
              {radar.description}
            </p>
          ) : null}

          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {meta.map((part, partIndex) => (
              <span key={part} className="inline-flex items-center gap-2">
                {partIndex > 0 ? (
                  <span aria-hidden className="text-muted-foreground/40">
                    ·
                  </span>
                ) : null}
                {part}
              </span>
            ))}
          </p>

          {radar.status !== 'archived' ? (
            <div className="flex items-center gap-2 pt-1">
              {radar.status === 'paused' ? (
                <Button
                  size="sm"
                  onClick={() => resumeRadar.mutate(radar.uuid)}
                  disabled={resumeRadar.isPending}
                >
                  {resumeRadar.isPending ? (
                    <Loader2 aria-hidden className="animate-spin" />
                  ) : (
                    <Play aria-hidden />
                  )}
                  Resume
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        size="sm"
                        onClick={() => scanNow.mutate(radar.uuid)}
                        disabled={scanNowDisabled}
                      >
                        {scanNow.isPending ? (
                          <Loader2 aria-hidden className="animate-spin" />
                        ) : (
                          <Zap aria-hidden />
                        )}
                        Scan now
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {scanNowReason ? (
                    <TooltipContent>{scanNowReason}</TooltipContent>
                  ) : null}
                </Tooltip>
              )}

              {/* Pause fires from the (now closed) menu, so the trigger
                  carries its live pending state — the honest-plain-mutation
                  contract in `actions.ts`. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 text-muted-foreground"
                    aria-label="Radar actions"
                    aria-busy={pauseRadar.isPending || undefined}
                    disabled={pauseRadar.isPending}
                  >
                    {pauseRadar.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <MoreHorizontal className="size-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={openSettings}>
                    <Settings />
                    Settings
                  </DropdownMenuItem>
                  {radar.status === 'active' ? (
                    <DropdownMenuItem
                      onClick={() => pauseRadar.mutate(radar.uuid)}
                      disabled={pauseRadar.isPending}
                    >
                      <Pause />
                      Pause
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setArchiveOpen(true)}
                  >
                    <Archive />
                    Archive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </header>

        {scanGap ? (
          <div className="mt-4">
            <ScanGapNotice
              status={
                scanGap.status === 'failed' ? 'failed' : 'skipped_no_balance'
              }
              when={agoLabel(scanGap.started_at ?? scanGap.created_at, now)}
              radarPaused={radar.status !== 'active'}
            />
          </div>
        ) : null}

        {/* ── Workflow tabs + the one scan panel ─────────────────────────── */}
        <div className="mt-4">
          <RadarTabs
            tabs={DETAIL_TABS}
            value={tab}
            onChange={setTab}
            ariaLabel="Report views"
            panelId={PANEL_ID}
          />
        </div>

        {/* A quiet live summary so polling changes are heard, not just seen. */}
        <span role="status" aria-live="polite" className="sr-only">
          {tab === 'inbox' && inFlightScans.length > 0
            ? `${completedRows.length} reports, a scan is running`
            : `${completedRows.length} ${tab === 'activity' ? 'scans' : 'reports'}`}
        </span>

        <div
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={`${PANEL_ID}-tab-${tab}`}
          className="mt-3"
        >
          {showListSkeleton ? (
            <ScanListSkeleton />
          ) : showListError ? (
            <ScanListErrorState onRetry={() => void activeQuery.refetch()} />
          ) : !hasRows ? (
            <ScanListEmptyState
              tab={tab}
              onScanNow={
                tab === 'inbox' && !scanNowDisabled
                  ? () => scanNow.mutate(radar.uuid)
                  : undefined
              }
            />
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-border/60">
                {inFlightScans.map((scan) => (
                  <ScanInProgressRow
                    key={scan.uuid}
                    firstScan={radar.last_scan_at === null}
                  />
                ))}
                {showFirstScanPlaceholder ? <ScanInProgressRow firstScan /> : null}
                {completedRows.map((scan) => (
                  <ScanRow
                    key={scan.uuid}
                    radarUuid={radarUuid}
                    scan={scan}
                    context={tab === 'activity' ? 'activity' : 'workflow'}
                    now={now}
                  />
                ))}
              </ul>

              <div ref={sentinelRef} className="pt-1">
                {activeQuery.isFetchingNextPage ? (
                  <div
                    aria-hidden
                    className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
                  >
                    <ScanRowSkeleton />
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      <SettingsSheet
        radar={radar}
        open={settingsOpen}
        onOpenChange={(open) => (open ? openSettings() : closeSettings())}
      />
      <ArchiveRadarDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        radar={radar}
        onArchived={() => router.push('/radars')}
      />
    </div>
  );
}

/** The route fallback — the detail skeleton, pulsing as it does in the live
 *  screen, in the shared column. Identical to
 *  `app/v2/radars/[radarUuid]/loading.tsx`. */
export function RadarDetailFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading radar
      </span>
      <div aria-hidden inert className={LIST_COLUMN}>
        <RadarDetailSkeleton />
      </div>
    </>
  );
}
