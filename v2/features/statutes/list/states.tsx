'use client';

import Link from 'next/link';
import { Landmark, SearchX, WifiOff, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The `/statutes` page states — the same three-state contract every v2 query
 * region owns (standards §8iv): a skeleton at the region's real geometry, an
 * error that is visually DISTINCT from empty with a real retry, and a designed
 * empty state that always prompts an action. Mirrors the cases-list states so
 * the two library surfaces speak one loading language.
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
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

/**
 * One skeleton row, shaped exactly like `StatuteRow` (title / meta / clamp) —
 * including the meta line's TWO ZONES: a lead bar on the left and a short,
 * right-anchored bar for the year + status, so the silhouette settles onto the
 * resolved row rather than sliding a bar across it.
 */
function StatuteRowSkeleton({ still = false }: { still?: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div className="flex items-start gap-2 px-2 py-3">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className={cn('h-4 w-1/2 rounded', bar)} />
        <div className="flex items-center gap-2">
          <Skeleton className={cn('h-3 w-2/5 rounded', bar)} />
          <Skeleton className={cn('ml-auto h-3 w-20 shrink-0 rounded', bar)} />
        </div>
        <div className="space-y-1 pt-0.5">
          <Skeleton className={cn('h-3.5 w-full rounded', bar)} />
          <Skeleton className={cn('h-3.5 w-3/4 rounded', bar)} />
        </div>
      </div>
      <Skeleton className={cn('mt-2 size-9 shrink-0 rounded-full', bar)} />
    </div>
  );
}

/**
 * The initial-load skeleton — six rows with progressive opacity down the
 * stack, the shared v2 list fade. `still` drops the pulse for a route
 * fallback, where nothing is in flight behind the shape (standards §8i).
 */
export function StatutesListSkeleton({
  rows = 6,
  still = false,
}: {
  rows?: number;
  still?: boolean;
}) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.14) }}>
          <StatuteRowSkeleton still={still} />
        </div>
      ))}
    </div>
  );
}

/** The next-page skeleton shown at the sentinel while a page is in flight. */
export function NextPageSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      <StatuteRowSkeleton />
      <div style={{ opacity: 0.5 }}>
        <StatuteRowSkeleton />
      </div>
    </div>
  );
}

/** Search-aware empty state. */
export function StatutesEmptyState({
  search,
  countryName,
  onClear,
}: {
  search: string;
  /** The active country tab's name, when one is filtering the library. */
  countryName: string | null;
  onClear: () => void;
}) {
  if (search || countryName) {
    return (
      <PageState
        icon={SearchX}
        title="No statutes found"
        description={
          search && countryName
            ? `No ${countryName} statutes match “${search}”. Try a different search term, or search all countries.`
            : search
              ? `No statutes match “${search}”. Try a different search term.`
              : `No statutes from ${countryName} yet.`
        }
        action={
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        }
      />
    );
  }

  return (
    <PageState
      icon={Landmark}
      title="No statutes yet"
      description="Statutes appear here as they are added to the library."
    />
  );
}

/**
 * Signed-out state — the query is gated off, so this replaces a 401 error.
 * MEASURED July 31, 2026: `GET /api/statutes` answers **401** with no bearer
 * token (a guest token reads it; no token does not). Same reasoning as the
 * cases list's signed-out state.
 */
export function StatutesSignedOutState() {
  return (
    <PageState
      icon={Landmark}
      title="Sign in to browse statutes"
      description="The statute library is available once you're signed in."
      action={
        <Button asChild size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      }
    />
  );
}

/** Error state — visually distinct from empty, with a real retry. */
export function StatutesErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <PageState
      icon={WifiOff}
      title="Couldn't load statutes"
      description="Something went wrong while loading the statute library. Please try again."
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}
