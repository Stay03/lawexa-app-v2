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

/**
 * The signed-in workspace surface — one ordered flex column on mobile, a
 * two-column grid (primary + a 20rem rail) from `md` up, with the greeting
 * spanning row 1 and both columns top-aligned so a tall rail can never inflate
 * the left column into a void (owner #37).
 */
export const HOME_SURFACE_WORKSPACE =
  'relative mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 pb-8 pt-8 sm:px-6 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:items-start md:gap-x-8 md:gap-y-6 md:pb-12 md:pt-12';

/* ── Workspace blocks ─────────────────────────────────────────────────────── */

/** Greeting — first on mobile, full-width row 1 on desktop. */
export const WORKSPACE_GREETING = 'order-1 md:col-span-2 md:row-start-1';

/** See "THE `contents` TRICK" above before touching this. */
export const WORKSPACE_LEFT_COLUMN =
  'contents md:flex md:min-w-0 md:flex-col md:gap-4 md:col-start-1 md:row-start-2';

/** The glance rail — mid-scroll on mobile, grid column 2 on desktop. */
export const WORKSPACE_RAIL =
  'order-4 mt-6 flex flex-col gap-4 md:col-start-2 md:row-start-2 md:mt-0 md:min-w-0';

/** Primary left-column module (Work: "Jump back in"; Study: Quiz). */
export const WORKSPACE_PRIMARY_MODULE = 'order-2 mt-6 md:order-3 md:mt-0';

/** Secondary left-column module (Study: the study-mode CTA). Unused by Work. */
export const WORKSPACE_SECONDARY_MODULE = 'order-3 mt-3 md:order-4 md:mt-0';

/** Suggested prompts — sunk to the thumb on mobile, under the composer on desktop. */
export const WORKSPACE_PROMPTS = 'order-5 mt-auto pt-8 md:order-2 md:mt-0 md:pt-0';

/**
 * The workspace composer dock. MOBILE: `sticky bottom-0`, floating alone, its
 * negative margins bleeding the fade to the surface edges (which are `px-4`,
 * `sm:px-6`). DESKTOP: static, the top of the left column.
 */
export const WORKSPACE_COMPOSER_DOCK =
  'sticky bottom-0 z-10 order-6 -mx-4 px-4 pb-3 pt-6 sm:-mx-6 sm:px-6 md:static md:z-auto md:order-1 md:mx-0 md:px-0 md:pb-0 md:pt-0';

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
