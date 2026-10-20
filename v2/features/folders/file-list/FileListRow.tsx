'use client';

import type { ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import type { EntryLook } from './entry-look';

/**
 * FileListRow — one line of a folder list: a coloured type glyph, the name,
 * and on a computer the date in its own column (folder page B, Stay, 20
 * October 2026, 00:49 UTC; "a clean file system", 00:54 UTC). Nothing goes
 * under the name: no counts, no kind or size, no "added N ago".
 *
 * THE OPEN CONTROL IS THE HOST'S. A folder is a link, a file a button that
 * opens it in a new tab, a case or a note a link; `renderOpen` wraps the
 * line's content in whichever it is, with the row's classes, so the whole
 * line is one target and every kind lines up.
 *
 * THE "⋯" IS A SIBLING of that control, never inside it. Where the pointer can
 * hover it shows on the row's hover or focus, and while its menu is open, so a
 * long list reads as names and dates; on a touch screen it always shows.
 */

/** The open control's classes: 52 px tall on a phone, 40 px on a computer.
 *  The hover tint is the whole row's (below), so the "⋯" sits inside it. */
export const FILE_LIST_OPEN_CLASS = cn(
  'v2-interactive flex h-13 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 text-left sm:h-10',
  FOCUS_RING,
);

/** A row's "⋯" trigger, the same on every kind (`FolderActionsMenu`'s too). */
export const ROW_MENU_TRIGGER_CLASS =
  'v2-interactive flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground';

/** The date column's width, shared with the list head so the two line up. */
export const FILE_LIST_DATE_CLASS = 'w-24 shrink-0';

export function FileListRow({
  look,
  name,
  named,
  date,
  index,
  renderOpen,
  menu,
  below,
}: {
  look: EntryLook;
  name: string;
  /** False when `name` is a fallback ("Untitled folder"): it reads quieter. */
  named: boolean;
  /** The computer's date column; `''` leaves the column empty. */
  date: string;
  /** Staggers the entrance for the first screenful only. */
  index: number;
  renderOpen: (className: string, content: ReactNode) => ReactNode;
  /** The row's "⋯" trigger and menu, or nothing for a reader who may do nothing. */
  menu?: ReactNode;
  /** A line under the row, only for a status the row must say (a file that is gone). */
  below?: ReactNode;
}) {
  const Icon = look.icon;
  const content = (
    <>
      <Icon aria-hidden className={cn('size-[18px] shrink-0', look.tone)} />
      <span
        title={name}
        className={cn(
          'min-w-0 flex-1 truncate text-[15px]',
          named ? 'text-foreground' : 'italic text-muted-foreground',
        )}
      >
        {name}
      </span>
      <span
        className={cn(
          'hidden text-xs text-muted-foreground tabular-nums sm:block',
          FILE_LIST_DATE_CLASS,
        )}
      >
        {date}
      </span>
    </>
  );

  return (
    <li
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:fill-mode-both motion-safe:duration-200"
      // Capped at 14 so a deep page never staggers into a visible delay.
      style={{ animationDelay: `${Math.min(index, 14) * 20}ms` }}
    >
      <div className="group flex min-w-0 items-center gap-1 rounded-lg transition-colors hover:bg-secondary/50">
        {renderOpen(FILE_LIST_OPEN_CLASS, content)}
        {menu ? (
          <span className="flex size-9 shrink-0 items-center justify-center transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:has-[[data-state=open]]:opacity-100">
            {menu}
          </span>
        ) : (
          <span aria-hidden className="size-9 shrink-0" />
        )}
      </div>
      {below}
    </li>
  );
}

/**
 * The computer's column head over the list: "Name" and "Added". Hidden on a
 * phone, where the list has no date column.
 */
export function FileListHead({ dateLabel = 'Added' }: { dateLabel?: string }) {
  return (
    <div
      aria-hidden
      className="hidden items-center gap-1 border-b border-border/60 pb-2 text-xs text-muted-foreground sm:flex"
    >
      <span className="flex min-w-0 flex-1 items-center gap-3 px-2">
        <span className="w-[18px] shrink-0" />
        <span className="flex-1">Name</span>
        <span className={FILE_LIST_DATE_CLASS}>{dateLabel}</span>
      </span>
      <span className="size-9 shrink-0" />
    </div>
  );
}

/**
 * One skeleton line in the row's exact geometry (52 px on a phone, 40 px on
 * a computer, the glyph, the name, the date column and the "⋯" slot), so
 * nothing reflows when the rows arrive.
 */
export function FileListRowSkeleton() {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <div className="flex h-13 min-w-0 flex-1 items-center gap-3 px-2 sm:h-10">
        <Skeleton className="size-[18px] shrink-0 rounded" />
        <Skeleton className="h-4 w-3/5 rounded" />
        <span className="flex-1" />
        <Skeleton className={cn('hidden h-3 rounded sm:block', FILE_LIST_DATE_CLASS)} />
      </div>
      <span className="size-9 shrink-0" />
    </div>
  );
}
