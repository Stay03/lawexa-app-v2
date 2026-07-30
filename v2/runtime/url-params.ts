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
 * Merge `updates` into the current query string and replace the history entry.
 * A `null` (or empty-string) value DELETES the key. Returns `false` — without
 * touching history — when the URL would not actually change, so a redundant
 * write can never push a no-op entry or wake a `useSearchParams` subscriber.
 *
 * Reads `window.location` rather than a React snapshot on purpose: the live URL
 * is the only value guaranteed to be current at the moment of the write, so
 * parameters this call does not name are always preserved as they really are.
 */
export function replaceUrlParams(
  updates: Record<string, string | null>,
): boolean {
  if (typeof window === 'undefined') return false;

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

  if (!changed) return false;

  const queryString = params.toString();
  window.history.replaceState(
    // MUST be null — see the docblock. Never `window.history.state`.
    null,
    '',
    queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname,
  );
  return true;
}

/**
 * The PUSH twin of `replaceUrlParams` — same guarded merge, same load-bearing
 * `null` state argument, but it ADDS a history entry. For state a user expects
 * the back button to undo: opening the case page's side chat pushes
 * `?chat={id}`, so Back closes the panel instead of leaving the page.
 */
export function pushUrlParams(updates: Record<string, string | null>): boolean {
  if (typeof window === 'undefined') return false;

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

  if (!changed) return false;

  const queryString = params.toString();
  window.history.pushState(
    // MUST be null — see the docblock. Never `window.history.state`.
    null,
    '',
    queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname,
  );
  return true;
}
