'use client';

import { memo } from 'react';
import Link from 'next/link';
import {
  BookText,
  FileText,
  FolderMinus,
  NotebookPen,
  Scale,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING, formatRelativeTime } from '@/v2/shell/designs/modules';
import { formatCaseDate } from '@/v2/features/cases/case-row-model';
import { statuteStatusTone } from '@/v2/features/statutes/statute-row-model';
import { StatuteStatusMark } from '@/v2/features/statutes/list/StatuteRow';
import { useRemoveFolderItem } from '../item-mutations';
import type { FolderItemRowModel } from '../item-row-model';

/**
 * FolderItemRow — one thing filed in this folder, whatever kind it is.
 *
 * ── ONE ROW SHAPE, FOUR META GRAMMARS, TWO ZONES ────────────────────────────
 * The identity line is identical for every type (tile, title, "added N ago"),
 * because the reader is scanning ONE collection and a shared shape is what
 * makes it scannable. Only the LEAD of the meta line differs, and it says the
 * thing that type is actually identified by:
 *
 *   case      the citation and the judgment date
 *   statute   the short designation, the year and the status
 *   note      the author (and a two-line clamp of what it says)
 *   file      the kind and the size, WHERE PRESENT — the file content shape is
 *             unprobed, so this row claims nothing the payload did not carry
 *
 * "ADDED N AGO" IS THE TRAIL on every type: it is what this list is sorted by,
 * so right-anchoring it lets the sequence read straight down the column while
 * each type's own facts fill the lead. The line never wraps — under pressure
 * the lead truncates and the trail stays put.
 *
 * ── v1's CARD, AND WHAT CHANGED ─────────────────────────────────────────────
 *  1. IT SHOWED A TYPE CHIP ("Case", "Note") on every row. The tile already
 *     says the type, and the per-type meta says it again in words that are
 *     actually useful. The chip was a label for a shape that needed none.
 *  2. IT LINKED A FILE TO `#` when it could not build a href. A row with no
 *     destination is now plain text — see `item-row-model.ts` for why a file
 *     has none.
 *  3. ITS REMOVE BUTTON was inside the row's link — a `<button>` nested in an
 *     `<a>`, which is invalid HTML v1 then had to cancel with a
 *     `preventDefault` — and it sent `Number(uuid)`. Here the control is a
 *     SIBLING of the link with its own accessible name, and the id it sends is
 *     a number by construction (`item-row-model.ts`).
 *
 * ── THE VERB IS "REMOVE FROM THIS FOLDER", NEVER "DELETE" ───────────────────
 * The study's sharpest finding: Mendeley's drag-to-trash DESTROYS the
 * reference, EndNote's wording does not, and people read the two as the same
 * gesture. Taking a case out of a folder leaves the case exactly where it was,
 * so nothing here — icon, label or toast — may suggest otherwise. The glyph is
 * a folder losing something, not a bin.
 *
 * `memo` holds because every prop is a value.
 */

const TYPE_ICON: Record<FolderItemRowModel['type'], LucideIcon> = {
  case: Scale,
  statute: BookText,
  note: NotebookPen,
  file: FileText,
};

export const FolderItemRow = memo(function FolderItemRow({
  row,
  folderUuid,
  index,
  now,
}: {
  row: FolderItemRowModel;
  /** The folder this row is filed in — what the removal addresses. */
  folderUuid: string;
  /** Staggers the entrance for the first screenful only. */
  index: number;
  /** Frozen clock for the relative "added" label — threaded from the browser's
   *  lazy `useState` so no `Date.now()` runs in render. */
  now: number;
}) {
  const Icon = TYPE_ICON[row.type];
  const added = formatRelativeTime(row.addedAt, now);

  const identity = (
    <>
      <span
        aria-hidden
        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors group-hover:text-foreground"
      >
        <Icon className="size-[18px]" />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-[15px] font-medium transition-colors',
            row.href && 'group-hover:text-primary',
            row.hasTitle ? 'text-foreground' : 'italic text-muted-foreground',
          )}
          title={row.type === 'case' ? row.rawTitle : row.title}
        >
          {row.title}
        </span>

        <span className="mt-1 flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
          {/* LEAD — what this TYPE is identified by. */}
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <ItemMetaLead row={row} />
          </span>

          {/* TRAIL — the stream's sort key, on every type. */}
          {added ? (
            <span className="shrink-0 tabular-nums">added {added}</span>
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
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200"
      // Capped at 14 so a deep page never staggers into a visible delay.
      style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      <div className="group relative flex min-w-0 items-start gap-2">
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
          // No destination this build can honestly produce (a file's presigned
          // URL expires). The row still records what is filed here rather than
          // offering a link that works for an hour.
          <div className="flex min-w-0 flex-1 items-start gap-3 px-2 py-3">
            {identity}
          </div>
        )}

        <RemoveFromFolderButton row={row} folderUuid={folderUuid} />
      </div>
    </li>
  );
});

/**
 * Take this one thing out of this one folder.
 *
 * ONE HOOK PER ROW, exactly as `BookmarkRow`'s star does it: the mutation is
 * scoped by the CONTENT (`folder-item-case-11837`), so a removal, its undo and
 * anything else touching that item's folder membership are serialised, while
 * two different rows leave in parallel. A per-FOLDER scope would queue the
 * second removal behind the first and leave its row sitting there un-removed.
 *
 * The press does not wait: the row is out of the list in the same frame (the
 * screen filters through `usePendingFolderItemRemovals`), the folder's count
 * ticks down, and B's hook raises the undo toast that re-files it. So this
 * button needs no spinner — the guard below only stops a second press from
 * sending a second DELETE, which the server answers 404.
 */
function RemoveFromFolderButton({
  row,
  folderUuid,
}: {
  row: FolderItemRowModel;
  folderUuid: string;
}) {
  const remove = useRemoveFolderItem({ type: row.type, contentId: row.contentId });

  return (
    <button
      type="button"
      onClick={() => {
        if (remove.isPending) return;
        remove.mutate({
          folderUuid,
          type: row.type,
          contentId: row.contentId,
          // What the undo toast names. `null` when the payload carried no name
          // (an unnamed file), so the toast can say so in words rather than
          // print an empty pair of quotes around our fallback.
          label: row.hasTitle ? row.title : null,
        });
      }}
      // `aria-disabled`, not `disabled`: a real `disabled` would yank focus to
      // `<body>` the instant the press lands, a frame before the row leaves.
      aria-disabled={remove.isPending}
      // Names the ROW, so moving down a column of these is not five identical
      // announcements — and says "remove from this folder", never "delete".
      aria-label={`Remove ${row.title} from this folder`}
      className={cn(
        // `mt-3.5` = the link's `py-3` plus the tile's `mt-0.5`, so the control
        // and the type tile sit on exactly the same baseline.
        'v2-interactive mt-3.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
        FOCUS_RING,
      )}
    >
      <FolderMinus
        aria-hidden
        className="size-4"
      />
    </button>
  );
}

/**
 * The type-specific LEAD of the meta line. Exhaustive over the union.
 *
 * ONE SHRINK RULE across the four branches: the part whose length has no
 * ceiling (citation, designation, author, file kind) carries `min-w-0 truncate`
 * and every fixed-shape part carries `shrink-0`. So a narrow viewport eats the
 * variable reference and never the year, the status or the trail.
 */
function ItemMetaLead({ row }: { row: FolderItemRowModel }) {
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
          {row.year !== null ? (
            <>
              <span className="shrink-0 tabular-nums">{row.year}</span>
              <Dot />
            </>
          ) : null}
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

    case 'file':
      return (
        <>
          {row.kind ? (
            <span className="min-w-0 truncate">{row.kind}</span>
          ) : null}
          {row.kind && row.size ? <Dot /> : null}
          {row.size ? (
            <span className="shrink-0 tabular-nums">{row.size}</span>
          ) : null}
        </>
      );
  }
}

/** The meta line's separator — decorative, so it never reaches a screen reader
 *  as a word. `shrink-0` so it can never be the thing that collapses. */
function Dot() {
  return (
    <span aria-hidden className="shrink-0 text-muted-foreground/40">
      ·
    </span>
  );
}
