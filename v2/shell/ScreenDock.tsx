'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * ScreenDock — the floating layer at the bottom of a top-level screen: the
 * search pill, and the dissolve the content passes into behind it.
 *
 * ── WHY `sticky`, NOT `fixed`, AND NOT THE SHELL'S DOCK ROW ────────────────
 * `position: fixed` is forbidden in this shell and `shell.css` carries the
 * reason: fixed elements break under the iOS keyboard. The shell's dock ROW
 * (grid-row 3) is the sanctioned alternative and is wrong here for a different
 * reason — a row RESERVES its height OUTSIDE the scroller, so the list would be
 * cut off above the pill and nothing could ever pass behind it, and the owner
 * has already turned down that look once ("an opaque band above/below the
 * pill", see `Dock.tsx`).
 *
 * So this is `sticky bottom-0` as the last child of a `min-h-full flex-col`
 * column, which is the exact mechanism the conversation composer already runs
 * on — that one is an ABSOLUTE layer over its own transcript, which is only
 * possible because a conversation owns a non-scrolling wrapper; a list screen's
 * only scroller is the shell's, so sticky is the same idea expressed inside it.
 * It buys three things at once:
 *
 *  - it floats OVER the list, with rows visibly scrolling behind it;
 *  - it rides the keyboard for free — the shell is `100dvh − keyboard-inset`,
 *    so the scroll region shrinks and the pill comes up with it;
 *  - it is in the tree from the FIRST paint, server render included. A portal
 *    into a shell-owned layer would have been tidier to read and would have
 *    painted the pill one commit late on every arrival.
 *
 * ── WHAT MAKES IT READ AS FLOATING AND NOT AS FURNITURE ────────────────────
 * The owner filmed the first version on his phone and called it "a messy
 * design… not looking nice", against the ChatGPT recording he had sent: ours
 * was a near full-width plate, square to the screen edges, sitting flat on the
 * bottom, with the rows erased by an opaque band before they reached it. Three
 * numbers here answer that, and all three are geometry rather than decoration:
 *
 *  - THE PILL IS NARROWER THAN THE ROWS. `px-8` against the rows' `px-4` insets
 *    it by a further 16px on each side at every phone width, and
 *    `ScreenDockSearch` caps it at `max-w-md` so it never stretches to the full
 *    reading measure on a tablet or a desktop. A plate as wide as the content
 *    is a bar; a plate visibly narrower than the content is an object lying on
 *    top of it.
 *  - IT DOES NOT TOUCH THE BOTTOM EDGE. `.v2-screen-dock` in `shell.css` holds
 *    it 1.25rem clear (plus the home-indicator inset), so there is background
 *    on all four sides of it. Something bolted to an edge is chrome.
 *  - THE DISSOLVE IS LONGER THAN THE GAP IT LIVES IN. `pt-10` is the only
 *    reason the fade has any room at all: the dock's own box IS the clearance
 *    the list keeps at the end of its travel, so the top padding and the length
 *    of the dissolve are the same 40px. Below that it is opaque, level with and
 *    under the pill, so nothing is ever half-legible beside a control.
 *
 * ── WHERE THE ROWS ACTUALLY GO ─────────────────────────────────────────────
 * While the reader is scrolling, they pass BEHIND the pill: sticky pins the
 * dock to the bottom of the scrollport for as long as the list has more to
 * give, and rows dissolve into the gradient as they arrive under it. At the END
 * of the list they stop above it, and they must: this element is the last child
 * in the flow, so the scroll region finishes where it finishes, and the last
 * row has to be readable when the reader gets to it. The fade is exactly as
 * tall as that resting clearance (`inset: 0` on the pseudo-element in
 * `shell.css`), which is what keeps the final row crisp instead of veiled — a
 * taller fade would look better mid-scroll and wash the one row the reader
 * scrolled all that way to read.
 *
 * ── THE FADE IS PART OF THE DOCK, NOT PART OF THE SCROLLER ─────────────────
 * This is the app's only dissolve: the TOP of a top-level screen has none, on
 * the owner's instruction, and its words pass behind the bar's round buttons,
 * frosted by a blur that keeps them readable rather than taken away (see the
 * see-through block in `shell.css`). Here the dissolve stays, and it is
 * a gradient rather than a mask because a mask on the scroll region would have
 * faded out the pill too, which is precisely the thing the owner wants sitting
 * ABOVE the fade — `shell.css` carries that argument in full. It is drawn as
 * `.v2-screen-dock::before` rather than as a child div because its stops are
 * measured from `env(safe-area-inset-bottom)`, and four `calc()` gradient stops
 * are a paragraph of unreadable arbitrary values as utility classes — the same
 * reason the padding below them already lives in CSS.
 *
 * ── NOTHING HERE STEALS A TAP ──────────────────────────────────────────────
 * The wrapper is `pointer-events-none` so the strip of empty space beside the
 * pill never swallows a press meant for a row behind it; the pill turns pointer
 * events back on for itself.
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
 *
 * ── THERE IS NO FLOATING ACTION IN HERE ANY MORE ───────────────────────────
 * A `ScreenFab` used to ride above the pill on `/notes`, `/radars` and
 * `/spaces`. The owner turned it down on sight ("Remove the floating button
 * from the bottom. It looks very messy"), and each screen's create action went
 * back into its filter row on the shared `CREATE_PILL`. Nothing floats at the
 * bottom of a v2 screen except the one thing the reader types into.
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
        // the dock's box rests ON the bottom edge while a screen that renders
        // no dock (search switched to the top) keeps that padding as its list's
        // bottom breathing room. See `LIST_COLUMN_DOCKED`.
        //
        // `-mx-4 px-8`: the bleed puts the fade's edges on the screen's edges,
        // the padding puts the PILL 32px inside them — a full 16px narrower per
        // side than the rows it floats over.
        'v2-screen-dock pointer-events-none sticky bottom-0 z-20 -mx-4 -mb-16 mt-auto px-8 pt-10',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The dock's search slot — the pill the search field sits in.
 *
 * `pointer-events-auto`, and a width cap of its own: `max-w-md` is what stops
 * the field spanning the whole `max-w-3xl` reading column on a tablet or a
 * desktop, where a full-measure plate at the bottom of the page reads as a
 * toolbar rather than as something floating. On a phone the cap is never
 * reached and the dock's `px-8` does the insetting instead, so the pill is
 * narrower than the rows at every width for one reason or the other.
 *
 * The plate is opaque and shadowed on purpose. It is what hides the rows
 * travelling behind it — deliberately NOT a translucent, blurred glass pill:
 * `backdrop-filter` over the app's one scroll container re-composites on every
 * scrolled frame, and the app spends that cost in exactly ONE place, the top
 * bar's glass strip, because the owner asked for it there by name and it was
 * measured before it shipped (`shell.css`). A second layer of it here would be
 * a cost nobody asked for, over a plate whose whole job is to be opaque.
 * `SearchField` itself is unchanged and unaware of where it
 * is being rendered, which is what lets the same control serve both positions
 * of the developer switch.
 */
export function ScreenDockSearch({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-auto mx-auto w-full max-w-md rounded-4xl bg-background shadow-lg shadow-black/10 dark:shadow-black/40">
      {children}
    </div>
  );
}
