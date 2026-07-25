'use client';

import { memo } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';

import { cn } from '@/lib/utils';
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
 *  2. THE META SHOUTED AS LOUD AS THE CASE. v1 set the title at 20px and every
 *     piece of metadata at 16px, and boxed the court and country in filled
 *     chips — so a scan hit four grey pills before it reached a case name. The
 *     case name is the only thing worth scanning, so it is the only thing at
 *     full weight; everything else is one quiet line beneath it.
 *  3. TAGS WERE BUTTONS INSIDE A LINK. v1 nested `<button>`s in the row's
 *     `<Link>` and called `preventDefault` to stop the navigation — which works
 *     with a mouse and is a coin toss with a screen reader, because the row's
 *     accessible name then swallowed five tag names. Tags moved OUT of the row
 *     to the filter bar, where filtering belongs.
 *  4. THE HOLDING WAS PRE-TRUNCATED IN JS at 300 characters and then clamped
 *     again in CSS at two lines, so the ellipsis a reader saw was usually the
 *     wrong one. One clamp now, in CSS, at the real width.
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
          <h3 className="truncate text-[15px] font-medium text-foreground transition-colors group-hover:text-primary">
            {row.title}
          </h3>

          {/* One quiet meta line. Every part is optional, and the separators are
              rendered between what is actually present — never a stray bullet. */}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {row.countryMark ? (
              <span className="font-medium tracking-wide">{row.countryMark}</span>
            ) : null}
            {row.court ? <Dot before={!!row.countryMark}>{row.court}</Dot> : null}
            {date ? (
              <Dot before={!!row.countryMark || !!row.court}>
                <span className="tabular-nums">{date}</span>
              </Dot>
            ) : null}
            {row.viewsCount > 0 ? (
              <Dot before={!!row.countryMark || !!row.court || !!date}>
                <span className="inline-flex items-center gap-1">
                  <Eye aria-hidden className="size-3" />
                  <span className="tabular-nums">{row.viewsCount}</span>
                </span>
              </Dot>
            ) : null}
          </p>

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

/** A separator dot rendered only when something precedes it. */
function Dot({ before, children }: { before: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      {before ? <span aria-hidden className="text-muted-foreground/40">·</span> : null}
      {children}
    </span>
  );
}
