import type { ReactNode } from 'react';
import { ShellFrame } from './ShellFrame';
import { V2_SHELL_CONTENT_ID } from './shell-content';

/**
 * AppShell — the v2 non-scrolling shell frame (Phase 1, WP6).
 *
 * Pure structure, no state of its own. It arranges its slots into the CSS grid
 * defined in `shell.css` (imported by the v2 layout). The grid ROOT is the one
 * client piece — `ShellFrame`, which reads the pathname so a top-level screen's
 * bar can be see-through from the first paint rather than from an effect:
 *
 *     ┌─────────────────────────────┐  header  (grid-row 1, auto)
 *     ├─────────────────────────────┤
 *     │  content  (grid-row 2, 1fr) │  ← the ONLY scroll container
 *     ├─────────────────────────────┤
 *     └─────────────────────────────┘  dock    (grid-row 3, auto)
 *
 * SHELL MECHANICS — the contract phase-3 (Home + Chat) builders rely on:
 *
 *  - The shell is pinned to the viewport (`height: 100dvh`, minus the iOS
 *    keyboard inset). The DOCUMENT never scrolls — `content` scrolls internally
 *    with `overscroll-behavior: contain`. Never reach for a page-level scroll.
 *  - The `dock` slot is the FLOATING composer's home in phase 3. Style it to
 *    LOOK floating (rounded, shadowed, inset margins, transcript visible behind
 *    it) but let this grid row POSITION it — never `position: fixed`. The dvh +
 *    `--keyboard-inset` height keeps the dock above the iOS keyboard for free.
 *  - The HEADER gets bottom-notch-safe top padding here. The DOCK's bottom
 *    safe-area rides on its CONTENT instead (the portaled composer / the
 *    reservation — see Dock.tsx), NOT on this always-present row: a route with no
 *    dock content (e.g. home) must gain no notch strip, and the empty row must
 *    still collapse to zero height. Putting `v2-safe-bottom` here broke that.
 *  - Slots are optional: each element carries an explicit `grid-row`, so an
 *    omitted header or an empty dock collapses its row without shifting the others.
 *  - On a TOP-LEVEL screen the header ROW collapses to zero and the bar paints
 *    OVER the content region, which is how content scrolls under it. The bar is
 *    still a grid item and still never `position: fixed` — see the see-through
 *    block in `shell.css` for the whole mechanism, the notch decision, and why
 *    the dissolve is a gradient rather than a mask on the scroller.
 *
 * Visuals are deliberately neutral (existing tokens) — phase-2 owns the real
 * header/dock chrome; this WP ships only the mechanics any nav can slot into.
 */
interface AppShellProps {
  /** Content region — the shell's single scroll container. */
  children: ReactNode;
  /** Optional top bar (wordmark / nav chrome). Gets top safe-area padding. */
  header?: ReactNode;
  /** Optional bottom slot — the floating composer's home in phase 3. */
  dock?: ReactNode;
}

export function AppShell({ children, header, dock }: AppShellProps) {
  return (
    // The grid root is a CLIENT component for one reason: it is the only place
    // that can read the pathname and mark a top-level screen's bar see-through
    // in RENDER rather than a paint late. See ShellFrame.
    <ShellFrame>
      {header != null ? (
        // `v2-safe-top` lives on the BAR now, not on this row: a row that pads
        // itself for the notch and then shows nothing is a dead strip above the
        // screen, and on a phone inside a channel this row shows nothing at all
        // (the screen owns the bar there).
        <header className="v2-shell__header">
          {/* The see-through bar's dissolve — always in the tree, painted only
              on a top-level screen below `md:` (shell.css carries the reasoning,
              including why this is a gradient and not a mask on the scroller).
              It sits INSIDE the bar so the bar is its containing block and its
              own safe-area padding measures it; `aria-hidden` because it is a
              colour, not content. */}
          <div aria-hidden className="v2-shell__header-fade" />
          {header}
        </header>
      ) : null}
      {/* The id lets full-page surfaces root IntersectionObservers against the
          REAL scroll container (see use-shell-scroll-root.ts) — a viewport root
          silently loses its rootMargin inside this nested overflow region. */}
      {/* `tabIndex={-1}` makes the region PROGRAMMATICALLY focusable without adding
          a tab stop, so a control that removes itself on activation (the new-rows
          pill, which goes `inert` in the same commit) can hand focus somewhere
          honest instead of dropping it to <body>. */}
      <div id={V2_SHELL_CONTENT_ID} tabIndex={-1} className="v2-shell__content">
        {children}
      </div>
      {dock != null ? <div className="v2-shell__dock">{dock}</div> : null}
    </ShellFrame>
  );
}
