'use client';

import Link from 'next/link';
import { Clock, Landmark, WifiOff, X, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/** The reading column every statute surface shares — heading, document, states. */
export const STATUTE_COLUMN = 'mx-auto w-full max-w-3xl px-4 pb-24 pt-5 sm:pt-8';

/**
 * The reader skeleton at the document's real geometry: breadcrumb line,
 * kicker, title, designation, status pill, actions row, then a part heading
 * and a few numbered provisions. `still` drops the pulse for a route
 * fallback, where nothing is in flight behind the shape (standards §8i).
 */
export function StatuteDocumentSkeleton({ still = false }: { still?: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div aria-hidden className="flex flex-col gap-9">
      {/* Header silhouette. */}
      <div className="flex flex-col gap-3 border-b border-border/60 pb-6">
        <Skeleton className={cn('h-3 w-20 rounded', bar)} />
        <Skeleton className={cn('h-3 w-44 rounded', bar)} />
        <Skeleton className={cn('h-8 w-3/4 rounded-lg md:h-9', bar)} />
        <Skeleton className={cn('h-3.5 w-24 rounded', bar)} />
        <Skeleton className={cn('h-6 w-24 rounded-full', bar)} />
        <div className="flex gap-2">
          <Skeleton className={cn('h-9 w-28 rounded-full', bar)} />
          <Skeleton className={cn('h-9 w-24 rounded-full', bar)} />
        </div>
      </div>

      {/* Long-title silhouette. */}
      <div className="space-y-2">
        <Skeleton className={cn('h-4 w-full rounded', bar)} />
        <Skeleton className={cn('h-4 w-5/6 rounded', bar)} />
      </div>

      {/* Part heading + provisions silhouette. */}
      <div className="flex flex-col gap-3">
        <Skeleton className={cn('h-3 w-16 rounded', bar)} />
        <Skeleton className={cn('h-5 w-1/2 rounded', bar)} />
        <div className="space-y-4 pt-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className={cn('mt-1 h-3 w-7 shrink-0 rounded', bar)} />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className={cn('h-4 w-full rounded', bar)} />
                <Skeleton
                  className={cn('h-4 rounded', bar)}
                  style={{ width: `${[92, 100, 78][i]}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The tail shown UNDER already-mounted blocks while the rest of a big
 * document mounts progressively — in-flight work, so it pulses; it never
 * replaces text already on screen.
 */
export function DocumentMountingTail() {
  return (
    <div aria-hidden className="mt-8 space-y-3">
      {[1, 0.7, 0.4].map((opacity, index) => (
        <div key={index} style={{ opacity }} className="flex gap-4">
          <Skeleton className="mt-1 h-3 w-7 shrink-0 rounded" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-4/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

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
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

/**
 * True when an error is the statute endpoints' rate limit (429). Those
 * endpoints are throttled server-side; the copy must say "slow down", not
 * blame the network.
 */
export function isRateLimited(error: unknown): boolean {
  return (
    (error as { response?: { status?: number } } | null)?.response?.status === 429
  );
}

/**
 * True when an error is a 404 — a dead or removed slug. That is a FACT, not a
 * failure: it must land on the not-found state, never on an error state whose
 * "Try again" can never succeed.
 */
export function isNotFound(error: unknown): boolean {
  return (
    (error as { response?: { status?: number } } | null)?.response?.status === 404
  );
}

export function StatuteRateLimitState({ onRetry }: { onRetry: () => void }) {
  return (
    <PageState
      icon={Clock}
      title="Too many requests"
      description="You are opening statutes very quickly. Wait a moment, then try again."
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

export function StatuteErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <PageState
      icon={WifiOff}
      title="Couldn't load this statute"
      description="Something went wrong while loading the statute. Please try again."
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

export function StatuteNotFoundState() {
  return (
    <PageState
      icon={Landmark}
      title="Statute not found"
      description="This statute does not exist, or it has been removed from the library."
      action={
        <Button asChild size="sm" variant="outline">
          <Link href="/statutes">Browse statutes</Link>
        </Button>
      }
    />
  );
}

/** The signed-out gate — same measured fact as the list (401 without a token). */
export function StatuteSignedOutState() {
  return (
    <PageState
      icon={Landmark}
      title="Sign in to read this statute"
      description="Statute texts are available once you're signed in."
      action={
        <Button asChild size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      }
    />
  );
}

/* ── Document-region states (the header stays; only the text area swaps) ── */

function DocState({
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
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-border/60 bg-secondary/30 px-4 py-5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground"
      >
        <Icon className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

/** The document region's error — the header above it keeps identifying the Act. */
export function DocumentErrorState({
  rateLimited,
  onRetry,
}: {
  rateLimited: boolean;
  onRetry: () => void;
}) {
  return (
    <DocState
      icon={rateLimited ? Clock : WifiOff}
      title={rateLimited ? 'Too many requests' : "Couldn't load the text"}
      description={
        rateLimited
          ? 'You are opening statutes very quickly. Wait a moment, then try again.'
          : "Something went wrong while loading this statute's text. Please try again."
      }
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

/** The XML arrived but did not parse — a data problem, not a network one. */
export function DocumentUnreadableState() {
  return (
    <DocState
      icon={Landmark}
      title="This text can't be displayed"
      description="The document we hold for this statute could not be read. Please check back later."
    />
  );
}

/** A statute with no body yet — honest empty, not an error. */
export function DocumentEmptyState() {
  return (
    <DocState
      icon={Landmark}
      title="No text yet"
      description="The full text of this statute hasn't been added to the library yet."
    />
  );
}

/**
 * The quiet word when a citation link (`/statutes/{slug}/section-…`) points
 * at a provision this document does not have. NOT a toast (a toast leaves
 * before a reader who is scanning the text ever looks up) and NOT an alert
 * wall (the statute rendered fine — nothing failed): a slim dismissible pill,
 * sticky at the top of the reading column so it is still there when the miss
 * landed the reader mid-document (the subsection-fallback case). `role=
 * "status"` announces it politely; dismissal is instant — nothing to watch
 * leave.
 */
export function ProvisionNotice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="pointer-events-none sticky top-3 z-10 flex justify-center">
      <div
        role="status"
        className="pointer-events-auto flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-border bg-background/95 py-1 pl-4 pr-1.5 shadow-md backdrop-blur motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-300"
      >
        <span className="min-w-0 text-xs text-muted-foreground">{message}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn(
            'v2-interactive flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
            FOCUS_RING,
          )}
        >
          <X aria-hidden className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
