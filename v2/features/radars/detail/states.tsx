'use client';

import Link from 'next/link';
import {
  Archive,
  CheckCircle2,
  FileSearch,
  ListChecks,
  Radar as RadarIcon,
  TriangleAlert,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/** The detail's workflow views — the study's tab set, with the scan log
 *  folded in as "All activity" (owner decision D3). */
export type RadarDetailTab = 'inbox' | 'completed' | 'archived' | 'activity';

/**
 * The radar-detail page states. Skeleton at the REAL geometry (header block →
 * tab strip → scan rows), error distinct from empty with a retry, a not-found
 * that says the two true causes, and one empty state per workflow tab.
 */

function PageState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
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

/**
 * ScanGapNotice — the LOUD failure banner (owner decision, August 3 2026).
 *
 * A radar's whole promise is "you are covered without looking", so a failure
 * used to be the one event this page kept quietest: failed scans render only
 * under "All activity", and a radar could fail for days while its owner
 * believed they were covered. This banner is the correction: whenever the
 * NEWEST scan ended without running (failed, or skipped because the account
 * was out of scan credit), the radar says so above its inbox, on every tab.
 *
 * It disappears on its own the moment a newer scan exists — including the
 * retry the user just dispatched, since an in-flight newest scan is by
 * definition not a failed newest scan. When the radar is PAUSED the copy stops
 * promising a retry that will never fire and says what to do instead.
 */
export function ScanGapNotice({
  status,
  when,
  radarPaused,
}: {
  status: 'failed' | 'skipped_no_balance';
  /** `agoLabel` of the failed run, or '' when the timestamp is absent. */
  when: string;
  radarPaused: boolean;
}) {
  const title =
    status === 'failed'
      ? 'The last scan could not run.'
      : 'The last scan was skipped.';
  const cause =
    status === 'failed'
      ? `Something went wrong${when ? ` ${when}` : ''}.`
      : `Your account was out of scan credit${when ? ` ${when}` : ''}.`;
  const onward = radarPaused
    ? 'This radar is paused, so nothing will retry until you resume it.'
    : status === 'failed'
      ? 'The next try runs on schedule — or use Scan now.'
      : 'Scans continue on schedule once credit is available.';

  return (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <TriangleAlert
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-destructive"
      />
      <div className="space-y-0.5 text-sm">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-muted-foreground">
          {cause} {onward}
        </p>
      </div>
    </div>
  );
}

/** One scan-row silhouette (dot + title / two-zone meta line + menu stub) —
 *  the resolved row right-anchors its clock facts, so the short meta bar sits
 *  at the text block's right edge here too. */
export function ScanRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-2 py-3">
      <Skeleton className="size-2 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-3/5 rounded" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-1/5 rounded" />
          <Skeleton className="ml-auto h-3 w-16 shrink-0 rounded" />
        </div>
      </div>
      <Skeleton className="size-8 shrink-0 rounded-full" />
    </div>
  );
}

/** The scan list's initial-load skeleton — progressive fade down the stack. */
export function ScanListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.2) }}>
          <ScanRowSkeleton />
        </div>
      ))}
    </div>
  );
}

/**
 * The whole-page skeleton: header block → tabs → rows, at real geometry.
 *
 * It pulses in every caller, the route fallback included. A wait is a wait: the
 * reader cannot tell an RSC payload from a query, so two appearances for one
 * load would only read as the loading starting over.
 */
export function RadarDetailSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 border-b border-border/60 pb-5">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-7 w-3/5 rounded-lg" />
        <Skeleton className="h-3.5 w-4/5 rounded" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="size-9 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-9 w-80 max-w-full rounded-full" />
      <ScanListSkeleton />
    </div>
  );
}

export function RadarErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <PageState
      icon={WifiOff}
      title="Couldn't load this radar"
      description="Something went wrong while loading the radar. Please try again."
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

export function RadarNotFoundState() {
  return (
    <PageState
      icon={RadarIcon}
      title="Radar not found"
      description="It may have been archived, or it belongs to another account."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/radars">Back to radars</Link>
        </Button>
      }
    />
  );
}

export function ScanListErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <PageState
      icon={WifiOff}
      title="Couldn't load reports"
      description="Something went wrong while loading this radar's reports. Please try again."
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

/** Per-tab empty copy. The inbox empty offers the one action that fills it. */
export function ScanListEmptyState({
  tab,
  onScanNow,
}: {
  tab: RadarDetailTab;
  /** Present only when a scan can actually be dispatched right now. */
  onScanNow?: () => void;
}) {
  switch (tab) {
    case 'inbox':
      return (
        <PageState
          icon={FileSearch}
          title="No reports yet"
          description="Your first report lands after the next scheduled scan — or run one now."
          action={
            onScanNow ? (
              <Button size="sm" onClick={onScanNow}>
                Scan now
              </Button>
            ) : undefined
          }
        />
      );
    case 'completed':
      return (
        <PageState
          icon={CheckCircle2}
          title="Nothing completed"
          description="Reports you mark complete move here."
        />
      );
    case 'archived':
      return (
        <PageState
          icon={Archive}
          title="Nothing archived"
          description="Reports you archive move here."
        />
      );
    case 'activity':
      return (
        <PageState
          icon={ListChecks}
          title="No scans yet"
          description="Every scan attempt — including failures and skips — is logged here."
        />
      );
  }
}
