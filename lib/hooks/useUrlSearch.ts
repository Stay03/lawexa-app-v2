import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { replaceUrlParams } from '@/lib/utils/url-params';

/**
 * A search box whose text lives in the URL and survives fast typing.
 *
 * ── A PORT OF `v2/runtime/use-url-search.ts`, ALGORITHM UNCHANGED ──────────
 * v1 code may not import from `v2/` (the reverse boundary in
 * `eslint.config.mjs`). The v2 hook is the third attempt at this box, and its
 * docblock records the two that failed: one never re-read the URL, so a soft
 * navigation left stale text in the box; the next committed through
 * `router.replace`, and a late echo of an older value wiped what the owner was
 * typing. Read that docblock before changing the reconcile below.
 *
 * One thing is added: `resets`, the query-string keys a new search deletes.
 * The applications screen passes `page`, so a narrower result never opens on a
 * page past its end.
 *
 * ── HOW IT STAYS SAFE ──────────────────────────────────────────────────────
 *  1. It commits 300ms after the last keystroke, through `replaceUrlParams`,
 *     a native history write with no navigation queue behind it.
 *  2. The box shows a local `draft` while one exists and does not read the URL
 *     then. `useSearchParams` updates inside `startTransition`, so it can trail
 *     the typing, and the draft keeps that lag off the screen.
 *  3. A URL change is reconciled once, guarded by `seen`. A value found in
 *     `pending` (this box's own writes, consumed as their echoes land) is an
 *     echo. Anything else is external (Back, a link, a Clear somewhere else),
 *     and the box follows the URL.
 *
 * The only state set during render is React's documented "adjust state while
 * rendering" reset, which passes `react-hooks/set-state-in-render`. v2 found
 * the same reset inside an effect fails `react-hooks/set-state-in-effect`.
 */

const DEBOUNCE_MS = 300;

/** The default for `resets`. Module-level, so its identity never changes. */
const NO_RESETS: readonly string[] = [];

export interface UrlSearch {
  /** The search in the URL. Filter the list by this. */
  committedSearch: string;
  /** What the input shows. */
  inputValue: string;
  /** Updates the box and (re)schedules the URL commit. */
  onInputChange: (value: string) => void;
  /** Empties the box and the URL at once. */
  onClear: () => void;
}

/**
 * @param param  the query-string key this box owns.
 * @param resets keys to delete whenever a new search is committed. Pass a
 *               module-level constant: a new array on every render would
 *               rebuild the callbacks on every render.
 */
export function useUrlSearch(
  param = 'search',
  resets: readonly string[] = NO_RESETS
): UrlSearch {
  const searchParams = useSearchParams();
  const committedSearch = searchParams.get(param) ?? '';

  // The box text while the user is editing. `null` means the box follows the URL.
  const [draft, setDraft] = useState<string | null>(null);
  // The last URL value already reconciled, so the reconcile runs once per change.
  const [seen, setSeen] = useState(committedSearch);
  // This box's own URL writes whose echoes have not landed yet.
  const [pending, setPending] = useState<string[]>([]);

  // Read by the debounce when it fires, so a commit whose draft an external
  // change has since dropped writes nothing.
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  if (committedSearch !== seen) {
    setSeen(committedSearch);
    const index = pending.indexOf(committedSearch);
    if (index !== -1) {
      // Our echo. Consume it, and any earlier writes it overtook.
      const rest = pending.slice(index + 1);
      setPending(rest);
      // Drop the draft only once it has fully landed with nothing newer in
      // flight. Otherwise it is typing that came after this commit: keep it.
      if (draft !== null && draft === committedSearch && rest.length === 0) {
        setDraft(null);
      }
    } else {
      // External. The box follows the URL and our outstanding writes are void.
      if (draft !== null) setDraft(null);
      if (pending.length !== 0) setPending([]);
    }
  } else if (pending.length !== 0 && (draft === null || draft === committedSearch)) {
    // Two writes that net to an unchanged URL (a commit and a clear inside one
    // transition) never show as a change above, so their entries would stay in
    // `pending` and could make a later navigation to the same value look like
    // our echo. Once the box shows exactly the URL, nothing is in flight.
    setPending([]);
    if (draft !== null) setDraft(null);
  }

  const inputValue = draft !== null ? draft : committedSearch;

  const commit = useCallback(
    (value: string) => {
      if (typeof window === 'undefined') return;
      const current = new URLSearchParams(window.location.search).get(param) ?? '';
      if (current === value) return;
      setPending((previous) => [...previous, value]);
      const updates: Record<string, string | null> = { [param]: value || null };
      for (const key of resets) updates[key] = null;
      replaceUrlParams(updates);
    },
    [param, resets]
  );

  const onInputChange = useCallback(
    (value: string) => {
      setDraft(value);
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        // The LIVE draft, and only while one exists: typing that an external
        // change has dropped must not come back.
        const latest = draftRef.current;
        if (latest !== null) commit(latest);
      }, DEBOUNCE_MS);
    },
    [clearTimer, commit]
  );

  const onClear = useCallback(() => {
    // An empty draft rather than `null`, so the box empties now instead of
    // showing the old URL value while the commit's transition lands.
    setDraft('');
    clearTimer();
    commit('');
  }, [clearTimer, commit]);

  // A commit still waiting at unmount would write into the next page's URL.
  useEffect(() => () => clearTimer(), [clearTimer]);

  return { committedSearch, inputValue, onInputChange, onClear };
}
