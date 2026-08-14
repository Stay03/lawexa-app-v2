'use client';

import { useCallback, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { MouseEvent } from 'react';

/**
 * useBackTo — a back control that actually goes back, when back is where it
 * says it goes.
 *
 * ── WHAT WAS WRONG ─────────────────────────────────────────────────────────
 * There is no `router.back()` anywhere in v2 and no history stack of its own.
 * Every back affordance is a `<Link>` to a computed parent, which always
 * PUSHES. So a reader who opens a channel from the space lobby and presses the
 * chevron gets [lobby, channel, lobby], and the phone's own Back button then
 * takes them into the channel they just left. Sixteen controls do this.
 *
 * The link is not a mistake, and it must stay: a reader can land in a thread
 * from a notification with nothing behind them at all, and `back()` there would
 * take them out of the app entirely. That is the trade the code documents and
 * it is the right one.
 *
 * So: keep the link, and take the history move ONLY when history really is
 * where the link points.
 *
 * ── HOW IT KNOWS, AND WHY IT WRITES NOTHING ────────────────────────────────
 * The Navigation API can be read directly: `navigation.entries()` is this
 * tab's same-origin entries, and `navigation.currentEntry.index` says where we
 * stand in them. The entry at `index - 1` is literally what Back would land
 * on, so the question "is the parent behind me" is answered by reading its
 * URL. No stamping, no mirror, no bookkeeping.
 *
 * THAT MATTERS MORE THAN IT LOOKS. This app already writes history state in
 * two places: the overlay system stamps the entry it pushes so that closing a
 * panel pops exactly its own entry, and scroll memory stamps a key per entry
 * so a Back press restores the reader's place. Both are documented as fragile:
 * a write that does not spread the existing state erases the other's stamp,
 * and a write issued while a navigation is being processed CANCELS that
 * navigation, which would leave a panel that can never close again. A
 * read-only design cannot do any of that. It was worth choosing for that
 * reason alone.
 *
 * Support: Chrome and Edge since 2022, Safari 26.2 (December 2025), Firefox
 * 147 (January 2026) — Baseline as of January 2026, near ninety percent of
 * browsers. Reading it is a progressive enhancement and Next's own router is
 * untouched; intercepting its events would not be, which is why nothing here
 * does that.
 *
 * ── WITHOUT IT, NOTHING CHANGES ────────────────────────────────────────────
 * The fallback is a short list of where this tab has been, kept in memory by
 * {@link useRouteTrail}. It is advisory: when it cannot say for certain that
 * the previous screen is the parent, the control stays a plain link and pushes,
 * which is exactly today's behaviour. Being unsure must cost the reader a
 * duplicate entry, never a jump to somewhere they did not ask for.
 *
 * ── IT STAYS A LINK ────────────────────────────────────────────────────────
 * The `href` is always real. Middle-click, long-press preview, "open in new
 * tab", a crawler and a screen reader all keep the destination; only a plain
 * left click is ever intercepted. A back control rebuilt as a button would
 * lose all of that.
 */

/** The Navigation API surface used here, all of it read-only. Typed narrowly
 *  rather than pulled in wholesale, because this file must not grow opinions
 *  about the parts of the API it deliberately never touches. */
interface NavigationEntryLike {
  readonly url: string | null;
  readonly index: number;
}
interface NavigationLike {
  readonly currentEntry: NavigationEntryLike | null;
  entries(): readonly NavigationEntryLike[];
  readonly canGoBack?: boolean;
}

function navigationApi(): NavigationLike | null {
  if (typeof window === 'undefined') return null;
  const candidate = (window as Window & { navigation?: NavigationLike }).navigation;
  if (!candidate || typeof candidate.entries !== 'function') return null;
  return candidate;
}

/** Where this tab has been, newest last, for browsers with no Navigation API.
 *  Module scope: one tab, one trail, and it deliberately does not survive a
 *  reload — a reloaded tab knows nothing, and knowing nothing means pushing,
 *  which is safe. */
const trail: string[] = [];

/** Record where we are. Mounted once by the v2 layout. */
export function useRouteTrail(): void {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    if (navigationApi()) return; // The browser already keeps this, exactly.
    const here = search ? `${pathname}?${search}` : pathname;
    const seen = trail.lastIndexOf(here);
    if (seen === -1) {
      trail.push(here);
      // A trail is a hint, not a history: three screens back is as far as any
      // back control ever asks, and an unbounded array in a long session is a
      // leak nobody would ever look for.
      if (trail.length > 12) trail.shift();
      return;
    }
    // We have been here before, so this was a traversal rather than a new
    // place: drop whatever we walked back over.
    trail.length = seen + 1;
  }, [pathname, search]);
}

/** The path part of a href, so `/channels/x?m=1` and `/channels/x` are the same
 *  place. A back control's promise is the PLACE it names; which message is
 *  highlighted there is not part of that promise, and a warm Back lands the
 *  reader exactly where they left, which is better than the anchor anyway. */
function pathOf(href: string): string {
  const [path] = href.split('#');
  return path.split('?')[0];
}

/**
 * Is the screen this href names the one immediately behind us?
 *
 * Exact where the browser can answer it, advisory where it cannot, and false
 * whenever there is any doubt.
 */
function parentIsBehind(href: string): boolean {
  const navigation = navigationApi();
  if (navigation) {
    if (navigation.canGoBack === false) return false;
    const entries = navigation.entries();
    const index = navigation.currentEntry?.index ?? -1;
    if (index <= 0) return false;
    const previous = entries[index - 1]?.url;
    if (!previous) return false;
    try {
      return new URL(previous).pathname === pathOf(href);
    } catch {
      return false;
    }
  }
  if (trail.length < 2) return false;
  return pathOf(trail[trail.length - 2]) === pathOf(href);
}

/**
 * Spread onto an existing back `<Link>`: `{...useBackTo(parentHref)}`.
 *
 * The href is unchanged. The click handler takes the history move instead only
 * when the parent really is one step behind.
 */
export function useBackTo(href: string): {
  href: string;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
} {
  const router = useRouter();

  const onClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      // Everything that is not a plain left click belongs to the browser: a new
      // tab, a preview, a download. Never take those.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      if (!parentIsBehind(href)) return; // Let the link push.
      event.preventDefault();
      router.back();
    },
    [router, href],
  );

  return { href, onClick };
}
