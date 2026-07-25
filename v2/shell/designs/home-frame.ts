/**
 * home-frame.ts — the ONE definition of every home surface's outer FRAME.
 *
 * WHY THIS FILE EXISTS (owner: "the home skeleton is always the same even when
 * it's landing on either of the 3 tabs and none of the design of the tab match
 * the skeleton"). The route-level fallback (`app/v2/loading.tsx` → `HomeFallback`)
 * has to draw the SAME shape the real surface will occupy, or the hand-off is a
 * layout swap rather than content resolving into place. A hand-drawn fallback
 * diverges from the real surfaces within two design rounds — so the frame is
 * defined exactly once, here, and BOTH the real surface and the fallback import
 * it. Changing a max-width, a breakpoint anchor, or an `order` in this file moves
 * the real surface and its fallback together; they cannot drift.
 *
 * SCOPE: outer frame only — container widths, page padding, vertical anchoring,
 * the mobile↔desktop `order` sequence, the sticky dock, and the two-column
 * workspace grid. The CONTENT of each block stays with its own component. This
 * file is a mechanical extraction of the strings that were previously inline in
 * ChatHome/WorkHome/StudyHome; nothing here is a redesign.
 *
 * No JSX and no hooks, so both server and client trees can import it — the same
 * shape as `modules/meta.ts`, and the same reason Tailwind still sees the class
 * strings (v4 scans source text, so constants in a `.ts` file are detected).
 *
 * ── THE TWO FRAMES ──────────────────────────────────────────────────────────
 *  FOCUSED   — a single reading column (`max-w-2xl`), top-anchored on desktop.
 *              Used by the Chat tab and by the Work/Study GUEST surfaces.
 *  WORKSPACE — the wide two-column desktop grid (`max-w-5xl`, 1fr + a 20rem
 *              rail) that collapses to ONE ordered mobile flex column. Used by
 *              the signed-in Work and Study tabs.
 *
 * ── THE `contents` TRICK (do not "simplify" it) ─────────────────────────────
 * `WORKSPACE_LEFT_COLUMN` is `display: contents` below `md`. That is load-bearing:
 * on mobile the left column's children must join the ROOT flex container so
 *   (a) the per-block `order` values interleave them with the rail into ONE
 *       scroll sequence, and
 *   (b) the composer's `sticky bottom-0` gets the TALL root as its containing
 *       block instead of a short nested wrapper (a sticky element can never
 *       travel further than its containing block, so nesting it silently kills
 *       the dock).
 * Reproduce the `contents md:flex` pair verbatim in anything that mirrors this
 * frame. Likewise: never put a transform on a sticky element or its inner ref
 * div — a transformed ancestor becomes the containing block and breaks
 * `position: sticky`. Entrance transforms belong on an INNER wrapper.
 *
 * ── THE ORDER SCALE ─────────────────────────────────────────────────────────
 * One shared mobile scale serves both workspace tabs (Work leaves the
 * `secondary` slot unused — `order` is a sort key, so gaps are inert):
 *
 *      1 greeting → 2 primary module → 3 secondary module → 4 rail
 *        → 5 prompts → 6 composer dock
 *
 * Desktop re-sequences the left column to composer → prompts → modules via the
 * `md:order-*` half of each constant, and the rail becomes grid column 2.
 */

/* ── Surface roots ────────────────────────────────────────────────────────── */

/**
 * The focused single-column surface — Chat, plus the Work/Study guest surfaces.
 * `min-h-full` + `flex-col` is what lets `mt-auto` sink the compose cluster to
 * the thumb on mobile; `md:pt-36` is the approved desktop top anchor (owner #33).
 */
export const HOME_SURFACE_FOCUSED =
  'relative mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 pt-10 pb-8 md:pt-36 md:pb-12';

/*
 * THE TWO-COLUMN WORKSPACE FRAME IS GONE (owner, July 25).
 *
 * `HOME_SURFACE_WORKSPACE` and its blocks — the greeting row, the `display:contents`
 * left column, the 20rem rail, and the primary/secondary module slots — described a
 * layout no surface renders any more. Work and Study were rebuilt onto
 * `HOME_SURFACE_FOCUSED`, the same single reading column Chat uses, because the rail
 * was removed outright rather than restyled.
 *
 * Deleted rather than kept dormant: a frame nobody renders drifts silently from the
 * surfaces, which is the exact failure this file exists to prevent. The `contents
 * md:flex` trick and the mobile `order` scale it documented are preserved where they
 * are still load-bearing — on the focused frame's composer dock, below.
 */

/* ── Chat blocks ──────────────────────────────────────────────────────────── */

/**
 * The Chat composer dock. Same mechanic as the workspace dock, but the focused
 * surface is `px-4` at every width (no `sm:px-6` bleed) and desktop adds the
 * hero gap under the greeting (`md:mt-10`).
 */
export const CHAT_COMPOSER_DOCK =
  'order-4 sticky bottom-0 z-10 -mx-4 px-4 pb-3 pt-6 md:order-3 md:static md:z-auto md:mx-0 md:mt-10 md:px-0 md:pb-0 md:pt-0';

/** Chat's prompts — ABOVE the dock on mobile, BELOW the composer on desktop. */
export const CHAT_PROMPTS = 'order-3 mt-auto pt-8 md:order-4 md:mt-3 md:pt-0';

/**
 * The home's SECTION STACK — the ordered list of data sections under the compose
 * cluster on Work and Study (owner's July-25 redesign). `order-5`/`md:order-5`
 * places it after the prompts at both breakpoints; `mt-auto` on the prompts still
 * sinks the compose cluster toward the thumb on mobile, so the sections scroll
 * ABOVE it there and read BELOW it on desktop — the same inversion the prompts and
 * composer already use, and the reason the mobile order values are not sequential.
 *
 * `gap-7` is the grouping mechanism now that nothing is boxed: sections are told
 * apart by the space between them, which costs no border and no padding.
 */
export const HOME_SECTIONS = 'order-2 mt-6 flex flex-col gap-7 md:order-5 md:mt-8';

/** Chat's mobile-only quick-jump nav row (owner #20 — the sidebar covers desktop). */
export const CHAT_QUICK_JUMP =
  'mt-6 flex flex-wrap items-center justify-center gap-1.5 md:hidden';

/** One quick-jump pill. 44px tall (`min-h-11`) so it clears the touch floor. */
export const CHAT_QUICK_JUMP_ITEM =
  'inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground transition-colors';

/* ── Shared furniture ─────────────────────────────────────────────────────── */

/**
 * The mobile-only gradient under a sticky dock — dissolves the content scrolling
 * behind the composer instead of letting it collide with it. Sits at `-z-10`
 * inside the dock, so it needs the dock to be the positioned ancestor.
 */
export const DOCK_FADE =
  'pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-background via-background/85 to-transparent md:hidden';

/** Comfortaa greeting scale for the focused (Chat / guest) surfaces. */
export const HOME_GREETING_HEADING_FOCUSED =
  'font-comfortaa text-[1.75rem] font-semibold tracking-tight text-balance sm:text-[2rem] md:text-[2.25rem]';

/** Comfortaa greeting scale for the workspace surfaces (left-aligned, tighter). */
export const HOME_GREETING_HEADING_WORKSPACE =
  'font-comfortaa text-[26px] font-semibold leading-tight md:text-[32px]';

/**
 * The greeting's own skeleton geometry.
 *
 * The greeting is the ONE genuinely route-blocked element on the home: its text
 * is built from the signed-in first name, which arrives with the page's server
 * session — so it is the one thing the route fallback is right to skeleton, and
 * the fallback's skeleton must land exactly where `HomeGreeting`'s does or the
 * hand-off jumps.
 *
 * NOTE / follow-up: `HomeGreeting.tsx` currently re-declares these two strings
 * inline. It is outside this workstream's file ownership, so the duplication is
 * REPORTED rather than fixed — the one-line change is to import these constants
 * there. Until then, keep the two in lockstep.
 */
export const HOME_GREETING_SKELETON_HEADING =
  'h-8 w-56 rounded-lg sm:w-64 md:h-9 md:w-72';
export const HOME_GREETING_SKELETON_SUBLINE = 'h-4 w-40 rounded md:w-52';
