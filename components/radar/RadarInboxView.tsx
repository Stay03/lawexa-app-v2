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
  MessageSquare,
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
import { ArchiveRadarDialog } from './ArchiveRadarDialog';
import { RadarSettingsSheet } from './RadarSettingsSheet';
import { RadarStatusBadge } from './RadarStatusBadge';
import { ScanRow } from './ScanRow';
import { ScanRowSkeleton } from './RadarListSkeletons';
import { ScanRunningIndicator } from './ScanRunningIndicator';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';
import {
  hasInFlightScan,
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

  // Within ~5 minutes of creating an unscanned active radar, keep polling
  // even while the scan list is empty — the dispatched first scan's queued
  // row can take up to a minute to land.
  const awaitingFirstScan =
    radar !== undefined &&
    radar.status === 'active' &&
    radar.last_scan_at === null &&
    Date.now() - new Date(radar.created_at).getTime() < FIRST_SCAN_WINDOW_MS;

  // The inbox is the scan list filtered client-side to completed scans, per
  // the API contract — in-flight rows stay visible to the polling logic.
  const scansQuery = useRadarScans(
    radarUuid,
    { workflow_status: workflowTab },
    { awaitingFirstScan }
  );

  const allScans = scansQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const completedScans = allScans.filter((scan) => scan.status === 'completed');
  const scanInFlight = hasInFlightScan(scansQuery.data);

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
    if (completedScans.length === 0) {
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
        {completedScans.map((scan) => (
          <ScanRow key={scan.uuid} radarUuid={radarUuid} scan={scan} />
        ))}
      </div>
    );
  };

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {radar.name}
            </h1>
            <RadarStatusBadge status={radar.status} />
          </div>
          {radar.description && (
            <p className="mt-1 text-muted-foreground">{radar.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-3.5" />
              {describeCron(radar.schedule_cron) ??
                `Custom — ${radar.schedule_cron}`}
            </span>
            <span aria-hidden>·</span>
            <span>
              {radar.last_scan_at
                ? `Last scan ${formatDistanceToNow(new Date(radar.last_scan_at), { addSuffix: true })}`
                : 'Never scanned'}
            </span>
            {radar.status === 'active' && radar.next_scan_at && (
              <>
                <span aria-hidden>·</span>
                <span>
                  Next scan{' '}
                  {formatDistanceToNow(new Date(radar.next_scan_at), {
                    addSuffix: true,
                  })}
                </span>
              </>
            )}
            {radar.status === 'paused' && (
              <>
                <span aria-hidden>·</span>
                <span>Paused — no scans scheduled</span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/c/${radar.conversation_uuid}`}>
              <MessageSquare />
              Open in chat
            </Link>
          </Button>
          {radar.status === 'paused' ? (
            <Button onClick={handleResume} disabled={resumeRadar.isPending}>
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
                  <span>
                    <Button onClick={handleScanNow} disabled={scanNowDisabled}>
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

      {(scanInFlight || awaitingFirstScan) && (
        <ScanRunningIndicator
          label={
            radar.last_scan_at === null
              ? 'First scan running — your report will appear here shortly'
              : 'Scan in progress — report coming shortly'
          }
        />
      )}

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
    </PageContainer>
  );
}

export { RadarInboxView };
