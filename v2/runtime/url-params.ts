'use client';

/**
 * url-params — the ONE way v2 writes a filter into the URL without a server
 * round trip.
 *
 * WHY IT IS NOT `router.replace`. A v2 list page reads NOTHING from
 * `searchParams` on the server (the page renders one client component), so a
 * router navigation would fetch an RSC payload that cannot differ from the one
 * already on screen — and, worse, each distinct query string is its OWN client
 * router-cache entry, so `unstable_dynamicStaleTime` cannot help: every filter
 * change would pay a network round trip and re-show `loading.tsx`. Writing the
 * URL natively keeps the whole interaction on the client, which is what makes a
 * tag chip or a view tab respond in the same frame it was pressed.
 *
 * THE `null` STATE ARGUMENT IS LOAD-BEARING (verified against next@16.2.10
 * `app-router.js`). The App Router monkey-patches `history.replaceState`: when
 * the state argument carries Next's own `__NA` / `_N` marker the patch EARLY-
 * RETURNS to the native call, and the `useSearchParams` sync
 * (`applyUrlFromHistoryPushReplace`) never runs — the URL bar would move while
 * every `useSearchParams()` consumer kept the old value. Passing `null` is also
 * what PRESERVES the router's internal history tree: Next's
 * `copyNextJsInternalHistoryState(null)` re-copies `__NA` and
 * `__PRIVATE_NEXTJS_INTERNALS_TREE` onto the new entry, so back/forward stay a
 * soft restore instead of a hard reload.
 *
 * This is the mechanism `useUrlSearch` was built on (the race-free rebuild of
 * the conversations search box); it is extracted here so the cases page's tag
 * and view filters use the identical, already-proven write path rather than a
 * second hand-rolled one.
 */

/**
 * The shared guarded merge: `updates` folded into the LIVE query string. A
 * `null` (or empty-string) value DELETES the key; `null` return means the URL
 * would not change, so no write should happen — a redundant write can never
 * push a no-op entry or wake a `useSearchParams` subscriber.
 *
 * Reads `window.location` rather than a React snapshot on purpose: the live URL
 * is the only value guaranteed to be current at the moment of the write, so
 * parameters a call does not name are always preserved as they really are.
 */
function mergeSearch(updates: Record<string, string | null>): string | null {
  const params = new URLSearchParams(window.location.search);
  let changed = false;

  for (const [key, value] of Object.entries(updates)) {
    const next = value ?? '';
    const current = params.get(key) ?? '';
    if (current === next) continue;
    if (next) params.set(key, next);
    else params.delete(key);
    changed = true;
  }

  if (!changed) return null;
  const queryString = params.toString();
  return queryString
    ? `${window.location.pathname}?${queryString}`
    : window.location.pathname;
}

/**
 * Merge `updates` into the current query string and replace the history entry,
 * THROUGH the App Router's patched history — `useSearchParams` consumers see
 * the change. For list filters, where the URL is the state.
 */
export function replaceUrlParams(
  updates: Record<string, string | null>,
): boolean {
  if (typeof window === 'undefined') return false;
  const url = mergeSearch(updates);
  if (url === null) return false;
  window.history.replaceState(
    // MUST be null — see the docblock. Never `window.history.state`.
    null,
    '',
    url,
  );
  return true;
}

/**
 * QUIET twins — the same guarded merge, but the write DOES NOT wake the App
 * Router. For URL state whose ONLY reader is component state (the case page's
 * side chat), never a `useSearchParams()` consumer.
 *
 * WHY A SECOND WRITE PATH EXISTS (verified against next@16.2.10 on the
 * deployed app, July 30). The loud write's `null` state makes Next dispatch
 * ACTION_RESTORE — and in Next 16 that is no longer a passive URL sync: the
 * restore reducer runs `startPPRNavigation` + `spawnDynamicRequests` over the
 * router's client tree. On a route served through the v2 REWRITE proxy
 * (`/cases/x` → `app/v2/cases/x`), a soft-navigated case page's tree carries a
 * broken `[slug]` param, so that walk fetches `/cases/undefined` — and the
 * mismatch-retry handler then refetches it in waves of four, FOREVER. Those
 * background commits are what kept resurrecting the closing chat panel
 * ("closes, pops open, closes again") — constant on prod, invisible on a
 * hard-loaded local page, which is why three fixes at the panel level missed.
 *
 * The quiet write severs the trigger: it passes the CURRENT entry's state
 * object straight through. That state already carries Next's own `__NA` marker
 * and `__PRIVATE_NEXTJS_INTERNALS_TREE`, so the patched `history.pushState` /
 * `history.replaceState` EARLY-RETURN to the native call — no restore action,
 * no segment-cache walk, no loop — while the entry keeps the exact internal
 * tree Next needs to handle Back/Forward over it normally. Nothing is
 * fabricated: same page, same tree; only the URL string changes.
 *
 * The trade: `useSearchParams()` does NOT see quiet writes. That is the
 * contract — list filters (`?q=`, tags) must keep using the LOUD writes above;
 * quiet writes are only for a mirror of state React already owns.
 */

/** Quietly ADD a history entry with the merged URL — Back returns to the
 * current entry. For the side chat's open, so Back closes the panel. */
export function quietPushUrlParams(
  updates: Record<string, string | null>,
): boolean {
  if (typeof window === 'undefined') return false;
  const url = mergeSearch(updates);
  if (url === null) return false;
  window.history.pushState(window.history.state, '', url);
  return true;
}

/** Quietly rewrite the current history entry's URL in place. */
export function quietReplaceUrlParams(
  updates: Record<string, string | null>,
): boolean {
  if (typeof window === 'undefined') return false;
  const url = mergeSearch(updates);
  if (url === null) return false;
  window.history.replaceState(window.history.state, '', url);
  return true;
}
