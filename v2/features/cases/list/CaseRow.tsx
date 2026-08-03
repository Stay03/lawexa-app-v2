'use client';

import { memo } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { FLAG_W, FlagIcon } from '@/v2/shell/FlagIcon';
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
 * ── THE META LINE IS TWO ZONES, NOT A SENTENCE (owner, August 3) ────────────
 * It used to read `citation · flag court · date`, and because citations vary in
 * length from "(2019) LPELR-46927(SC)" to a three-report string, the flag, the
 * court and the date landed at a DIFFERENT x on every row — the eye had to
 * re-find each fact per row instead of reading down a column.
 *
 * Now: a LEAD zone (left) and a TRAIL zone (right), one line, never wrapping.
 * The lead opens with the flag — a fixed-width mark, so it is pixel-aligned
 * down the whole list — then the court, then the citation LAST, because the
 * citation is the only part whose length has no ceiling. It sits in the
 * flexible slot and truncates before it can move anything. The trail carries
 * the one time fact, right-anchored at the text block's edge, so the judgment
 * dates form their own column.
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

          {/* One quiet meta line, in two zones. The flag replaced the "NG" text
              mark — same artwork as the composer's jurisdiction chip,
              self-hosted. */}
          {row.citation || row.court || row.countryCode || date ? (
            <p className="mt-1 flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
              {/* LEAD — flag, court, citation. */}
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {row.countryCode ? (
                  <FlagIcon
                    code={row.countryCode}
                    title={row.countryName ?? undefined}
                  />
                ) : (
                  // The mark's footprint, held OPEN. A case whose payload
                  // carries no country code would otherwise start its court one
                  // flag-width to the left of every other row — the same drift
                  // the two zones exist to kill.
                  <span aria-hidden className="shrink-0" style={{ width: FLAG_W }} />
                )}
                {row.court ? <span className="truncate">{row.court}</span> : null}
                {row.court && row.citation ? <Dot /> : null}
                {/* `flex-1` (basis 0) is what makes the CITATION give up its
                    width first: with nothing to shrink from, the court keeps its
                    natural size until the citation has nowhere left to go. */}
                {row.citation ? (
                  <span className="min-w-0 flex-1 truncate">{row.citation}</span>
                ) : null}
              </span>

              {/* TRAIL — the one time fact, right-anchored. */}
              {date ? (
                <span className="shrink-0 tabular-nums">{date}</span>
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

/** The meta line's separator — decorative, so it never reaches a screen
 *  reader as a word. `shrink-0` so it can never be the thing that collapses. */
function Dot() {
  return (
    <span aria-hidden className="shrink-0 text-muted-foreground/40">
      ·
    </span>
  );
}
