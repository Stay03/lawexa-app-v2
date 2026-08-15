'use client';

import Link from 'next/link';
import { FileQuestion, Scale, SearchX, TrendingUp, WifiOff, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The `/cases` page states. Same three-state contract every v2 query region
 * owns (standards §8iv): a skeleton at the region's real geometry, an error that
 * is visually DISTINCT from empty and offers a real retry, and a designed empty
 * state that always prompts an action.
 *
 * Rebuilt v2-native rather than reusing v1's `EmptyState` / `ErrorState`: those
 * live in `components/`, which the v2 import boundary blocks.
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
 * One skeleton row, shaped exactly like `CaseRow` (title / meta / two-line
 * holding) — including the meta line's TWO ZONES: a lead bar on the left and a
 * short, right-anchored bar for the judgment date, so the silhouette settles
 * onto the resolved row instead of sliding a bar across it.
 */
function CaseRowSkeleton() {
  return (
    <div className="flex items-start gap-2 px-2 py-3">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-3/5 rounded" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-2/5 rounded" />
          <Skeleton className="ml-auto h-3 w-16 shrink-0 rounded" />
        </div>
        <div className="space-y-1 pt-0.5">
          <Skeleton className="h-3.5 w-full rounded" />
          <Skeleton className="h-3.5 w-4/5 rounded" />
        </div>
      </div>
      <Skeleton className="mt-2 size-9 shrink-0 rounded-full" />
    </div>
  );
}

/**
 * The initial-load skeleton. Six rows with progressive opacity down the stack —
 * the same fade the conversations list uses, so a reader moving between the two
 * list surfaces sees one loading language rather than two.
 *
 * It pulses in every caller, route fallback included (standards §8i). A wait is
 * a wait: the reader cannot tell an RSC payload from a query, so showing them
 * two different appearances only prints a seam into the middle of the load.
 */
export function CasesListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.14) }}>
          <CaseRowSkeleton />
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
      <CaseRowSkeleton />
      <div style={{ opacity: 0.5 }}>
        <CaseRowSkeleton />
      </div>
    </div>
  );
}

/**
 * Search-aware empty state.
 *
 * The "request this content" path is the honest answer to a search that found
 * nothing: the library is finite, so "no results" is often "we do not have it
 * yet" rather than "you searched wrong". v1 offered it in two places on the same
 * screen; here it is offered once, where the reader actually needs it.
 */
export function CasesEmptyState({
  search,
  tag,
  onClear,
  onRequest,
}: {
  search: string;
  tag: string;
  onClear: () => void;
  /** Absent for guests — a content request needs an account. */
  onRequest?: () => void;
}) {
  if (search || tag) {
    return (
      <PageState
        icon={SearchX}
        title="No cases found"
        description={
          tag
            ? `No cases are tagged “${tag}”.`
            : `No cases match “${search}”. Try a different search term.`
        }
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={onClear}>
              Clear filters
            </Button>
            {onRequest ? (
              <Button variant="ghost" size="sm" onClick={onRequest}>
                <FileQuestion aria-hidden className="size-4" />
                Request this case
              </Button>
            ) : null}
          </div>
        }
      />
    );
  }

  return (
    <PageState
      icon={Scale}
      title="No cases yet"
      description="Cases appear here as they are added to the library."
    />
  );
}

/** Trending has its own empty copy — it is a ranking, not a filtered library. */
export function TrendingEmptyState() {
  return (
    <PageState
      icon={TrendingUp}
      title="Nothing trending yet"
      description="Cases appear here once people start reading them."
    />
  );
}

/**
 * Signed-out state — the query is gated off, so this replaces a 401 error.
 *
 * MEASURED, not assumed (July 25, 2026): `GET /api/cases` answers **401** with
 * no bearer token. v1 never shows that because it silently mints a GUEST token
 * for every visitor (`useGuestAuth`); v2 has no equivalent yet, so a v2 session
 * with no token would otherwise land on "Couldn't load cases", which blames the
 * network for an auth wall. This says the true thing instead.
 */
export function CasesSignedOutState() {
  return (
    <PageState
      icon={Scale}
      title="Sign in to browse cases"
      description="The case library is available once you're signed in."
      action={
        <Button asChild size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      }
    />
  );
}

/** Error state — visually distinct from empty, with a real retry. */
export function CasesErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <PageState
      icon={WifiOff}
      title="Couldn't load cases"
      description="Something went wrong while loading the case library. Please try again."
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}
