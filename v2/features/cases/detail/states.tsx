'use client';

import Link from 'next/link';
import { ArrowUpRight, Lock, Scale, WifiOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { CaseViewLimitError } from '@/types/case';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { formatCaseDate } from '../case-row-model';

/** The reading column every case surface shares — heading, document, states. */
export const CASE_COLUMN = 'mx-auto w-full max-w-3xl px-4 pb-24 pt-5 sm:pt-8';

/**
 * The case-page skeleton: the document's real geometry — heading block, action
 * row, and a few paragraphs of body — so the hand-off to the real case moves
 * nothing.
 *
 * `still` drops the pulse for a route fallback, where nothing is in flight
 * behind the shape (standards §8i).
 */
export function CaseDocumentSkeleton({ still = false }: { still?: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div aria-hidden className="flex flex-col gap-9">
      {/* The header silhouette: kicker · name · citation · topic · outcome ·
          actions. */}
      <div className="flex flex-col gap-3 border-b border-border/60 pb-6">
        <Skeleton className={cn('h-3 w-48 rounded', bar)} />
        <Skeleton className={cn('h-8 w-4/5 rounded-lg md:h-9', bar)} />
        <Skeleton className={cn('h-3.5 w-2/5 rounded', bar)} />
        <Skeleton className={cn('h-4 w-3/5 rounded', bar)} />
        <Skeleton className={cn('h-6 w-28 rounded-full', bar)} />
        <div className="flex gap-2">
          <Skeleton className={cn('h-9 w-24 rounded-full', bar)} />
          <Skeleton className={cn('h-9 w-24 rounded-full', bar)} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Skeleton className={cn('h-4 w-32 rounded', bar)} />
        <div className="space-y-2 border-l-2 border-border/60 pl-4">
          <Skeleton className={cn('h-4 w-full rounded', bar)} />
          <Skeleton className={cn('h-4 w-11/12 rounded', bar)} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Skeleton className={cn('h-4 w-28 rounded', bar)} />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton
              key={index}
              className={cn('h-4 rounded', bar)}
              style={{ width: `${[100, 97, 99, 92, 100, 68][index]}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PageState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Scale;
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
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function CaseErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <PageState
      icon={WifiOff}
      title="Couldn't load this case"
      description="Something went wrong while loading the case. Please try again."
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

export function CaseNotFoundState() {
  return (
    <PageState
      icon={Scale}
      title="Case not found"
      description="This case does not exist, or it has been removed from the library."
      action={
        <Button asChild size="sm" variant="outline">
          <Link href="/cases">Browse cases</Link>
        </Button>
      }
    />
  );
}

/**
 * The SOFT limit — the case loaded, but the plan's monthly allowance is spent so
 * the summary is withheld. Everything else on the page (title, court, holding,
 * citations) still renders, which is the difference between a paywall and a
 * dead end: the reader can still tell whether this is the case they wanted.
 *
 * Gold, not red. A limit is an invitation to upgrade, not a failure — the same
 * distinction the composer's block banner draws.
 */
export function ViewLimitNotice({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-5">
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"
      >
        <Lock className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Summary hidden — monthly limit reached
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          {message ||
            'You have used all your case views for this month. Upgrade to keep reading full summaries.'}
        </p>
      </div>
      <Link
        href="/upgrade"
        className={cn(
          'v2-interactive inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
          FOCUS_RING,
        )}
      >
        Upgrade plan
        <ArrowUpRight aria-hidden className="size-4" />
      </Link>
    </div>
  );
}

/**
 * The HARD limit — a 429, so no case data arrived at all. This replaces the page
 * rather than a section of it, and it says the two things a blocked reader needs:
 * how much they have used, and when it resets.
 */
export function CaseHardLimitState({
  limit,
  message,
}: {
  limit: CaseViewLimitError;
  message?: string;
}) {
  const resets = formatCaseDate(limit.resets_at, 'long');

  return (
    <PageState
      icon={Lock}
      title="Monthly view limit reached"
      description={
        message || 'You have used all your case views for this month.'
      }
      action={
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">
            <span className="tabular-nums text-foreground">
              {limit.used} / {limit.plan_limit}
            </span>{' '}
            views used
            {resets ? (
              <>
                {' · '}resets{' '}
                <span className="text-foreground">{resets}</span>
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/cases">Browse cases</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/upgrade">
                Upgrade plan
                <ArrowUpRight aria-hidden className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      }
    />
  );
}
