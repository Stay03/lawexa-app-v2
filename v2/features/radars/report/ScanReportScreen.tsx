'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileSearch, WifiOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError } from '@/lib/utils/api-error';
import { formatScanDuration } from '@/lib/utils/duration';
import { useV2Session } from '@/v2/runtime/session-context';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { IN_FLIGHT_SCAN_STATUSES, radarsQueries } from '../queries';
import { useRadarDetail } from '../naming';
import { agoLabel, exactTime } from '../model';
import { useTriageScan } from '../use-triage-scan';
import { ScanTriageToolbar } from '../detail/triage-actions';
import { ReportMarkdown } from './ReportMarkdown';
import { ReportSources } from './ReportSources';
import { ShareDialog } from './ShareDialog';
import { isOwnerScan, resolveScanViewer } from './viewer';
import './report.css';

/**
 * ScanReportScreen — `/radars/[radarUuid]/scans/[scanUuid]`, the one URL all
 * three viewer classes share (see `viewer.ts` for the classes and their
 * endpoints). Affordances follow the resolved class exactly:
 *
 *  OWNER            triage toolbar (sticky), share dialog, radar back-link,
 *                   Manual badge, view count once published, auto-mark-read.
 *  SIGNED-IN OTHER  the reading surface + radar name (text) + view count —
 *                   the study's fix: v1 accidentally hid the count from this
 *                   class.
 *  PUBLIC / GUEST   the same reading surface off the public endpoint.
 *
 * A RUNNING scan renders the live indicator over a held document silhouette
 * and the query polls itself every 10s until terminal (the leaf's own
 * `refetchInterval` — for the public shape too, so a share link opened
 * mid-scan resolves without a reload). A FAILED scan is an owner-only
 * reality (publishing requires completion), stated with the agent's error.
 */

/** The reading column — the case surfaces' exact measure. */
const REPORT_COLUMN = 'mx-auto w-full max-w-3xl px-4 pb-24 pt-5 sm:pt-8';

const SOURCES_HEADING = '\n## Sources';

/** Drop the markdown's trailing "## Sources" section — the structured,
 *  position-numbered list replaces it. */
function splitReport(report: string): string {
  const index = report.lastIndexOf(SOURCES_HEADING);
  return index === -1 ? report : report.slice(0, index);
}

export function ScanReportScreen({
  radarUuid,
  scanUuid,
}: {
  radarUuid: string;
  scanUuid: string;
}) {
  const { signedIn, userId: viewerId, role } = useV2Session();
  // Which endpoint this session reads — guests hold a token but not an
  // account, so they read the public shape like signed-out visitors.
  const isAccount = signedIn && role !== 'guest';

  const authedQuery = useQuery({
    ...radarsQueries.scanDetail(radarUuid, scanUuid, { viewerId }),
    enabled: isAccount,
  });
  const publicQuery = useQuery({
    ...radarsQueries.publicScan(radarUuid, scanUuid),
    enabled: !isAccount,
  });
  const activeQuery = isAccount ? authedQuery : publicQuery;

  const { view, isOwner, radarName: sharedRadarName } = resolveScanViewer({
    isAccount,
    authedData: authedQuery.data?.data,
    publicData: publicQuery.data?.data,
  });
  const ownerScan = view !== undefined && isOwnerScan(view) ? view : null;

  // The radar detail is owner-only (403s otherwise) — fetch it only once
  // ownership is established; other classes read the trimmed `radar` context.
  const radarQuery = useRadarDetail(radarUuid, isOwner);
  const radarName = isOwner
    ? (radarQuery.data?.data.name ?? null)
    : sharedRadarName;

  const [now] = useState(() => Date.now());

  // Publish the report title to the header centre once it resolves.
  const headerTitle = view ? view.title?.trim() || 'Radar report' : null;
  useEffect(() => {
    if (!headerTitle) return;
    setHeaderContext({ title: headerTitle, confidential: false });
  }, [headerTitle]);
  useEffect(() => () => clearHeaderContext(), []);

  // Opening a completed unread report marks it read exactly once (owner
  // only) — the optimistic engine moves the unread badges everywhere.
  const { mutate: triage } = useTriageScan();
  const hasMarkedRead = useRef(false);
  const shouldMarkRead =
    ownerScan !== null &&
    ownerScan.status === 'completed' &&
    ownerScan.read_at === null;
  useEffect(() => {
    if (!shouldMarkRead || hasMarkedRead.current) return;
    hasMarkedRead.current = true;
    triage({ radarUuid, scanUuid, payload: { read: true } });
  }, [shouldMarkRead, triage, radarUuid, scanUuid]);

  if (activeQuery.isPending) {
    return (
      <div className={cn('v2-radar-report', REPORT_COLUMN)}>
        <ReportSkeleton />
      </div>
    );
  }

  if (activeQuery.isError || !view) {
    const status = activeQuery.error
      ? extractApiError(activeQuery.error).status
      : 0;
    const notFound = status === 403 || status === 404 || !activeQuery.error;
    return (
      <div className={REPORT_COLUMN}>
        {notFound ? (
          <ReportState
            icon={FileSearch}
            title="Report not found"
            description="This report is private or no longer available."
            action={
              // The owner can never reach this branch (an owner's read either
              // resolves or errors as a non-404), so the only two audiences
              // are signed-out visitors and signed-in strangers.
              !signedIn ? (
                <Button asChild size="sm">
                  <Link href="/login">Sign in to view your reports</Link>
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href="/">Go home</Link>
                </Button>
              )
            }
          />
        ) : (
          <ReportState
            icon={WifiOff}
            title="Couldn't load this report"
            description="Something went wrong while loading the report. Please try again."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => void activeQuery.refetch()}
              >
                Try again
              </Button>
            }
          />
        )}
      </div>
    );
  }

  if (IN_FLIGHT_SCAN_STATUSES.has(view.status)) {
    return (
      <div className={cn('v2-radar-report', REPORT_COLUMN)}>
        <div
          role="status"
          className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-sm font-medium text-primary"
        >
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inline-flex size-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          Scan in progress — the report appears here when it completes
        </div>
        <ReportSkeleton still />
      </div>
    );
  }

  if (view.status !== 'completed') {
    return (
      <div className={REPORT_COLUMN}>
        <ReportState
          icon={WifiOff}
          title="Scan failed"
          description={
            ownerScan?.error ?? 'The agent could not complete this scan.'
          }
          action={
            isOwner ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/radars/${radarUuid}`}>Back to radar</Link>
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  const narrative = view.report ? splitReport(view.report) : null;
  const completedAt = view.completed_at ?? view.created_at;
  const when = agoLabel(completedAt, now);
  // The study's fix: a signed-in non-owner sees the count too (the report is
  // published for them to be here at all); the owner sees it once public.
  const showViews = ownerScan === null || !ownerScan.is_private;

  return (
    <div className={cn('v2-radar-report', REPORT_COLUMN)}>
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        {isOwner ? (
          <Link
            href={`/radars/${radarUuid}`}
            className={cn(
              'v2-interactive -ml-2 mb-4 inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full px-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
              FOCUS_RING,
            )}
          >
            <ArrowLeft aria-hidden className="size-4" />
            {radarName ? `Back to ${radarName}` : 'Back to radar'}
          </Link>
        ) : null}

        <article className="flex flex-col gap-7">
          {/* ── Identity: provenance kicker, title, one quiet meta line. ── */}
          <header className="flex flex-col gap-3">
            <p className="report-kicker flex flex-wrap items-center gap-x-2 gap-y-1">
              {radarName ? <span>{radarName}</span> : null}
              {radarName ? (
                <span aria-hidden className="text-muted-foreground/40">
                  ·
                </span>
              ) : null}
              <span>Radar report</span>
            </p>

            <h1 className="report-title text-foreground">
              {view.title?.trim() || 'Untitled report'}
            </h1>

            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {when ? <span title={exactTime(completedAt)}>{when}</span> : null}
              {view.duration_ms !== null ? (
                <>
                  <span aria-hidden className="text-muted-foreground/40">
                    ·
                  </span>
                  <span className="tabular-nums">
                    {formatScanDuration(view.duration_ms)} scan
                  </span>
                </>
              ) : null}
              {showViews ? (
                <>
                  <span aria-hidden className="text-muted-foreground/40">
                    ·
                  </span>
                  <span className="tabular-nums">
                    {view.views_count}{' '}
                    {view.views_count === 1 ? 'view' : 'views'}
                  </span>
                </>
              ) : null}
              {ownerScan?.triggered_by === 'manual' ? (
                <span className="inline-flex min-h-5 items-center rounded-full border border-border px-2 text-[11px] font-medium">
                  Manual
                </span>
              ) : null}
              {!view.has_findings ? (
                <span className="inline-flex min-h-5 items-center rounded-full bg-secondary px-2 text-[11px] font-medium text-muted-foreground">
                  No change
                </span>
              ) : null}
            </p>
          </header>

          {/* ── The owner's working toolbar, riding the scroll. ─────────── */}
          {ownerScan ? (
            <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2 border-b border-border/60 bg-background/95 px-1 py-2 backdrop-blur">
              <ScanTriageToolbar radarUuid={radarUuid} scan={ownerScan} />
              <div className="flex-1" />
              <ShareDialog radarUuid={radarUuid} scan={ownerScan} />
            </div>
          ) : null}

          {/* ── The report, in the reading voice. ───────────────────────── */}
          {narrative?.trim() ? (
            <ReportMarkdown content={narrative} />
          ) : (
            <p className="text-sm text-muted-foreground">
              This scan completed without a written report.
            </p>
          )}

          <ReportSources sources={view.sources} />
        </article>
      </div>
    </div>
  );
}

/** The report silhouette: kicker, title, meta, toolbar band, prose bars. */
export function ReportSkeleton({ still = false }: { still?: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div aria-hidden className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <Skeleton className={cn('h-3 w-40 rounded', bar)} />
        <Skeleton className={cn('h-7 w-4/5 rounded-lg', bar)} />
        <Skeleton className={cn('h-3 w-56 rounded', bar)} />
      </div>
      <Skeleton className={cn('h-10 w-full rounded-lg', bar)} />
      <div className="space-y-2.5">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn('h-4 rounded', bar)}
            style={{ width: `${[100, 96, 99, 90, 100, 97, 62][index]}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function ReportState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof FileSearch;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"
      >
        <Icon className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

/** The route fallback — the report silhouette, held still. */
export function ReportFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading report
      </span>
      <div aria-hidden inert className={cn('v2-radar-report', REPORT_COLUMN)}>
        <ReportSkeleton still />
      </div>
    </>
  );
}
