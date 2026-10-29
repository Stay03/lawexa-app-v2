'use client';

import { useId, type ComponentProps, type ReactNode } from 'react';
import { Check, Minus } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import type { EntryLook } from './entry-look';
import { TICK_GUTTER_WIDTH, tickCircleClass, tickGutterClass } from './tick-gutter';

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
 *
 * THE TICK IS ON THE LEFT (Arthur, 29 October 2026, 07:05Z, thread 8aa04be0:
 * "the tick box appears on the right and i have to go all the left to
 * continue ticking others ... put the ticks to the left of the items"). A
 * round tick sits in a narrow column before the icon (`tick-gutter.ts`).
 * Where the pointer can hover and the host passes `onStartSelect`, it shows
 * on the row's hover or focus, and ticking it starts select mode with this
 * row ticked. While the list is being ticked every row shows its circle, so
 * the reader ticks down the left edge without hovering. Where the pointer
 * can hover the column is always kept, so nothing moves when a circle shows.
 * On a touch screen the column shows only while ticking: Select stays the
 * way in there. A row that cannot be ticked in a list that can (a subfolder
 * on a folder's page) keeps the column empty (`selecting`), so the names
 * line up.
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
  iconMark,
  srNote,
  select,
  onStartSelect,
  selecting = false,
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
  /** A mark on the icon's corner (a Space folder's, `space-mark.tsx`). */
  iconMark?: ReactNode;
  /** Words a screen reader hears after the name, never shown (", in <Space>"). */
  srNote?: string;
  /**
   * The list is being ticked (bulk select): the row is its tick box, a tap
   * ticks it instead of opening it, and the "⋯" steps aside for the bar's
   * actions.
   */
  select?: { checked: boolean; onToggle: () => void };
  /** Not selecting yet: the row's tick, on hover, starts it with this row ticked. */
  onStartSelect?: () => void;
  /** The list is being ticked but this row cannot be: its tick column stays, empty. */
  selecting?: boolean;
}) {
  const Icon = look.icon;
  const tickId = useId();
  const ticking = select !== undefined || selecting;
  const content = (
    <>
      <span className="relative flex shrink-0">
        <Icon aria-hidden className={cn('size-[18px] shrink-0', look.tone)} />
        {iconMark}
      </span>
      <span
        title={name}
        className={cn(
          'min-w-0 flex-1 truncate text-[15px]',
          named ? 'text-foreground' : 'italic text-muted-foreground',
        )}
      >
        {name}
        {srNote ? <span className="sr-only">{srNote}</span> : null}
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
      <div
        className={cn(
          'group flex min-w-0 items-center gap-1 rounded-lg transition-colors hover:bg-secondary/50',
          select?.checked && 'bg-secondary/60',
        )}
      >
        <span className={cn(TICK_GUTTER_WIDTH, 'shrink-0 items-center justify-center', tickGutterClass(ticking))}>
          {select ? (
            <RowTick
              id={tickId}
              checked={select.checked}
              onCheckedChange={select.onToggle}
              aria-label={`Select ${name}`}
            />
          ) : onStartSelect ? (
            <RowTick
              checked={false}
              onCheckedChange={onStartSelect}
              aria-label={`Select ${name}`}
              className={tickCircleClass(false)}
            />
          ) : null}
        </span>
        {select ? (
          <label htmlFor={tickId} className={cn(FILE_LIST_OPEN_CLASS, 'cursor-pointer')}>
            {content}
          </label>
        ) : (
          renderOpen(FILE_LIST_OPEN_CLASS, content)
        )}
        {select ? (
          <span aria-hidden className="size-9 shrink-0" />
        ) : menu ? (
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
 *
 * THE SELECT-ALL TICK (Arthur, 29 October 2026, 07:05Z, thread 8aa04be0)
 * sits in the rows' tick column. While the list is being ticked it shows
 * empty, a minus with some rows ticked, or a check with all; a click ticks
 * every row or clears them all. Before that, where the pointer can hover, it
 * shows on the head's hover or focus and starts select mode with every row
 * ticked. A list that cannot be ticked passes no `selectAll`.
 */
export function FileListHead({
  dateLabel = 'Added',
  selectAll,
}: {
  dateLabel?: string;
  selectAll?: {
    selecting: boolean;
    state: boolean | 'indeterminate';
    onToggle: () => void;
    /** "Select all 12 items". */
    label: string;
  };
}) {
  const selecting = selectAll?.selecting ?? false;
  return (
    <div className="group hidden items-center gap-1 border-b border-border/60 pb-2 text-xs text-muted-foreground sm:flex">
      <span className={cn(TICK_GUTTER_WIDTH, 'shrink-0 items-center justify-center', tickGutterClass(selecting))}>
        {selectAll ? (
          <RowTick
            checked={selectAll.state}
            onCheckedChange={selectAll.onToggle}
            aria-label={selectAll.label}
            className={tickCircleClass(selecting)}
          />
        ) : null}
      </span>
      <span aria-hidden className="flex min-w-0 flex-1 items-center gap-3 px-2">
        <span className="w-[18px] shrink-0" />
        <span className="flex-1">Name</span>
        <span className={FILE_LIST_DATE_CLASS}>{dateLabel}</span>
      </span>
      <span aria-hidden className="size-9 shrink-0" />
    </div>
  );
}

/**
 * The round tick of a row and of the list head, the file library's circle: a
 * check when ticked and a minus for some of a list (Arthur's reference, 29
 * October 2026). The house `Checkbox` draws a check for both and leaves the
 * minus state unfilled, so the head read "all ticked" when only some were;
 * this is the same Radix primitive with the minus drawn and filled.
 */
function RowTick({
  className,
  checked,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      className={cn(
        'peer flex size-[18px] shrink-0 items-center justify-center rounded-full border border-input outline-none transition-shadow',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        'data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-content-center text-current [&>svg]:size-3">
        {checked === 'indeterminate' ? <Minus aria-hidden strokeWidth={3} /> : <Check aria-hidden strokeWidth={3} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
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
      <span className={cn(TICK_GUTTER_WIDTH, 'shrink-0', tickGutterClass(false))} />
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
