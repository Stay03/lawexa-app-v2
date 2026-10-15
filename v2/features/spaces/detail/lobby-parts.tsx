'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * lobby-parts — the pieces of furniture the space page's regions share: the
 * column it is laid out in, and the section heading every block wears.
 *
 * ── TWO COLUMNS, CHOSEN PER SPACE (design round 1, 12 October 2026) ────────
 * A space that shows its channels opens on the Channels tab, the LOBBY: an
 * identity block over a digest that wants a second column on a wide screen,
 * beside a 240px rail that has already taken its share of the viewport. It
 * keeps `max-w-5xl`, and `xl:` rather than `lg:` is where its split happens —
 * at 1024px the pane is only 784px wide, and a 288px aside would leave the
 * main column narrower than the rows inside it want to be.
 *
 * Every other space is a stack of rows (its conversations, folders and files)
 * and takes the list column, `max-w-3xl`, the width the `/spaces` list and the
 * Conversations and Folders screens use. It used to take the lobby's too, so
 * going from the list into a space moved the content 128px left and made it
 * 256px wider, and a chat's time sat 900px from its title.
 *
 * The choice is per SPACE and not per tab, so switching tabs never moves the
 * header.
 */
// A full-height flex column, so the Conversations tab's docked box sits at the
// bottom of the pane when the list is short (`SpaceChatDock`'s `mt-auto`).
const SPACE_COLUMN_BASE = 'mx-auto flex min-h-full w-full flex-col px-4 pb-16 pt-5 sm:pt-6';

/** The page's column: the lobby's width where the space shows its channels,
 *  the list's everywhere else. */
export function spacePageColumn(showsChannels: boolean): string {
  return `${SPACE_COLUMN_BASE} ${showsChannels ? 'max-w-5xl' : 'max-w-3xl'}`;
}

/** The lobby's two-column grid: the digest, then the facts about the place.
 *  Since Spaces F2 it is the Channels TAB's panel, so the gap above it is the
 *  panel's ({@link SPACE_TAB_PANEL}), the same for every tab. */
export const SPACE_LOBBY_GRID =
  'grid gap-x-8 gap-y-6 xl:grid-cols-[minmax(0,1fr)_18rem]';

/** The tab strip under the identity block, and the panel under the strip.
 *  Shared by the live page and its silhouette, so the hand-off moves nothing. */
export const SPACE_TABS_ROW = 'mt-5';
export const SPACE_TAB_PANEL = 'mt-5 flex flex-1 flex-col';

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
