'use client';

import { use, useEffect, useRef } from 'react';
import Link from 'next/link';
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
import { ReportView } from '@/components/radar/ReportView';
import {
  IN_FLIGHT_SCAN_STATUSES,
  useRadar,
  useRadarScan,
  useTriageScan,
} from '@/lib/hooks/useRadars';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { extractApiError } from '@/lib/utils/api-error';

interface ReportPageProps {
  params: Promise<{ radarUuid: string; scanUuid: string }>;
}

export default function ReportPage({ params }: ReportPageProps) {
  const { radarUuid, scanUuid } = use(params);

  const radarQuery = useRadar(radarUuid);
  const scanQuery = useRadarScan(radarUuid, scanUuid);
  const triageScan = useTriageScan();

  const radar = radarQuery.data?.data;
  const scan = scanQuery.data?.data;

  const setOverride = useBreadcrumbStore((state) => state.setOverride);
  const clearOverride = useBreadcrumbStore((state) => state.clearOverride);

  useEffect(() => {
    if (radar?.name) setOverride(radarUuid, radar.name);
    return () => clearOverride(radarUuid);
  }, [radarUuid, radar?.name, setOverride, clearOverride]);

  useEffect(() => {
    setOverride(scanUuid, scan?.title ?? 'Report');
    return () => clearOverride(scanUuid);
  }, [scanUuid, scan?.title, setOverride, clearOverride]);

  // Opening a completed unread report marks it read exactly once — the
  // optimistic update unbolds the inbox row and decrements unread counts.
  const hasMarkedRead = useRef(false);
  useEffect(() => {
    if (
      !hasMarkedRead.current &&
      scan?.status === 'completed' &&
      scan.read_at === null
    ) {
      hasMarkedRead.current = true;
      triageScan.mutate({ radarUuid, scanUuid, payload: { read: true } });
    }
  }, [scan?.status, scan?.read_at, radarUuid, scanUuid, triageScan]);

  if (scanQuery.isLoading || radarQuery.isLoading) {
    return (
      <PageContainer variant="detail">
        <ScanRowSkeleton count={3} />
      </PageContainer>
    );
  }

  if (scanQuery.isError || !scan) {
    const status = scanQuery.error ? extractApiError(scanQuery.error).status : 0;
    const notFound = status === 403 || status === 404;
    return (
      <PageContainer variant="detail">
        <ErrorState
          title={notFound ? 'Report not found' : 'Failed to load report'}
          description={
            notFound
              ? 'It may belong to a different radar or account.'
              : 'Please try again.'
          }
          retry={notFound ? undefined : () => scanQuery.refetch()}
        />
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link href={`/radars/${radarUuid}`}>Back to radar</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (IN_FLIGHT_SCAN_STATUSES.has(scan.status)) {
    return (
      <PageContainer variant="detail">
        <ScanRunningIndicator label="Scan in progress — the report appears here when it completes" />
        <ScanRowSkeleton count={3} />
      </PageContainer>
    );
  }

  if (scan.status !== 'completed') {
    return (
      <PageContainer variant="detail">
        <ErrorState
          title="Scan failed"
          description={scan.error ?? 'The agent could not complete this scan.'}
        />
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link href={`/radars/${radarUuid}`}>Back to radar</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  const completedAt = scan.completed_at ?? scan.created_at;

  return (
    <PageContainer variant="detail">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {scan.title ?? 'Untitled report'}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {radar && (
            <>
              <Link
                href={`/radars/${radarUuid}`}
                className="font-medium text-foreground hover:underline"
              >
                {radar.name}
              </Link>
              <span aria-hidden>·</span>
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                {formatDistanceToNow(new Date(completedAt), { addSuffix: true })}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {new Date(completedAt).toLocaleString()}
            </TooltipContent>
          </Tooltip>
          {scan.duration_ms !== null && (
            <>
              <span aria-hidden>·</span>
              <span>{Math.round(scan.duration_ms / 1000)}s scan</span>
            </>
          )}
          {scan.triggered_by === 'manual' && <Badge variant="outline">Manual</Badge>}
          {!scan.has_findings && <Badge variant="ghost">No change</Badge>}
        </div>
      </div>

      <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2 border-b bg-background/95 px-1 py-2 backdrop-blur">
        <ScanTriageActions radarUuid={radarUuid} scan={scan} variant="toolbar" />
        <div className="flex-1" />
        {radar && (
          <Button asChild size="sm">
            <Link href={`/c/${radar.conversation_uuid}`}>
              <MessageSquare />
              Open in chat
            </Link>
          </Button>
        )}
      </div>

      <ReportView scan={scan} />
    </PageContainer>
  );
}
