'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ListChecks, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageContainer, PageHeader } from '@/components/layout';
import { ScanRowSkeleton } from '@/components/radar/RadarListSkeletons';
import { ScanStatusBadge } from '@/components/radar/ScanStatusBadge';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';
import { useRadar, useRadarScans } from '@/lib/hooks/useRadars';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import type { RadarScan } from '@/types/radar';

interface ScanLogPageProps {
  params: Promise<{ radarUuid: string }>;
}

function ScanLogRow({ radarUuid, scan }: { radarUuid: string; scan: RadarScan }) {
  const startedAt = scan.started_at ?? scan.created_at;
  const showError =
    (scan.status === 'failed' || scan.status === 'skipped_no_balance') &&
    scan.error;

  return (
    <TableRow>
      <TableCell className="align-top">
        <ScanStatusBadge status={scan.status} />
        {showError && (
          <p className="mt-1.5 max-w-60 text-xs whitespace-normal text-destructive">
            {scan.error}
          </p>
        )}
        {scan.status === 'skipped_no_balance' && (
          <Link
            href="/settings/message-packs"
            className="mt-1 block text-xs font-medium text-primary hover:underline"
          >
            Buy message pack
          </Link>
        )}
      </TableCell>
      <TableCell className="max-w-72 align-top">
        {scan.status === 'completed' && scan.title ? (
          <Link
            href={`/radars/${radarUuid}/scans/${scan.uuid}`}
            className="block truncate text-sm font-medium hover:underline"
          >
            {scan.title}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="align-top">
        <Badge variant="outline">
          {scan.triggered_by === 'manual' ? 'Manual' : 'Schedule'}
        </Badge>
      </TableCell>
      <TableCell className="align-top text-sm whitespace-nowrap text-muted-foreground">
        {formatDistanceToNow(new Date(startedAt), { addSuffix: true })}
      </TableCell>
      <TableCell className="align-top text-sm whitespace-nowrap text-muted-foreground">
        {scan.duration_ms !== null ? `${Math.round(scan.duration_ms / 1000)}s` : '—'}
      </TableCell>
    </TableRow>
  );
}

/**
 * Audit view: every scan attempt for this radar — including failures and
 * no-balance skips with their error detail — newest first.
 */
export default function ScanLogPage({ params }: ScanLogPageProps) {
  const { radarUuid } = use(params);

  const radarQuery = useRadar(radarUuid);
  const radar = radarQuery.data?.data;
  const scansQuery = useRadarScans(radarUuid, {});
  const scans = scansQuery.data?.pages.flatMap((page) => page.data) ?? [];

  const setOverride = useBreadcrumbStore((state) => state.setOverride);
  const clearOverride = useBreadcrumbStore((state) => state.clearOverride);

  useEffect(() => {
    if (radar?.name) setOverride(radarUuid, radar.name);
    return () => clearOverride(radarUuid);
  }, [radarUuid, radar?.name, setOverride, clearOverride]);

  const { ref: loadMoreRef, isIntersecting } = useIntersectionObserver();
  useEffect(() => {
    if (isIntersecting && scansQuery.hasNextPage && !scansQuery.isFetchingNextPage) {
      scansQuery.fetchNextPage();
    }
  }, [isIntersecting, scansQuery]);

  const renderContent = () => {
    if (scansQuery.isLoading) {
      return <ScanRowSkeleton />;
    }
    if (scansQuery.isError) {
      return (
        <ErrorState
          title="Failed to load scan log"
          description="Please try again."
          retry={() => scansQuery.refetch()}
        />
      );
    }
    if (scans.length === 0) {
      return (
        <EmptyState
          icon={ListChecks}
          title="No scans yet"
          description="Every scan attempt — including failures and skips — is logged here."
        />
      );
    }
    return (
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Report</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scans.map((scan) => (
              <ScanLogRow key={scan.uuid} radarUuid={radarUuid} scan={scan} />
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Scan log"
        description={
          radar
            ? `Every scan attempt for "${radar.name}", including failures and skips`
            : 'Every scan attempt, including failures and skips'
        }
      />
      {renderContent()}
      <div ref={loadMoreRef} className="flex justify-center py-2">
        {scansQuery.isFetchingNextPage && (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        )}
      </div>
    </PageContainer>
  );
}
