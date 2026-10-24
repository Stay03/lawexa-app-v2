/**
 * home-frame.ts — the ONE definition of every home surface's outer FRAME.
 *
 * WHY THIS FILE EXISTS (owner: "the home skeleton is always the same even when
 * it's landing on either of the 3 tabs and none of the design of the tab match
 * the skeleton"). The route-level fallback (`app/v2/(home)/loading.tsx` → `HomeFallback`)
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
 * It fills the frame's content column (`flex-1`), which is what lets `mt-auto`
 * sink the prompts to just above the shared box, at every width.
 */
export const HOME_SURFACE_FOCUSED =
  'relative mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-10 md:pt-24';

/**
 * The signed-in Work and Study tabs: the timeline (`v2/features/home-timeline`),
 * in the list column every v2 list and the Space page use (`page-columns.ts`),
 * so going from the timeline into a Space moves nothing sideways. Its route
 * fallback draws the same column.
 */
export const HOME_SURFACE_TIMELINE = 'mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-5 sm:pt-6';

/**
 * THE HOME FRAME (Stay, 24 October 2026: one chat box for Chat, Work and
 * Study). `HomeFrame` lays the home layout out as a column at least the
 * screen's height: the tab's content takes the room left (`flex-1`), and the
 * shared box docks under it.
 */
export const HOME_FRAME = 'flex min-h-full flex-col';
export const HOME_FRAME_CONTENT = 'flex flex-1 flex-col';

/**
 * The shared chat box's dock: sticky at the foot of the screen at every width,
 * in flow (never `fixed`), so the content's last line scrolls up above it and
 * on a phone it rides the keyboard. As wide as the timeline's column, so the
 * box keeps one width as the tabs switch. The top padding is the band the
 * ground fades through.
 */
export const HOME_COMPOSER_DOCK = 'sticky bottom-0 z-10 mx-auto w-full max-w-3xl px-4 pt-8 pb-3 md:pb-6';

/**
 * The ground behind that dock: SOLID up to its top 2rem, and only that band
 * fades, so nothing shows round the Jurisdiction pill that rides above the
 * box (Backend's pictures, 24 October 2026).
 */
export const HOME_DOCK_FADE =
  'pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-[linear-gradient(to_top,var(--background)_calc(100%-2rem),transparent)]';

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
 * surfaces, which is the exact failure this file exists to prevent.
 */

/* ── Chat blocks ──────────────────────────────────────────────────────────── */

/** The prompts on Chat and the guest tabs — sunk to just above the shared box,
 *  at every width (the box moved to the foot on a computer too, 24 October 2026). */
export const CHAT_PROMPTS = 'mt-auto pt-8 transition-opacity duration-200 motion-reduce:transition-none';

/** The prompts while a redacted send waits on this screen: faded out, so the
 *  box that says "Removing personal details…" has nothing behind it (Stay,
 *  22 October 2026: the old line among the prompts "looks like a mess"). */
export const CHAT_PROMPTS_HIDDEN = 'pointer-events-none opacity-0';

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

/**
 * Chat's mobile-only quick-jump nav row (owner #20 — the sidebar covers desktop).
 *
 * ONE LINE ON EVERY PHONE (Arthur, 18 October 2026: on some phones Quiz
 * dropped under the other three; "smaller pills", icon and word side by side).
 * The four pills need about 296 px at the base size: a 360 px phone's column
 * holds them, and so does a 390 px one at 120 % text. Below that the row never
 * wraps: it slides sideways in its one line (`data-v2-strip` hides the bar, as
 * on every strip). The inner row is `w-max` and centred, so a row that fits
 * sits in the middle and one that does not starts at its first pill.
 */
export const CHAT_QUICK_JUMP = 'mt-6 overflow-x-auto overscroll-x-contain md:hidden';

/** The pills' one line inside {@link CHAT_QUICK_JUMP}. */
export const CHAT_QUICK_JUMP_ROW = 'mx-auto flex w-max flex-nowrap items-center gap-0.5';

/** One quick-jump pill. 44px tall (`min-h-11`) so it clears the touch floor. */
export const CHAT_QUICK_JUMP_ITEM =
  'inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[0.8125rem] text-muted-foreground transition-colors';

/* ── Shared furniture ─────────────────────────────────────────────────────── */

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
