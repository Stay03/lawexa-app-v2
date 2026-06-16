'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  Archive,
  CalendarClock,
  FileSearch,
  ListChecks,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  Settings,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { AnimatedTabs } from '@/components/ui/animated-tabs';
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
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageContainer } from '@/components/layout';
import { FloatingPromptInput } from '@/components/ui/floating-prompt-input';
import { ArchiveRadarDialog } from './ArchiveRadarDialog';
import { RadarSettingsSheet } from './RadarSettingsSheet';
import { RadarMetaRow } from './RadarMetaRow';
import { RadarStatusDot } from './RadarStatusDot';
import { ScanRow } from './ScanRow';
import { ScanRowSkeleton } from './RadarListSkeletons';
import { ScanInProgressRow } from './ScanInProgressRow';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';
import {
  hasInFlightScan,
  IN_FLIGHT_SCAN_STATUSES,
  useFirstScanDispatched,
  usePauseRadar,
  useRadar,
  useRadarScans,
  useResumeRadar,
  useScanNow,
} from '@/lib/hooks/useRadars';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { extractApiError } from '@/lib/utils/api-error';
import { describeCron } from '@/lib/utils/cron';
import type { ScanWorkflowStatus } from '@/types/radar';

const WORKFLOW_TABS: { value: ScanWorkflowStatus; label: string }[] = [
  { value: 'active', label: 'Inbox' },
  { value: 'complete', label: 'Completed' },
  { value: 'archive', label: 'Archived' },
];

const EMPTY_TAB_COPY: Record<ScanWorkflowStatus, { title: string; description: string }> = {
  active: {
    title: 'No reports yet',
    description:
      'Your first report lands after the next scheduled scan — or run one now.',
  },
  complete: {
    title: 'Nothing completed',
    description: 'Reports you mark complete move here.',
  },
  archive: {
    title: 'Nothing archived',
    description: 'Reports you archive move here.',
  },
};

const FIRST_SCAN_WINDOW_MS = 5 * 60 * 1000;

interface RadarInboxViewProps {
  radarUuid: string;
  initialSettingsOpen?: boolean;
}

/**
 * One radar's inbox of reports: header with status and actions, triage tabs,
 * the completed-report list, and the settings drawer (URL-synced to
 * /radars/{uuid}/settings).
 */
function RadarInboxView({ radarUuid, initialSettingsOpen = false }: RadarInboxViewProps) {
  const router = useRouter();
  const [workflowTab, setWorkflowTab] = useState<ScanWorkflowStatus>('active');
  const [settingsOpen, setSettingsOpen] = useState(initialSettingsOpen);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const radarQuery = useRadar(radarUuid);
  const radar = radarQuery.data?.data;

  // Show "First scan running…" and poll the empty list only when this
  // session actually dispatched a first scan (created with the switch on and
  // not blocked for balance), the radar is fresh (~5 min — the queued row
  // lands within ~60s), and nothing has completed yet. The query's fetch
  // timestamp stands in for the current time, keeping render pure.
  const firstScanDispatched = useFirstScanDispatched(radarUuid);
  const awaitingFirstScan =
    firstScanDispatched &&
    radar !== undefined &&
    radar.status === 'active' &&
    radar.last_scan_at === null &&
    radarQuery.dataUpdatedAt - new Date(radar.created_at).getTime() <
      FIRST_SCAN_WINDOW_MS;

  // The inbox ('active') list stays mounted on every tab: it's where queued/
  // running rows live, so it drives the in-flight indicator, the Scan now
  // guard, and the polling that refreshes radar data when a scan finishes.
  const inboxScansQuery = useRadarScans(
    radarUuid,
    { workflow_status: 'active' },
    { awaitingFirstScan }
  );
  const triagedScansQuery = useRadarScans(
    radarUuid,
    { workflow_status: workflowTab },
    { enabled: workflowTab !== 'active' }
  );
  const scansQuery =
    workflowTab === 'active' ? inboxScansQuery : triagedScansQuery;

  const allScans = scansQuery.data?.pages.flatMap((page) => page.data) ?? [];
  // The inbox is the scan list filtered client-side to completed scans, per
  // the API contract. Re-applying the workflow filter also makes
  // optimistically triaged rows leave the current tab immediately instead of
  // lingering until the server-filtered list refetches.
  const completedScans = allScans.filter(
    (scan) => scan.status === 'completed' && scan.workflow_status === workflowTab
  );
  // Queued/running scans live under the active workflow — surface them as
  // live rows in the Inbox tab so the in-flight state is always reflected by
  // the list itself (never a stranded banner).
  const inFlightScans =
    workflowTab === 'active'
      ? allScans.filter((scan) => IN_FLIGHT_SCAN_STATUSES.has(scan.status))
      : [];
  const scanInFlight = hasInFlightScan(inboxScansQuery.data);
  // Bridge the ~60s gap before the dispatched first scan's queued row lands:
  // show a single placeholder row while the inbox is still empty.
  const showFirstScanPlaceholder =
    workflowTab === 'active' &&
    awaitingFirstScan &&
    inFlightScans.length === 0 &&
    completedScans.length === 0;

  const scanNow = useScanNow();
  const pauseRadar = usePauseRadar();
  const resumeRadar = useResumeRadar();

  const setOverride = useBreadcrumbStore((state) => state.setOverride);
  const clearOverride = useBreadcrumbStore((state) => state.clearOverride);

  useEffect(() => {
    if (radar?.name) {
      setOverride(radarUuid, radar.name);
    }
    return () => {
      clearOverride(radarUuid);
    };
  }, [radarUuid, radar?.name, setOverride, clearOverride]);

  // Keep the URL in sync with the settings drawer without remounting the
  // route — Next.js supports shallow updates via the native history API.
  const handleSettingsOpenChange = (open: boolean) => {
    setSettingsOpen(open);
    if (open) {
      window.history.pushState(null, '', `/radars/${radarUuid}/settings`);
    } else {
      window.history.replaceState(null, '', `/radars/${radarUuid}`);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setSettingsOpen(window.location.pathname.endsWith('/settings'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const { ref: loadMoreRef, isIntersecting } = useIntersectionObserver();
  useEffect(() => {
    if (isIntersecting && scansQuery.hasNextPage && !scansQuery.isFetchingNextPage) {
      scansQuery.fetchNextPage();
    }
  }, [isIntersecting, scansQuery]);

  const handleScanNow = async () => {
    try {
      await scanNow.mutateAsync(radarUuid);
      toast.success('Scan dispatched', {
        description: 'The report will land in the inbox shortly.',
      });
    } catch (error) {
      toast.error('Could not start scan', {
        description: extractApiError(error).message,
      });
    }
  };

  const handlePause = async () => {
    try {
      await pauseRadar.mutateAsync(radarUuid);
      toast.success('Radar paused', {
        description: 'Scans are stopped — nothing is billed while paused.',
      });
    } catch (error) {
      toast.error('Could not pause radar', {
        description: extractApiError(error).message,
      });
    }
  };

  const handleResume = async () => {
    try {
      await resumeRadar.mutateAsync(radarUuid);
      toast.success('Radar resumed', {
        description: 'The schedule picks back up from here.',
      });
    } catch (error) {
      toast.error('Could not resume radar', {
        description: extractApiError(error).message,
      });
    }
  };

  if (radarQuery.isLoading) {
    return (
      <PageContainer>
        <ScanRowSkeleton />
      </PageContainer>
    );
  }

  if (radarQuery.isError || !radar) {
    const status = radarQuery.error ? extractApiError(radarQuery.error).status : 0;
    const notFound = status === 403 || status === 404;
    return (
      <PageContainer>
        <ErrorState
          title={notFound ? 'Radar not found' : 'Failed to load radar'}
          description={
            notFound
              ? 'It may have been archived or belongs to another account.'
              : 'Please try again.'
          }
          retry={notFound ? undefined : () => radarQuery.refetch()}
        />
        {notFound && (
          <div className="flex justify-center">
            <Button asChild variant="outline">
              <Link href="/radars">Back to radars</Link>
            </Button>
          </div>
        )}
      </PageContainer>
    );
  }

  const scanNowDisabled =
    scanNow.isPending || scanInFlight || radar.status !== 'active';
  const scanNowReason = scanInFlight
    ? 'A scan is already running for this radar'
    : radar.status !== 'active'
      ? 'Resume this radar to scan'
      : null;

  const renderScans = () => {
    if (scansQuery.isLoading) {
      return <ScanRowSkeleton />;
    }
    if (scansQuery.isError) {
      return (
        <ErrorState
          title="Failed to load reports"
          description="Please try again."
          retry={() => scansQuery.refetch()}
        />
      );
    }
    const hasInFlightRows = inFlightScans.length > 0 || showFirstScanPlaceholder;
    if (completedScans.length === 0 && !hasInFlightRows) {
      const copy = EMPTY_TAB_COPY[workflowTab];
      return (
        <EmptyState
          icon={FileSearch}
          title={copy.title}
          description={copy.description}
          action={
            workflowTab === 'active' && !scanNowDisabled
              ? { label: 'Scan now', onClick: handleScanNow }
              : undefined
          }
        />
      );
    }
    return (
      <div className="divide-y divide-border/50">
        {inFlightScans.map((scan) => (
          <ScanInProgressRow
            key={scan.uuid}
            firstScan={radar.last_scan_at === null}
          />
        ))}
        {showFirstScanPlaceholder && <ScanInProgressRow firstScan />}
        {completedScans.map((scan) => (
          <ScanRow key={scan.uuid} radarUuid={radarUuid} scan={scan} />
        ))}
      </div>
    );
  };

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <RadarStatusDot status={radar.status} />
            <h1 className="min-w-0 flex-1 truncate text-2xl font-bold tracking-tight">
              {radar.name}
            </h1>
          </div>
          {radar.description && (
            <p className="mt-1 text-muted-foreground">{radar.description}</p>
          )}
          <RadarMetaRow className="mt-2">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-3.5" />
              {describeCron(radar.schedule_cron) ??
                `Custom — ${radar.schedule_cron}`}
            </span>
            <span>
              {radar.last_scan_at
                ? `Last scan ${formatDistanceToNow(new Date(radar.last_scan_at), { addSuffix: true })}`
                : 'Never scanned'}
            </span>
            {radar.status === 'active' && radar.next_scan_at && (
              <span>
                Next scan{' '}
                {formatDistanceToNow(new Date(radar.next_scan_at), {
                  addSuffix: true,
                })}
              </span>
            )}
            {radar.status === 'paused' && (
              <span>Paused — no scans scheduled</span>
            )}
          </RadarMetaRow>
        </div>

        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          {radar.status === 'paused' ? (
            <Button
              onClick={handleResume}
              disabled={resumeRadar.isPending}
              className="flex-1 sm:flex-none"
            >
              {resumeRadar.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Play />
              )}
              Resume
            </Button>
          ) : (
            radar.status === 'active' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex-1 sm:flex-none">
                    <Button
                      onClick={handleScanNow}
                      disabled={scanNowDisabled}
                      className="w-full sm:w-auto"
                    >
                      {scanNow.isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Zap />
                      )}
                      Scan now
                    </Button>
                  </span>
                </TooltipTrigger>
                {scanNowReason && (
                  <TooltipContent>{scanNowReason}</TooltipContent>
                )}
              </Tooltip>
            )
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 text-muted-foreground"
                aria-label="Radar actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {radar.status !== 'archived' && (
                <DropdownMenuItem onClick={() => handleSettingsOpenChange(true)}>
                  <Settings />
                  Settings
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href={`/radars/${radarUuid}/scan-log`}>
                  <ListChecks />
                  Scan log
                </Link>
              </DropdownMenuItem>
              {radar.status === 'active' && (
                <DropdownMenuItem
                  onClick={handlePause}
                  disabled={pauseRadar.isPending}
                >
                  <Pause />
                  Pause
                </DropdownMenuItem>
              )}
              {radar.status !== 'archived' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setArchiveOpen(true)}
                  >
                    <Archive />
                    Archive
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AnimatedTabs
        tabs={WORKFLOW_TABS}
        value={workflowTab}
        onValueChange={(value) => setWorkflowTab(value as ScanWorkflowStatus)}
      />

      {renderScans()}

      <div ref={loadMoreRef} className="flex justify-center py-2">
        {scansQuery.isFetchingNextPage && (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="flex justify-center border-t pt-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/radars/${radarUuid}/scan-log`}>
            <ListChecks />
            View scan log
          </Link>
        </Button>
      </div>

      <RadarSettingsSheet
        radar={radar}
        open={settingsOpen}
        onOpenChange={handleSettingsOpenChange}
      />
      <ArchiveRadarDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        radar={radar}
        onArchived={() => router.push('/radars')}
      />

      <FloatingPromptInput
        contextType="radar"
        contextId={radar.uuid}
        contextTitle={radar.name}
      />
    </PageContainer>
  );
}

export { RadarInboxView };
