'use client';

import { memo } from 'react';
import Link from 'next/link';
import { NotebookPen } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING, formatRelativeTime } from '@/v2/shell/designs/modules';
import { NoteBookmarkButton } from '../bookmark/NoteBookmarkButton';
import type { NoteRowModel } from '../note-row-model';

/**
 * NoteRow — one note in the library list, in the cases/statutes row grammar:
 * the NAME at full weight, ONE quiet meta line, a two-line clamp of what the
 * note says, hairlines between rows and no box around them.
 *
 * ── WHAT v1's `NoteCard` DID, AND WHAT CHANGED ──────────────────────────────
 *  1. IT WAS A CARD IN A GRID, with a thumbnail slot, a tag row, a price
 *     badge and a bookmark count. That is a product tile for a marketplace; a
 *     note is a document, and the v2 library is a reading list.
 *  2. THE WHOLE CARD WAS THE LINK, so its accessible name swallowed the
 *     preview, the tags and the price. The link now wraps the identity block
 *     only, and the star is a SIBLING of it rather than a `<button>` nested
 *     inside an `<a>` (invalid HTML, which v1 then had to cancel with a
 *     `preventDefault` on a wrapper div).
 *  3. IT SHOWED A PRICE. `NoteRowModel` cannot express one — see its docblock.
 *
 * ── THE META LINE IS TWO ZONES, NOT A SENTENCE ──────────────────────────────
 * A LEAD that gives up its width first, and a TRAIL that never moves:
 *
 *   LEAD    the author on All notes; the draft/published mark on My notes,
 *           where the author is always the reader. Which one is chosen is the
 *           row model's decision, not this component's guess — see
 *           `note-row-model.ts`.
 *   TRAIL   "updated N ago", right-anchored and tabular on BOTH tabs, so the
 *           times read straight down the column whatever fills the lead.
 *
 * The line NEVER wraps: under pressure the lead truncates and the trail stays
 * put.
 *
 * `memo` matters here for the same reason as `CaseRow`: the bookmark mutation
 * fans out across every cached notes surface, so an unmemoised row would
 * re-render the whole visible list on each star press.
 */
export const NoteRow = memo(function NoteRow({
  row,
  index,
  now,
  showStatus,
}: {
  row: NoteRowModel;
  /** Staggers the entrance for the first screenful only. */
  index: number;
  /** Frozen clock for the relative "updated" label — threaded from the
   *  browser's lazy `useState` so no `Date.now()` runs in render (React
   *  Compiler lint). */
  now: number;
  /** My notes: the LEAD is the draft/published mark. All notes: the author. */
  showStatus: boolean;
}) {
  const updated = formatRelativeTime(row.updatedAt, now);

  return (
    <li
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200"
      // Capped at 14 so a deep page never staggers into a visible delay.
      style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      <div className="group relative flex items-start gap-2">
        <Link
          href={row.href}
          className={cn(
            'v2-interactive flex min-w-0 flex-1 items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-secondary/50',
            FOCUS_RING,
          )}
        >
          <span
            aria-hidden
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors group-hover:text-foreground"
          >
            <NotebookPen className="size-[18px]" />
          </span>

          <span className="min-w-0 flex-1">
            <span
              className={cn(
                'block truncate text-[15px] font-medium transition-colors group-hover:text-primary',
                // An untitled note wears its fallback in a quieter voice: the
                // word "Untitled" is the absence of a name, not a name.
                row.hasTitle
                  ? 'text-foreground'
                  : 'italic text-muted-foreground',
              )}
              title={row.title}
            >
              {row.title}
            </span>

            <span className="mt-1 flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
              {/* LEAD. */}
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {showStatus ? (
                  <NoteStatusMark isDraft={row.isDraft} />
                ) : row.author ? (
                  <span className="min-w-0 truncate">{row.author}</span>
                ) : null}
              </span>

              {/* TRAIL — right-anchored on both tabs. */}
              {updated ? (
                <span className="shrink-0 tabular-nums">updated {updated}</span>
              ) : null}
            </span>

            {row.preview ? (
              <span className="mt-1.5 block line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {row.preview}
              </span>
            ) : null}
          </span>
        </Link>

        {/* Outside the link, so the star is its own control with its own
            accessible name rather than a click the row has to swallow.

            `mt-3.5` (14px) = the link's `py-3` (12px) plus the icon tile's
            `mt-0.5` (2px), so the star and the tile sit on exactly the same
            baseline and the row reads as one bar between two anchors —
            `BookmarkRow` documents the same arithmetic. It was `mt-2`, which
            floated the star 6px high on every row (review F6). */}
        <NoteBookmarkButton
          noteId={row.id}
          isBookmarked={row.isBookmarked}
          className="mt-3.5"
        />
      </div>
    </li>
  );
});

/**
 * The draft / published mark — a dot AND a word, never colour alone. Amber for
 * a draft because it is the state that CHANGES what the note is (private to
 * its author); published is the unremarkable default and stays muted, the same
 * rule the statute status mark follows.
 */
function NoteStatusMark({ isDraft }: { isDraft: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5',
        isDraft && 'text-amber-700 dark:text-amber-400',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          isDraft ? 'bg-amber-500' : 'bg-muted-foreground/50',
        )}
      />
      {isDraft ? 'Draft' : 'Published'}
    </span>
  );
}
