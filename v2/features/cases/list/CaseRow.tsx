'use client';

import { memo } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { FlagIcon } from '@/v2/shell/FlagIcon';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { BookmarkButton } from '@/v2/features/bookmarks/BookmarkButton';
import { caseHref, formatCaseDate, type CaseRowModel } from '../case-row-model';

/**
 * CaseRow — one case in the library list.
 *
 * ── WHAT WAS WRONG WITH v1's CARD, and what changed ─────────────────────────
 *  1. IT LIVED IN A BOX. `CaseListGroup` drew a bordered container around the
 *     whole list — the same chrome the owner rejected on the home ("I don't like
 *     the box"). Here, as there, grouping is a hairline BETWEEN rows and nothing
 *     around them.
 *  2. THE TITLE WAS AN ALL-CAPS WALL with the citation fused in, and the meta
 *     shouted at 16px in filled chips. The row title is now the READABLE case
 *     name alone (`formatCaseName`; source form on hover), and the citation
 *     leads one quiet meta line — the shape a law report entry actually has.
 *  3. TAGS WERE BUTTONS INSIDE A LINK. v1 nested `<button>`s in the row's
 *     `<Link>` and called `preventDefault` to stop the navigation — which works
 *     with a mouse and is a coin toss with a screen reader. Tags moved to the
 *     case page and the filter chip.
 *  4. THE VIEW COUNT IS GONE (owner, July 29) — a popularity number on every
 *     row is ranking data, and the Trending view is where ranking lives.
 *
 * `memo` matters here specifically: the bookmark mutation fans out across every
 * cached case surface, so an unmemoised row would re-render the whole visible
 * list on each star press.
 */
export const CaseRow = memo(function CaseRow({
  row,
  searchQuery,
  index,
}: {
  row: CaseRowModel;
  /** Carried into the case URL as `?q=` for read attribution. */
  searchQuery?: string;
  /** Staggers the entrance for the first screenful only. */
  index: number;
}) {
  const date = formatCaseDate(row.judgmentDate);

  return (
    <li
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200"
      // Capped at 14 so a deep page never staggers into a visible delay.
      style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      <div className="group relative flex items-start gap-2">
        <Link
          href={caseHref(row.slug, searchQuery)}
          className={cn(
            'v2-interactive min-w-0 flex-1 rounded-lg px-2 py-3 transition-colors hover:bg-secondary/50',
            FOCUS_RING,
          )}
        >
          <h3
            title={row.rawTitle}
            className="truncate text-[15px] font-medium text-foreground transition-colors group-hover:text-primary"
          >
            {row.title}
          </h3>

          {/* One quiet meta line: citation first (a lawyer reads name +
              citation as one unit), then the FLAG + court, then the date. The
              flag replaced the "NG" text mark — same artwork as the composer's
              jurisdiction chip, self-hosted. */}
          {row.citation || row.court || row.countryCode || date ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {row.citation ? <span>{row.citation}</span> : null}
              {row.countryCode || row.court ? (
                <span className="inline-flex items-center gap-2">
                  {row.citation ? (
                    <span aria-hidden className="text-muted-foreground/40">
                      ·
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5">
                    {row.countryCode ? (
                      <FlagIcon
                        code={row.countryCode}
                        title={row.countryName ?? undefined}
                      />
                    ) : null}
                    {row.court ? <span>{row.court}</span> : null}
                  </span>
                </span>
              ) : null}
              {date ? (
                <span className="inline-flex items-center gap-2">
                  {row.citation || row.countryCode || row.court ? (
                    <span aria-hidden className="text-muted-foreground/40">
                      ·
                    </span>
                  ) : null}
                  <span className="tabular-nums">{date}</span>
                </span>
              ) : null}
            </p>
          ) : null}

          {row.holding ? (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {row.holding}
            </p>
          ) : null}
        </Link>

        {/* Outside the link, so the star is its own control with its own
            accessible name rather than a click the row has to swallow. */}
        <BookmarkButton
          caseId={row.id}
          isBookmarked={row.isBookmarked}
          className="mt-2"
        />
      </div>
    </li>
  );
});
