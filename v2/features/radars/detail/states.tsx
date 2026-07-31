'use client';

import Link from 'next/link';
import {
  Archive,
  CheckCircle2,
  FileSearch,
  ListChecks,
  Radar as RadarIcon,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
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

/** One scan-row silhouette (dot + title / meta line + menu stub). */
export function ScanRowSkeleton({ still = false }: { still?: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div className="flex items-center gap-3 px-2 py-3">
      <Skeleton className={cn('size-2 shrink-0 rounded-full', bar)} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className={cn('h-4 w-3/5 rounded', bar)} />
        <Skeleton className={cn('h-3 w-2/5 rounded', bar)} />
      </div>
      <Skeleton className={cn('size-8 shrink-0 rounded-full', bar)} />
    </div>
  );
}

/** The scan list's initial-load skeleton — progressive fade down the stack. */
export function ScanListSkeleton({
  rows = 4,
  still = false,
}: {
  rows?: number;
  still?: boolean;
}) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.2) }}>
          <ScanRowSkeleton still={still} />
        </div>
      ))}
    </div>
  );
}

/** The whole-page skeleton: header block → tabs → rows, at real geometry. */
export function RadarDetailSkeleton({ still = false }: { still?: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div aria-hidden className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 border-b border-border/60 pb-5">
        <Skeleton className={cn('h-3 w-24 rounded', bar)} />
        <Skeleton className={cn('h-7 w-3/5 rounded-lg', bar)} />
        <Skeleton className={cn('h-3.5 w-4/5 rounded', bar)} />
        <div className="flex gap-2 pt-1">
          <Skeleton className={cn('h-9 w-28 rounded-full', bar)} />
          <Skeleton className={cn('size-9 rounded-full', bar)} />
        </div>
      </div>
      <Skeleton className={cn('h-9 w-80 max-w-full rounded-full', bar)} />
      <ScanListSkeleton still={still} />
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
