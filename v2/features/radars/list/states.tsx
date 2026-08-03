'use client';

import Link from 'next/link';
import {
  CalendarClock,
  FileSearch,
  Inbox,
  Radar as RadarIcon,
  Sparkles,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { RadarStatus } from '@/types/radar';

/**
 * The `/radars` page states — the standards §8iv three-state contract: a
 * skeleton at the real row geometry, an error visually distinct from empty
 * with a live retry, and designed empty states that always offer the next
 * action. The FIRST-RUN empty state carries the feature's pitch: a user who
 * has never made a radar lands here, so this is where the product explains
 * what one is.
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

/**
 * One skeleton row, shaped exactly like `RadarRow` (dot + name / meta line) —
 * including the meta line's TWO ZONES: the schedule bar on the left and a
 * right-anchored bar for the clock facts.
 */
function RadarRowSkeleton({ still = false }: { still?: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div className="flex items-start gap-2 px-2 py-3.5">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className={cn('size-2 shrink-0 rounded-full', bar)} />
          <Skeleton className={cn('h-4 w-1/2 rounded', bar)} />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className={cn('h-3 w-1/3 rounded', bar)} />
          <Skeleton className={cn('ml-auto h-3 w-24 shrink-0 rounded', bar)} />
        </div>
      </div>
      <Skeleton className={cn('mt-1 size-8 shrink-0 rounded-full', bar)} />
    </div>
  );
}

/** The initial-load skeleton — progressive opacity down the stack, the one
 *  loading language every v2 list surface speaks. `still` for route
 *  fallbacks, where no request is in flight behind the shape. */
export function RadarListSkeleton({
  rows = 5,
  still = false,
}: {
  rows?: number;
  still?: boolean;
}) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.16) }}>
          <RadarRowSkeleton still={still} />
        </div>
      ))}
    </div>
  );
}

/** The next-page skeleton shown at the sentinel while a page is in flight. */
export function RadarNextPageSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      <RadarRowSkeleton />
      <div style={{ opacity: 0.5 }}>
        <RadarRowSkeleton />
      </div>
    </div>
  );
}

/**
 * First-run empty (Active tab, nothing anywhere): the pitch. Three concrete
 * lines of what a radar does, then the create path — a reader should leave
 * this state knowing whether the feature is for them.
 */
export function RadarsFirstRunState() {
  return (
    <div className="flex flex-col items-center gap-5 px-6 py-14 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <span
        aria-hidden
        className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
      >
        <RadarIcon className="size-7" />
      </span>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">
          Put the law on your radar
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          A radar is a saved watch: tell it the jurisdictions and topics that
          matter to you, and an AI agent scans on your schedule and files a
          sourced report every time something moves.
        </p>
      </div>
      <ul className="flex flex-col items-start gap-2 text-sm text-muted-foreground">
        <li className="flex items-center gap-2.5">
          <CalendarClock aria-hidden className="size-4 shrink-0 text-primary" />
          Runs on your schedule — daily, weekly, or your own cadence
        </li>
        <li className="flex items-center gap-2.5">
          <FileSearch aria-hidden className="size-4 shrink-0 text-primary" />
          Every report cites its sources, ready to share
        </li>
        <li className="flex items-center gap-2.5">
          <Sparkles aria-hidden className="size-4 shrink-0 text-primary" />
          Quiet weeks stay quiet — no findings, no noise
        </li>
      </ul>
      {/* "Create a radar", not "your first": this state also serves a user
          whose radars are all paused or archived. */}
      <Button asChild size="sm">
        <Link href="/radars/new">Create a radar</Link>
      </Button>
    </div>
  );
}

/** Per-tab empty copy for the non-first-run cases. */
export function RadarsEmptyState({ status }: { status: RadarStatus }) {
  if (status === 'paused') {
    return (
      <PageState
        icon={Inbox}
        title="No paused radars"
        description="Radars you pause appear here until you resume them."
      />
    );
  }
  return (
    <PageState
      icon={Inbox}
      title="No archived radars"
      description="Archived radars stop scanning permanently, but their past reports stay readable here."
    />
  );
}

/** Error state — visually distinct from empty, with a real retry. */
export function RadarsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <PageState
      icon={WifiOff}
      title="Couldn't load your radars"
      description="Something went wrong while loading your radars. Please try again."
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

/** Signed-out state — the queries are gated off, so this replaces a 401. */
export function RadarsSignedOutState() {
  return (
    <PageState
      icon={RadarIcon}
      title="Sign in to use Radar"
      description="Radar watches the law for you and files scheduled reports — sign in to see yours."
      action={
        <Button asChild size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      }
    />
  );
}

/**
 * Guest state — a guest session holds a token, but radar is an account
 * feature (scans debit the plan's AI messages, which guests don't have).
 * Guests are view-only pre-registration, so the path forward is an account.
 */
export function RadarsGuestState() {
  return (
    <PageState
      icon={RadarIcon}
      title="Radar needs an account"
      description="Scheduled scans use your plan's AI messages, so Radar is available once you create an account."
      action={
        <Button asChild size="sm">
          <Link href="/register">Create an account</Link>
        </Button>
      }
    />
  );
}
