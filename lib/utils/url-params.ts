/**
 * Writing list filters into the URL from v1 screens, without a navigation.
 *
 * ── A PORT, BECAUSE AN IMPORT IS NOT ALLOWED ───────────────────────────────
 * `v2/runtime/url-params.ts` owns this write for v2 and carries the full
 * argument for it. v1 code may not import from `v2/`: the reverse boundary in
 * `eslint.config.mjs` lets only dependency-free contract modules across, and
 * a history write is not one. So the loud replace is copied here unchanged,
 * first for the ambassador applications screen (2026-09-10).
 *
 * ── WHY NOT `router.replace` ───────────────────────────────────────────────
 * v2 once committed its search box through `router.replace`, and a late echo
 * of an older value wiped what the owner was typing (the history is in
 * `v2/runtime/use-url-search.ts`). The native write below changes the URL at
 * once and goes through no navigation queue.
 *
 * ── THE `null` STATE ARGUMENT IS LOAD-BEARING ──────────────────────────────
 * Read in next@16.2.12 `dist/client/components/app-router.js`: the App Router
 * patches `history.replaceState`. When the state argument carries Next's own
 * `__NA` or `_N` marker, the patch goes straight to the native call and
 * `useSearchParams` never sees the change. With `null`, the patch copies
 * Next's internal tree onto the entry and syncs `useSearchParams`, inside
 * `startTransition`. That last part is why a text box cannot be bound to the
 * URL directly: its value would update at transition priority, behind the
 * keystroke. `useUrlSearch` is the box built for that.
 */

/**
 * Merge `updates` into the LIVE query string and replace the current history
 * entry. A `null` or empty value deletes its key; keys that are not named keep
 * the value they really have.
 *
 * Reads `window.location`, never a React snapshot: two writes in one event
 * would otherwise build on a URL the first one has already changed. Returns
 * `false`, and writes nothing, when the URL would not change.
 */
export function replaceUrlParams(updates: Record<string, string | null>): boolean {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  let changed = false;

  for (const [key, value] of Object.entries(updates)) {
    const next = value ?? '';
    if ((params.get(key) ?? '') === next) continue;
    if (next) params.set(key, next);
    else params.delete(key);
    changed = true;
  }

  if (!changed) return false;

  const query = params.toString();
  window.history.replaceState(
    // MUST be `null`. See the docblock above; never `window.history.state`.
    null,
    '',
    query ? `${window.location.pathname}?${query}` : window.location.pathname
  );
  return true;
}
