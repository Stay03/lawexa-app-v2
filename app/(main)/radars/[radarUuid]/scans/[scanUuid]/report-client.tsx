'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ErrorState } from '@/components/common/ErrorState';
import { PageContainer } from '@/components/layout';
import { ScanRowSkeleton } from '@/components/radar/RadarListSkeletons';
import { ScanRunningIndicator } from '@/components/radar/ScanRunningIndicator';
import { ScanTriageActions } from '@/components/radar/ScanTriageActions';
import { ScanShareButton } from '@/components/radar/ScanShareButton';
import { ReportView } from '@/components/radar/ReportView';
import {
  IN_FLIGHT_SCAN_STATUSES,
  useRadar,
  useRadarScan,
  usePublicRadarScan,
  useTriageScan,
} from '@/lib/hooks/useRadars';
import { useGuestAuth } from '@/lib/hooks/useGuestAuth';
import { useAuthStore } from '@/lib/stores/authStore';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { extractApiError } from '@/lib/utils/api-error';
import { formatScanDuration } from '@/lib/utils/duration';

export default function ReportClient() {
  const { radarUuid, scanUuid } = useParams<{ radarUuid: string; scanUuid: string }>();

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isGuest = useAuthStore((state) => state.isGuest);
  // Bootstraps a guest token when logged out; no-op for real / existing guests.
  const { isLoading: guestLoading, error: guestError } = useGuestAuth();

  // Real signed-in users hit the authed endpoint (owner → full, non-owner →
  // trimmed/404); guests/logged-out hit the public no-auth endpoint.
  const authedScanQuery = useRadarScan(radarUuid, scanUuid);
  const publicScanQuery = usePublicRadarScan(radarUuid, scanUuid, {
    enabled: isAuthenticated && isGuest,
  });

  const ownerScan = authedScanQuery.data?.data;
  const sharedScan = publicScanQuery.data?.data;
  // The trimmed (non-owner) shape omits `is_private`; its presence marks the
  // viewer as the owner with the full payload + triage/share controls.
  const isOwner = !!ownerScan && 'is_private' in ownerScan;

  const activeQuery = isGuest ? publicScanQuery : authedScanQuery;
  const view = isGuest ? sharedScan : ownerScan;

  // Radar detail is owner-only (it 403s for non-owners); fetch it only once we
  // know the viewer owns this scan. Non-owners read the radar name from the
  // scan's trimmed `radar` context instead.
  const radarQuery = useRadar(radarUuid, { enabled: isOwner });
  const radar = radarQuery.data?.data;
  const scanRadar = view && 'radar' in view ? view.radar : null;
  const radarName = isOwner ? radar?.name : scanRadar?.name;

  const triageScan = useTriageScan();

  const setOverride = useBreadcrumbStore((state) => state.setOverride);
  const clearOverride = useBreadcrumbStore((state) => state.clearOverride);

  useEffect(() => {
    if (radarName) setOverride(radarUuid, radarName);
    return () => clearOverride(radarUuid);
  }, [radarUuid, radarName, setOverride, clearOverride]);

  useEffect(() => {
    setOverride(scanUuid, view?.title ?? 'Report');
    return () => clearOverride(scanUuid);
  }, [scanUuid, view?.title, setOverride, clearOverride]);

  // Opening a completed unread report marks it read exactly once (owner only).
  const hasMarkedRead = useRef(false);
  useEffect(() => {
    if (
      isOwner &&
      !hasMarkedRead.current &&
      ownerScan?.status === 'completed' &&
      ownerScan.read_at === null
    ) {
      hasMarkedRead.current = true;
      triageScan.mutate({ radarUuid, scanUuid, payload: { read: true } });
    }
  }, [isOwner, ownerScan?.status, ownerScan?.read_at, radarUuid, scanUuid, triageScan]);

  if (guestError) {
    return (
      <PageContainer variant="detail">
        <ErrorState title="Couldn't load report" description="Please refresh the page." />
      </PageContainer>
    );
  }

  // Still acquiring a guest token, or the active query is loading.
  if (!isAuthenticated || activeQuery.isLoading || guestLoading) {
    return (
      <PageContainer variant="detail">
        <ScanRowSkeleton count={3} />
      </PageContainer>
    );
  }

  if (activeQuery.isError || !view) {
    const status = activeQuery.error ? extractApiError(activeQuery.error).status : 0;
    const notFound = status === 403 || status === 404;
    return (
      <PageContainer variant="detail">
        <ErrorState
          title={notFound ? 'Report not found' : 'Failed to load report'}
          description={
            notFound
              ? 'This report is private or no longer available.'
              : 'Please try again.'
          }
          retry={notFound ? undefined : () => activeQuery.refetch()}
        />
        {isOwner && (
          <div className="flex justify-center">
            <Button asChild variant="outline">
              <Link href={`/radars/${radarUuid}`}>Back to radar</Link>
            </Button>
          </div>
        )}
      </PageContainer>
    );
  }

  if (IN_FLIGHT_SCAN_STATUSES.has(view.status)) {
    return (
      <PageContainer variant="detail">
        <ScanRunningIndicator label="Scan in progress — the report appears here when it completes" />
        <ScanRowSkeleton count={3} />
      </PageContainer>
    );
  }

  if (view.status !== 'completed') {
    return (
      <PageContainer variant="detail">
        <ErrorState
          title="Scan failed"
          description={ownerScan?.error ?? 'The agent could not complete this scan.'}
        />
        {isOwner && (
          <div className="flex justify-center">
            <Button asChild variant="outline">
              <Link href={`/radars/${radarUuid}`}>Back to radar</Link>
            </Button>
          </div>
        )}
      </PageContainer>
    );
  }

  const completedAt = view.completed_at ?? view.created_at;
  const showViews = isGuest || (isOwner && !ownerScan!.is_private);

  return (
    <PageContainer variant="detail">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {view.title ?? 'Untitled report'}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {radarName && (
            <>
              {isOwner ? (
                <Link
                  href={`/radars/${radarUuid}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {radarName}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{radarName}</span>
              )}
              <span aria-hidden>·</span>
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                {formatDistanceToNow(new Date(completedAt), { addSuffix: true })}
              </span>
            </TooltipTrigger>
            <TooltipContent>{new Date(completedAt).toLocaleString()}</TooltipContent>
          </Tooltip>
          {view.duration_ms !== null && (
            <>
              <span aria-hidden>·</span>
              <span>{formatScanDuration(view.duration_ms)} scan</span>
            </>
          )}
          {showViews && (
            <>
              <span aria-hidden>·</span>
              <span>
                {view.views_count} {view.views_count === 1 ? 'view' : 'views'}
              </span>
            </>
          )}
          {isOwner && ownerScan!.triggered_by === 'manual' && (
            <Badge variant="outline">Manual</Badge>
          )}
          {!view.has_findings && <Badge variant="ghost">No change</Badge>}
        </div>
      </div>

      {isOwner && (
        <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2 border-b bg-background/95 px-1 py-2 backdrop-blur">
          <ScanTriageActions radarUuid={radarUuid} scan={ownerScan!} variant="toolbar" />
          <div className="flex-1" />
          <ScanShareButton radarUuid={radarUuid} scan={ownerScan!} />
          {radar && (
            <Button asChild size="sm">
              <Link href={`/c/${radar.conversation_uuid}`}>
                <MessageSquare />
                Chat Lawexa
              </Link>
            </Button>
          )}
        </div>
      )}

      <ReportView scan={view} />
    </PageContainer>
  );
}
