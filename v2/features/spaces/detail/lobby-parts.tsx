'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * lobby-parts — the pieces of furniture the space page's regions share: the
 * column it is laid out in, the pill bar's box, and the section heading every
 * block wears.
 *
 * ── ONE COLUMN (design round 1, 12 October 2026; B4, 17 October 2026) ──────
 * A space is a stack of rows (its conversations, files and folders) and takes
 * the list column, `max-w-3xl`, the width the `/spaces` list and the
 * Conversations and Folders screens use, so going from the list into a space
 * moves nothing sideways. The wider lobby column went with the Channels tab.
 *
 * A full-height flex column, so the docked box sits at the bottom of the pane
 * when the list is short (`SpaceChatDock`'s `mt-auto`).
 */
export const SPACE_PAGE_COLUMN =
  'mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pb-16 pt-5 sm:pt-6';

/** The Tasks pill's column: the board's stage columns need the pane's width
 *  on a computer (Stay's B, 29 October 2026, 00:45Z). The same column, wider. */
export const SPACE_BOARD_COLUMN =
  'mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 pb-16 pt-5 sm:pt-6';

/** The pills and search held at the top of the pane: stacked on a phone, one
 *  row from `md:`. Shared by the live home and its silhouette, so the
 *  hand-off moves nothing. `-mx-4 px-4` runs its rule and ground to the
 *  column's edges, so rows scroll under it unseen. `md:min-h-17` is the row
 *  with its 44px search, held when People hides the search, so the pills do
 *  not jump on a computer. */
export const SPACE_PILL_BAR =
  'sticky top-0 z-10 -mx-4 flex flex-col gap-3 border-b bg-background px-4 py-3 md:min-h-17 md:flex-row md:items-center';

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
export function LobbyFactsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      {['w-16', 'w-20', 'w-14', 'w-24'].map((width) => (
        <div key={width} className="flex items-center justify-between gap-3 py-1.5">
          <Skeleton className="h-3 w-14 rounded" />
          <Skeleton className={cn('h-3 rounded', width)} />
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
export function LobbyPeopleSkeleton({ rows = 3 }: { rows?: number }) {
  const widths = ['w-24', 'w-20', 'w-28', 'w-24', 'w-16'];
  return (
    <div aria-hidden className="flex flex-col">
      {widths.slice(0, rows).map((width, index) => (
        <div
          key={width}
          className="flex items-center gap-2 py-1"
          style={{ opacity: Math.max(0.3, 1 - index * 0.2) }}
        >
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <Skeleton className={cn('h-3 rounded', width)} />
        </div>
      ))}
      {/* The "See all" / "Manage people" button below the list. */}
      <Skeleton className="mt-1 h-8 w-32 rounded-md" />
    </div>
  );
}
