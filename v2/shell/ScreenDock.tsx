'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * ScreenDock — the floating layer at the bottom of a top-level screen: the
 * search pill, the one floating action, and the dissolve the content passes
 * into behind both.
 *
 * ── WHY `sticky`, NOT `fixed`, AND NOT THE SHELL'S DOCK ROW ────────────────
 * `position: fixed` is forbidden in this shell and `shell.css` carries the
 * reason: fixed elements break under the iOS keyboard. The shell's dock ROW
 * (grid-row 3) is the sanctioned alternative and is wrong here for a different
 * reason — a row RESERVES its height, so the list would stop above the pill
 * instead of running under it, and the owner has already turned down that
 * look once ("an opaque band above/below the pill", see `Dock.tsx`).
 *
 * So this is `sticky bottom-0` as the last child of a `min-h-full flex-col`
 * column, which is the exact mechanism the home composer and the case ask-dock
 * already run on. It buys three things at once:
 *
 *  - it floats OVER the list, with rows visibly scrolling behind it;
 *  - it rides the keyboard for free — the shell is `100dvh − keyboard-inset`,
 *    so the scroll region shrinks and the pill comes up with it;
 *  - it is in the tree from the FIRST paint, server render included. A portal
 *    into a shell-owned layer would have been tidier to read and would have
 *    painted the pill one commit late on every arrival.
 *
 * Because it is the last element in flow, scrolling to the very bottom settles
 * it into place at the end of the list — so the last row is never trapped under
 * it and no bottom clearance has to be reserved anywhere.
 *
 * ── THE FADE IS PART OF THE DOCK, NOT PART OF THE SCROLLER ─────────────────
 * The top of the screen dissolves under the bar (shell.css); the bottom
 * dissolves into this. It is the same gradient argument and the same answer: a
 * mask on the scroll region would have faded out the pill and the action too,
 * which are precisely the things the owner wants sitting ABOVE the fade.
 *
 * ── NOTHING HERE STEALS A TAP ──────────────────────────────────────────────
 * The wrapper is `pointer-events-none` so the strip of empty space beside the
 * action never swallows a press meant for a row behind it; each control turns
 * pointer events back on for itself.
 *
 * ── THE FILTER PILLS DID NOT COME WITH THE SEARCH BOX ──────────────────────
 * `/cases`, `/statutes` and `/notes` each spent about 192px on three stacked
 * rows before the first result: the bar, the search field, and a row of filter
 * pills. Only the middle one moved here, and the pills stayed at the top,
 * directly under the big title. Two reasons, and they are the same reason twice:
 *
 *  - A FILTER IS A STATEMENT ABOUT WHAT YOU ARE LOOKING AT, so it belongs
 *    beside the title that names the list — "Cases · Library" reads as one
 *    thing. Search is where you TYPE, which is what earns a place under the
 *    thumb. Library/Trending, the country strip and All/My notes are not typing.
 *  - A HORIZONTALLY-SCROLLING STRIP OF SMALL PILLS PRESSED AGAINST A TEXT FIELD
 *    is the arrangement that produces mis-taps, and mis-taps on touch are what
 *    this overhaul exists to remove. The country strip already scrolls
 *    sideways; putting it a finger's width from a field that opens the keyboard
 *    would trade one cramped row for a worse one.
 *
 * The saving the owner asked for still lands: the top of these screens went
 * from three rows to a title and one pill row, and the bar's own 56px stopped
 * being dead space because the list now scrolls through it.
 */
export function ScreenDock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // `mt-auto` is what sinks it to the bottom of a short list; the sticky
        // then only has work to do once the list is taller than the screen.
        // No transform may ever be put on this element or on a wrapper between
        // it and the scroller — a transformed ancestor becomes the containing
        // block and silently kills `position: sticky` (home-frame.ts).
        //
        // `-mb-16` cancels the column's own `pb-16` for this element alone, so
        // the dock rests ON the bottom edge while a screen that renders no dock
        // (search switched to the top) keeps that padding as its list's bottom
        // breathing room. See `LIST_COLUMN_DOCKED`.
        'v2-screen-dock pointer-events-none sticky bottom-0 z-20 -mx-4 -mb-16 mt-auto flex flex-col items-end gap-2 px-4 pt-8',
        className,
      )}
    >
      {/* The dissolve. `-z-10` inside this positioned element, so the content
          scrolling up meets it before it meets the controls. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-background from-40% via-background/85 to-transparent"
      />
      {children}
    </div>
  );
}

/**
 * ScreenFab — the floating action, bottom right, with a WORD on it.
 *
 * It replaces the bottom bar the owner turned down, and it exists only where a
 * screen has one obvious main action. He named three and only three: Notes gets
 * New note, Radar gets New radar, Spaces gets New space. Cases, statutes,
 * bookmarks and quiz get none, and a screen with no single obvious action must
 * not be given one to keep the set tidy.
 *
 * THE WORD IS NOT DECORATION. A bare `+` circle is the thing that has to be
 * learned; the label is what makes the action legible on first sight, and it is
 * also the accessible name, so there is no `aria-label` here to fall out of
 * step with what is drawn.
 *
 * ── TWO SHAPES, ONE COMPONENT ──────────────────────────────────────────────
 * Some of these actions are a place (`/notes/create`, `/radars/new`) and some
 * are a dialog the screen opens itself (Spaces). A place stays a real `<Link>`
 * — prefetchable, middle-clickable, previewable on a long press — and a dialog
 * is a `<button>`, because a link that goes nowhere is a lie to everyone who
 * inspects where it points. The `href`/`onClick` union is what keeps both
 * honest instead of forcing one into the other's clothes.
 */
type ScreenFabAction =
  | { href: string; onClick?: never }
  | { onClick: () => void; href?: never };

export function ScreenFab({
  label,
  className,
  ...action
}: ScreenFabAction & { label: string; className?: string }) {
  const classes = cn(
    'v2-interactive pointer-events-auto inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-full bg-primary pl-4 pr-5 text-sm font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary/90',
    FOCUS_RING,
    className,
  );

  const content = (
    <>
      <Plus aria-hidden className="size-4" />
      {label}
    </>
  );

  return action.href !== undefined ? (
    <Link href={action.href} className={classes}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={action.onClick} className={classes}>
      {content}
    </button>
  );
}

/**
 * The dock's search slot — the pill the search field sits in.
 *
 * `pointer-events-auto` and full width, so the field spans the reading column
 * the way the list rows do. The rounded, shadowed plate is what makes it read
 * as floating over the rows rather than as a row of its own; `SearchField`
 * itself is unchanged and unaware of where it is being rendered, which is what
 * lets the same control serve both positions of the developer switch.
 */
export function ScreenDockSearch({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-auto w-full rounded-4xl bg-background shadow-lg shadow-black/10 dark:shadow-black/40">
      {children}
    </div>
  );
}
