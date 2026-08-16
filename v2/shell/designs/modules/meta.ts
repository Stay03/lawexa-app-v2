/**
 * modules/meta.ts — the pure, non-visual half of the shared home-module system.
 * Strings and one pure function, imported by BOTH the Work and Study tabs so the
 * focus ring, the entrance motion, and the relative-time format can never drift
 * (the drift that the old `work/primitives.tsx` + `study/parts.tsx` pair grew —
 * two focus rings, two skeleton motions, two `formatRelativeTime` signatures).
 *
 * No JSX and no hooks live here, so it stays a plain module both server and
 * client trees can import.
 */

/**
 * The one focus ring for every interactive element on the home surface — rows,
 * action links, retry buttons, empty-state CTAs. A 2px ring offset from the
 * background so it reads on cards and on the page alike.
 */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * The ONE pill shape every document action row wears — the case page's Save /
 * Share / Full judgment, the note's Copy link / Export / Edit, the statute's
 * Copy link, and Add to folder on all three.
 *
 * It lives here because it had drifted into four byte-identical copies (three
 * private `const ACTION`s plus a fourth inline in the statute header), which is
 * a set that reads as a set only until someone tunes one of them. Pair it with
 * {@link FOCUS_RING} at every call site, exactly as those rows already did.
 */
export const ACTION_PILL =
  'v2-interactive inline-flex min-h-9 items-center gap-2 rounded-full border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground';

/**
 * The ONE shape a list screen's PRIMARY CREATE ACTION wears — New note on
 * `/notes`, New radar on `/radars`, New space on `/spaces`. It sits at the end
 * of the screen's filter row, opposite the tab strip.
 *
 * ── WHY IT IS A CONSTANT AND NOT THREE CLASS STRINGS ───────────────────────
 * The same reason as {@link ACTION_PILL} above: these three were a hand-rolled
 * pill, a second hand-rolled pill and a `<Button size="sm">` (32px, `rounded-md`
 * by default) — a set that read as a set only from a distance. One string, one
 * height, one radius, and the element stays the call site's to choose: a
 * destination is a `<Link>` (prefetchable, middle-clickable), a dialog is a
 * `<button>`, and neither has to wear the other's clothes.
 *
 * ── THE WORD IS ALWAYS DRAWN ───────────────────────────────────────────────
 * Notes' copy of this used to hide its label below `sm:` (`sr-only
 * sm:not-sr-only`), so the one thing a reader comes to that screen to DO was an
 * unlabelled `+` circle at exactly the width where it mattered most. The row it
 * sits in is 358px wide on a 390px phone, against roughly 170px for a two-tab
 * strip and 105px for a fully worded pill, so the word costs nothing there — and
 * every call site carries `flex-wrap`, so at 320px the pill drops to a line of
 * its own instead of squeezing the tabs or clipping. The label is therefore
 * unconditional, and it is also the accessible name: no `aria-label` exists
 * anywhere in this family to fall out of step with what is drawn.
 *
 * `min-h-9` matches {@link ACTION_PILL}, so the two pill families are one height
 * wherever a screen shows both. Pair it with {@link FOCUS_RING} at the call site.
 */
export const CREATE_PILL =
  'v2-interactive inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90';

/**
 * The home surface's ONE signature entrance — a soft fade + 8px rise.
 * `fill-mode-both` holds each block hidden through its stagger delay so nothing
 * pre-flashes on the first frame; `motion-safe` + the globals reduced-motion
 * guard settle everything to its natural, fully-visible state instantly for
 * users who ask for less motion. Callers add their own `duration-*` (pacing) —
 * the module system leaves pacing to the composition so each tab can tune its
 * rhythm without forking the token.
 *
 * WHERE IT MAY BE USED (the entrance rule — see `WorkHome`'s docblock): ONLY on
 * a block the route-level fallback does NOT pre-draw. `fill-mode-both` holds the
 * block fully invisible until the animation runs, so putting this on something
 * `HomeFallback` already painted makes it BLANK at the hand-off and fade back
 * in. That is why the home surfaces now carry it on their role-gated modules
 * alone, and why the old staggered `animationDelay` chain is gone — a stagger
 * only makes sense across a sequence of blocks that are all genuinely arriving.
 */
export const REVEAL =
  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both motion-safe:ease-out';

/**
 * The cross-fade a resolved list plays as it replaces its skeleton — the
 * skeleton-first swap, one tween everywhere so no module's content "just
 * appears". Reduced motion drops it (settles straight to visible).
 */
export const CONTENT_FADE =
  'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300';

/**
 * Compact relative time for a module row (`3m`, `2h`, `4d`, `2w`, `5mo`, `1y`).
 * Pure: `now` is threaded in from a lazy `useState` initializer at the call site
 * so no `Date.now()`/`new Date()` runs in render (React Compiler lint), and the
 * ISO string is parsed with the deterministic `Date.parse`. Accepts the full
 * nullable union both tabs pass (a channel's `last_message_at`, a radar's
 * `last_scan_at`, a bookmark's absent timestamp) and returns `''` for anything
 * missing or unparseable, so a caller never has to null-check before rendering.
 */
export function formatRelativeTime(
  iso: string | null | undefined,
  now: number,
): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const minutes = Math.max(0, Math.round((now - then) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.round(days / 365)}y`;
}
