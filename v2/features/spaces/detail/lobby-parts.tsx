'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * lobby-parts — the two pieces of furniture the space lobby's regions share:
 * the column it is laid out in, and the section heading every block wears.
 *
 * The lobby is NOT a list page, so it does not take `LIST_COLUMN`. A list is
 * one stack of rows and reads best at `max-w-3xl`; a lobby is an identity block
 * over a digest that wants a second column on a wide screen, and it sits beside
 * a 240px rail that has already taken its share of the viewport. `xl:` rather
 * than `lg:` is where the split happens for exactly that reason — at 1024px the
 * pane is only 784px wide, and a 288px aside would leave the main column
 * narrower than the rows inside it want to be.
 */
export const SPACE_LOBBY_COLUMN =
  'mx-auto w-full max-w-5xl px-4 pb-16 pt-5 sm:pt-6';

/** The lobby's two-column grid: the digest, then the facts about the place. */
export const SPACE_LOBBY_GRID =
  'mt-6 grid gap-x-8 gap-y-6 xl:grid-cols-[minmax(0,1fr)_18rem]';

/**
 * One region of the lobby. The heading is a real `h2` and the count beside it
 * is a WORDED fact ("12 channels"), never a bare numeral — in this product a
 * loose number next to a gold badge would be read as a second badge, and a
 * number is only ever mentions.
 */
export function LobbySection({
  title,
  meta,
  action,
  children,
  className,
}: {
  title: string;
  /** A worded fact under the heading. Omitted while it is unknown. */
  meta?: string | null;
  /** The one control this region owns, right-aligned against the heading. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('min-w-0', className)}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
          {meta ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** A labelled fact in the About region — a definition list row, because that
 *  is what it is: a term and the space's answer to it. */
export function LobbyFact({
  term,
  children,
}: {
  term: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-xs text-muted-foreground">{term}</dt>
      <dd className="min-w-0 truncate text-right text-xs text-foreground">
        {children}
      </dd>
    </div>
  );
}

/** The About region's reserved shape — four fact rows at their real height. */
export function LobbyFactsSkeleton({ still = false }: { still?: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div aria-hidden className="flex flex-col">
      {['w-16', 'w-20', 'w-14', 'w-24'].map((width) => (
        <div key={width} className="flex items-center justify-between gap-3 py-1.5">
          <Skeleton className={cn('h-3 w-14 rounded', bar)} />
          <Skeleton className={cn('h-3 rounded', width, bar)} />
        </div>
      ))}
    </div>
  );
}

/**
 * The People region's reserved shape — 32px rows at the live block's exact
 * geometry, plus the trailing button.
 *
 * IT LIVES HERE SO BOTH USERS SHARE IT. The route fallback used to reserve one
 * 28px pill where the live block draws several rows and a button, so the swap
 * moved everything below it by about 170px — while the file's own docblock
 * promised nothing moves. One component, two callers, no way to drift.
 */
export function LobbyPeopleSkeleton({
  rows = 3,
  still = false,
}: {
  rows?: number;
  still?: boolean;
}) {
  const bar = still ? 'animate-none' : undefined;
  const widths = ['w-24', 'w-20', 'w-28', 'w-24', 'w-16'];
  return (
    <div aria-hidden className="flex flex-col">
      {widths.slice(0, rows).map((width, index) => (
        <div
          key={width}
          className="flex items-center gap-2 py-1"
          style={{ opacity: Math.max(0.3, 1 - index * 0.2) }}
        >
          <Skeleton className={cn('size-6 shrink-0 rounded-full', bar)} />
          <Skeleton className={cn('h-3 rounded', width, bar)} />
        </div>
      ))}
      {/* The "See all" / "Manage people" button below the list. */}
      <Skeleton className={cn('mt-1 h-8 w-32 rounded-md', bar)} />
    </div>
  );
}
