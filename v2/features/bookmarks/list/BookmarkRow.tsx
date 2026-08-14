'use client';

import { memo } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  BookText,
  FolderOpen,
  NotebookPen,
  Scale,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { BookmarkType } from '@/types/bookmark';
import { FOCUS_RING, formatRelativeTime } from '@/v2/shell/designs/modules';
import { formatCaseDate } from '@/v2/features/cases/case-row-model';
import { statuteStatusTone } from '@/v2/features/statutes/statute-row-model';
import { StatuteStatusMark } from '@/v2/features/statutes/list/StatuteRow';
import { useToggleBookmark } from '../mutations';
import { BOOKMARK_TYPE_NOUN, type BookmarkRowModel } from '../bookmark-row-model';

/**
 * BookmarkRow — one saved item, whatever kind it is.
 *
 * ── WHAT WAS WRONG WITH v1's CARD, AND WHAT CHANGED ─────────────────────────
 *  1. IT HAD NO STATUTE BRANCH. A saved statute fell through to the folder
 *     branch: folder icon, and a link to `/folders/undefined`. The row model
 *     this component renders is a discriminated union, so the four branches
 *     below are exhaustive and a fifth type would fail to compile.
 *  2. THE STAR WAS INSIDE THE LINK. v1 nested a `<button>` in the row's
 *     `<a>` — invalid HTML — and cancelled the navigation with a
 *     `preventDefault` on a wrapper `<div>`'s click. Here the star is a
 *     SIBLING of the link, so it is its own control with its own accessible
 *     name and no click has to be swallowed.
 *  3. THE WHOLE ROW WAS THE LINK, so its accessible name swallowed the
 *     preview and the counts. The link now wraps the identity block only.
 *
 * ── ONE ROW, FOUR META GRAMMARS, TWO ZONES ──────────────────────────────────
 * The identity line is identical for every type (tile, title, "saved N ago"),
 * because the reader is scanning ONE collection and a shared shape is what
 * makes it scannable. Only the LEAD of the meta line differs, and it says the
 * thing that type is actually identified by: a case by its citation and
 * judgment date, a statute by its short designation, year and status, a note
 * by its author, a folder by what is inside it.
 *
 * "SAVED N AGO" IS THE TRAIL, ON EVERY TYPE (owner, August 3). It used to sit
 * at the END of the per-type meta, so it landed wherever that type's facts
 * happened to stop — a different x on every row, for the one fact this list is
 * SORTED by. It is now right-anchored at the text block's edge, so the save
 * times read straight down the column while each type's own facts fill the
 * lead. The line never wraps: under pressure the lead truncates and the trail
 * stays put.
 *
 * `memo` matters here for the same reason as `CaseRow`: the toggle fans out
 * across every cached case/statute surface, so an unmemoised row would
 * re-render the whole visible list on each star press.
 */

const TYPE_ICON: Record<BookmarkType, LucideIcon> = {
  case: Scale,
  statute: BookText,
  note: NotebookPen,
  folder: FolderOpen,
};

/** Only a plain hex colour may tint a tile — the value is user-authored folder
 *  settings going into an inline style, so anything that is not obviously a
 *  colour is simply not used. */
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * The tint as a 6-digit hex, so the `1f` alpha suffix always produces a VALID
 * 8-digit colour.
 *
 * The 3-digit form is the trap (review F5): `#abc` + `1f` is `#abc1f`, five
 * digits, which is not a colour at all — the declaration is dropped, and
 * because a truthy tint also suppresses the `bg-secondary` fallback the tile
 * ends up with NO background. Expanding first means a malformed value can only
 * ever land on the fallback tile, never on a blank one.
 */
function tileTint(color: string | null): string | null {
  if (!color || !HEX_COLOR.test(color)) return null;
  const digits = color.slice(1);
  return digits.length === 3
    ? `#${digits[0]}${digits[0]}${digits[1]}${digits[1]}${digits[2]}${digits[2]}`
    : color;
}

export const BookmarkRow = memo(function BookmarkRow({
  row,
  index,
  now,
  exiting,
  onExit,
}: {
  row: BookmarkRowModel;
  /** Staggers the entrance for the first screenful only. */
  index: number;
  /** Frozen clock for the relative "saved" label — threaded from the browser's
   *  lazy `useState` so no `Date.now()` runs in render (React Compiler lint). */
  now: number;
  /** `true` while the row plays its exit before unmounting. */
  exiting: boolean;
  /** Hands the row to the list's presence holdover. MUST be stable, or the
   *  `memo` above stops holding. */
  onExit: (row: BookmarkRowModel, index: number) => void;
}) {
  const Icon = TYPE_ICON[row.type];
  const saved = formatRelativeTime(row.savedAt, now);
  const tint = row.type === 'folder' ? tileTint(row.color) : null;

  const identity = (
    <>
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors',
          tint
            ? undefined
            : 'bg-secondary text-muted-foreground group-hover:text-foreground',
        )}
        // The folder's own colour, at card-tint strength, so a colour-coded
        // shelf stays recognisable in the saved list. `RowIconTile`'s geometry
        // exactly (size-9 / rounded-lg / 18px glyph) — only the tint is local.
        style={tint ? { backgroundColor: `${tint}1f`, color: tint } : undefined}
      >
        <Icon className="size-[18px]" />
      </span>

      <span className="min-w-0 flex-1">
        {/* The cases-list title treatment, exactly: one truncating line, with
            the full string on the `title` attribute so nothing a bookmark is
            named can become unreadable. */}
        <span
          className={cn(
            'block truncate text-[15px] font-medium text-foreground transition-colors',
            row.href && 'group-hover:text-primary',
          )}
          title={row.type === 'case' ? row.rawTitle : row.title}
        >
          {row.title}
        </span>

        <span className="mt-1 flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
          {/* LEAD — what this TYPE is identified by. */}
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <RowMetaLead row={row} />
          </span>

          {/* TRAIL — the list's sort key, right-anchored on every type. */}
          {saved ? (
            <span className="shrink-0 tabular-nums">saved {saved}</span>
          ) : null}
        </span>

        {row.type === 'note' && row.preview ? (
          <span className="mt-1.5 block line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {row.preview}
          </span>
        ) : null}
      </span>
    </>
  );

  return (
    <li
      // THE EXIT (house rule: nothing appears or disappears abruptly). The
      // repo's persistent grid-collapse — `grid` + an interpolable
      // `grid-template-rows`, `overflow-hidden` on the item — so `1fr → 0fr` has
      // a value to animate FROM and the row folds instead of vanishing between
      // frames. `overflow-hidden` is applied only while leaving, so a resting
      // row never clips its star's focus ring. `motion-reduce` settles it
      // instantly, and the unmount is committed by a TIMER rather than by the
      // animation, so the row still leaves either way.
      //
      // THE ENTRANCE CLASS IS DROPPED WHILE EXITING, and that is load-bearing,
      // not tidiness: `animate-in` carries `fill-mode-both`, so a FINISHED
      // entrance keeps asserting its final `opacity: 1` — which would win over
      // the `opacity-0` transition and leave the row folding at full opacity.
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-150 ease-out motion-reduce:transition-none',
        exiting ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
        !exiting &&
          'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200',
      )}
      // Capped at 14 so a deep page never staggers into a visible delay.
      style={exiting ? undefined : { animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      {/* `min-w-0` IS THE FIX FOR THE OVERSIZED ROW, and it belongs on THIS
          element specifically. The `<li>` above is a GRID (that is how the exit
          collapse interpolates), and a grid item's automatic minimum size is its
          CONTENT's minimum — which, for a row whose title is `whitespace-nowrap`
          truncated, is the full untruncated title. The single implicit column
          therefore grew to fit an absurdly long bookmark name, the row spilled
          past the reading column, and its star was carried out of the shared
          right edge while every other row's stayed put. Zeroing the minimum lets
          the track resolve to the column's width, so truncation happens where it
          was always meant to. */}
      <div
        className={cn(
          'group relative flex min-w-0 items-start gap-2',
          exiting && 'overflow-hidden',
        )}
      >
        {row.href ? (
          <Link
            href={row.href}
            className={cn(
              'v2-interactive flex min-w-0 flex-1 items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-secondary/50',
              FOCUS_RING,
            )}
          >
            {identity}
          </Link>
        ) : (
          // No destination the payload can produce — see `folderHref`. The row
          // still shows what is saved (and can still be un-saved) rather than
          // offering a link to nowhere, which is v1's `/folders/undefined`.
          <div className="flex min-w-0 flex-1 items-start gap-3 px-2 py-3">
            {identity}
          </div>
        )}

        {/* Outside the link, so the star is its own control with its own
            accessible name rather than a click the row has to swallow. */}
        <UnsaveButton row={row} index={index} exiting={exiting} onExit={onExit} />
      </div>
    </li>
  );
});

/**
 * The type-specific LEAD of the meta line. Exhaustive over the union.
 *
 * ONE SHRINK RULE across the four branches: the part whose length has no
 * ceiling (citation, designation, author) carries `min-w-0 truncate` and every
 * fixed-shape part carries `shrink-0`. So a narrow viewport eats the variable
 * reference and never the year, the status or the counts — and never the
 * trail.
 */
function RowMetaLead({ row }: { row: BookmarkRowModel }) {
  switch (row.type) {
    case 'case': {
      const date = formatCaseDate(row.judgmentDate);
      return (
        <>
          {row.citation ? (
            <span className="min-w-0 truncate">{row.citation}</span>
          ) : null}
          {row.citation && date ? <Dot /> : null}
          {date ? <span className="shrink-0 tabular-nums">{date}</span> : null}
        </>
      );
    }

    case 'statute':
      return (
        <>
          {row.shortTitle ? (
            <>
              <span className="min-w-0 truncate">{row.shortTitle}</span>
              <Dot />
            </>
          ) : null}
          <span className="shrink-0 tabular-nums">{row.year}</span>
          <Dot />
          <span className="shrink-0">
            <StatuteStatusMark
              tone={statuteStatusTone(row.status)}
              label={row.statusLabel}
            />
          </span>
        </>
      );

    case 'note':
      return row.author ? (
        <span className="min-w-0 truncate">{row.author}</span>
      ) : null;

    case 'folder':
      return (
        <span className="min-w-0 truncate tabular-nums">
          {row.itemsCount} {row.itemsCount === 1 ? 'item' : 'items'}
          {row.childrenCount > 0
            ? ` · ${row.childrenCount} ${row.childrenCount === 1 ? 'subfolder' : 'subfolders'}`
            : ''}
        </span>
      );
  }
}

/**
 * The star, which on THIS page means "remove".
 *
 * ONE VOICE, NOT TWO (review F11a). It used to carry BOTH an action label
 * ("Remove … bookmark") and `aria-pressed={true}`, which a screen reader reads
 * as "Remove … pressed" — a control that simultaneously claims to be an action
 * and to be in the "on" state. On every OTHER v2 surface the star is a genuine
 * two-state toggle and `aria-pressed` is right; here the row only ever exists
 * in the saved state and the press only ever removes it, so this is an ACTION
 * button and it announces one. The name carries the row's title, so moving down
 * a column of stars is not five identical announcements.
 *
 * The press ALSO hands the row to the list's presence holdover, so it can play
 * its exit — but the request fires in the same handler, immediately. Optimistic
 * is not the same as delayed: the animation is what waits, never the write.
 */
function UnsaveButton({
  row,
  index,
  exiting,
  onExit,
}: {
  row: BookmarkRowModel;
  index: number;
  exiting: boolean;
  onExit: (row: BookmarkRowModel, index: number) => void;
}) {
  const toggle = useToggleBookmark({ type: row.type, contentId: row.contentId });

  const press = () => {
    // A row already on its way out must not fire a second write. The endpoint
    // is a server-side TOGGLE, so a duplicate press would be serialized by the
    // shared scope and then RE-ADD the bookmark the first press deleted.
    if (exiting) return;
    onExit(row, index);
    toggle.mutate({
      type: row.type,
      contentId: row.contentId,
      next: !row.isBookmarked,
    });
  };

  return (
    <button
      type="button"
      onClick={press}
      // `aria-disabled`, not `disabled`: a real `disabled` yanks focus to
      // `<body>` the instant the press lands, 150ms before the row would have
      // taken it away by unmounting. The guard above is what actually stops the
      // second write.
      aria-disabled={exiting}
      aria-label={`Remove ${BOOKMARK_TYPE_NOUN[row.type]} bookmark: ${row.title}`}
      className={cn(
        // `mt-3.5` = the link's `py-3` plus the tile's `mt-0.5`, so the star and
        // the type tile sit on exactly the same baseline and the row reads as
        // one bar between two anchors.
        'v2-interactive mt-3.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
        row.isBookmarked && 'text-primary hover:text-primary',
        FOCUS_RING,
      )}
    >
      <Bookmark
        aria-hidden
        className={cn(
          'size-4',
          row.isBookmarked && 'fill-current',
        )}
      />
    </button>
  );
}

/** The meta line's separator — decorative, so it never reaches a screen
 *  reader as a word. `shrink-0` so it can never be the thing that collapses. */
function Dot() {
  return (
    <span aria-hidden className="shrink-0 text-muted-foreground/40">
      ·
    </span>
  );
}
