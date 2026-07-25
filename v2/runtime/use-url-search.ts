'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { replaceUrlParams } from './url-params';

/**
 * useUrlSearch — the URL-synced, 300ms-debounced search box every v2 list page
 * shares (`/conversations`, `/cases`, and the phase-4 statute/note lists).
 *
 * Built for `/conversations` and rebuilt RACE-FREE after the owner reported
 * "characters keep disappearing and appearing if I type fast, it's unusable";
 * lifted into `v2/runtime/` unchanged when the cases list needed the same box.
 * It is parameterised only by the QUERY-STRING KEY — every other line is the
 * original, because the failure modes below are not conversations-specific and
 * a second hand-rolled search box would rediscover them.
 *
 * ── THE TWO PRIOR FAILURES ────────────────────────────────────────────────────
 * v0 lazy-inited the box from the URL once and never resynced, so an in-app soft
 * nav to the bare path reset the LIST but left stale text in the box.
 * v1 (hot-reverted `f699ec1`) committed via `router.replace` — an ASYNC RSC round
 * trip whose echoes arrive with unbounded, out-of-order lag — then compared the URL
 * against "the last value I committed"; a stale echo was misclassified as external
 * and clobbered the box (characters vanish), then the fresh echo re-adopted them.
 *
 * ── HOW THIS SHAPE IS SAFE ────────────────────────────────────────────────────
 *
 *   (1) COMMIT VIA THE NATIVE HISTORY API, WITH A `null` STATE ARG — see
 *       `v2/runtime/url-params.ts`, which owns that write and the full argument
 *       for why the state argument must be `null`. The write stays on the CLIENT
 *       (the page's server component reads no `searchParams`), so there is no
 *       async navigation queue and thus no out-of-order echo.
 *
 *   (2) THE BOX IS A LOCAL DRAFT; EXTERNAL vs OUR-OWN CHANGES ARE TOLD APART BY A
 *       CONSUMED SELF-WRITE QUEUE. `applyUrlFromHistoryPushReplace` dispatches the
 *       sync inside `startTransition`, so `committedSearch` (the URL) updates at
 *       TRANSITION priority — it can lag the synchronous write by ~a frame. While a
 *       `draft` exists the box renders `draft` and NEVER reads `committedSearch`, so
 *       that lag can never blank or replay what the user is typing. When the URL does
 *       change we reconcile ONCE (guarded by `seen`): if the new value is one of our
 *       own outstanding writes (`pending`, consumed here) it is our echo — keep the
 *       draft when it is newer typing (the post-commit keystroke), otherwise drop it
 *       once it has fully landed; if it is NOT in `pending` it is a genuine external
 *       change (soft nav, back/forward, URL edit) and we reset the box to the URL.
 *       Consuming `pending` is what defeats the v1 trap: a value is "ours" only until
 *       its echo is seen, so re-navigating to a value we once wrote is correctly
 *       external — no stale comparison can resurrect abandoned typing.
 *
 * The only render-phase state writes are the sanctioned "adjust state during render"
 * resets (verified: they pass `--max-warnings 0`, whereas the same reset in an effect
 * trips `react-hooks/set-state-in-effect`). `committedSearch` is the single source of
 * truth for the LIST query + shareable URL; `draft` is the single source of truth for
 * the box.
 */

const DEBOUNCE_MS = 300;

export interface UrlSearch {
  /** The active (debounced) search that the list query is filtered by. */
  committedSearch: string;
  /** The immediate value shown in the input. */
  inputValue: string;
  /** Update the field + (re)schedule the debounced URL commit. */
  onInputChange: (value: string) => void;
  /** Clear both the field and the URL immediately (X + empty-state action). */
  onClear: () => void;
}

/**
 * @param param the query-string key this box owns. Every list page uses
 *              `'search'`; the argument exists so a surface with two independent
 *              text filters could not accidentally share one entry.
 */
export function useUrlSearch(param = 'search'): UrlSearch {
  const searchParams = useSearchParams();
  const committedSearch = searchParams.get(param) ?? '';

  // The box text while the user is editing (`null` ⇒ the box follows the URL). The
  // single source of truth for what the field shows; never derived from a URL echo.
  const [draft, setDraft] = useState<string | null>(null);
  // The last committed value already reconciled, so the reconcile below runs exactly
  // once per URL change.
  const [seen, setSeen] = useState(committedSearch);
  // Our own outstanding URL writes, consumed as their echoes arrive. Membership here
  // is what marks an incoming `committedSearch` as ours rather than external.
  const [pending, setPending] = useState<string[]>([]);

  // Mirror of `draft`, read by the debounce at fire time (300ms later, so this
  // effect-sync is always current by then) to abandon a commit whose draft has since
  // been cleared or superseded.
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

  // ── Reconcile a URL change exactly once (the "adjust state during render" reset) ──
  if (committedSearch !== seen) {
    setSeen(committedSearch);
    const idx = pending.indexOf(committedSearch);
    if (idx !== -1) {
      // OUR echo. Consume it (and any earlier writes this one leapfrogged).
      const rest = pending.slice(idx + 1);
      setPending(rest);
      // Drop the draft only once it has fully landed with nothing newer in flight;
      // otherwise keep it — it is typing that post-dates this commit (the transition
      // -lag keystroke), so the box keeps showing it, re-based onto the new URL.
      if (draft !== null && draft === committedSearch && rest.length === 0) {
        setDraft(null);
      }
    } else {
      // EXTERNAL change (soft nav, back/forward, URL edit). Reset box + list together:
      // the box follows the URL and any in-flight self-writes are discarded.
      if (draft !== null) setDraft(null);
      if (pending.length !== 0) setPending([]);
    }
  } else if (pending.length !== 0 && (draft === null || draft === committedSearch)) {
    // IDLE-AND-SYNCED PRUNE (re-verify residual (c)): a coalesced pair of writes
    // that nets an UNCHANGED URL (e.g. debounce-commit('a') + immediate clear
    // within one transition window) never produces an observable `committedSearch`
    // change, so the reconcile above never consumes those entries. Once the box
    // shows exactly the URL, nothing is meaningfully in flight — a legitimate
    // in-flight echo always has `draft` differing from the lagging URL — so any
    // remaining entries are dead orphans. Drop them so a much-later external nav
    // to the same value can never be misclassified as our own echo.
    setPending([]);
    if (draft !== null) setDraft(null);
  }

  // Box value, PURELY DERIVED — the draft while editing, else the URL. No URL echo
  // can overwrite in-flight typing.
  const inputValue = draft !== null ? draft : committedSearch;

  // Write the value into the URL. Reads the LIVE URL (never a stale React snapshot)
  // to skip a redundant write, and records the write in `pending` so its echo is
  // recognised as ours. `replaceUrlParams` preserves every other parameter.
  const commit = useCallback(
    (value: string) => {
      if (typeof window === 'undefined') return;
      const current =
        new URLSearchParams(window.location.search).get(param) ?? '';
      if (current === value) return; // already reflected
      setPending((prev) => [...prev, value]);
      replaceUrlParams({ [param]: value || null });
    },
    [param],
  );

  const onInputChange = useCallback(
    (value: string) => {
      setDraft(value);
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        // Commit the LIVE draft, and only while one exists: if an external change (or
        // clear) has since dropped it, this late timer commits nothing, so it can
        // never re-apply typing the user has navigated away from.
        const latest = draftRef.current;
        if (latest !== null) commit(latest);
      }, DEBOUNCE_MS);
    },
    [clearTimer, commit],
  );

  const onClear = useCallback(() => {
    // Empty draft (not `null`) so the box shows empty immediately, without a one-frame
    // flash of the pre-clear URL value while the commit's transition lands.
    setDraft('');
    clearTimer();
    commit('');
  }, [clearTimer, commit]);

  // Cancel any pending debounce on unmount — no state set here, so lint-clean.
  useEffect(() => () => clearTimer(), [clearTimer]);

  return { committedSearch, inputValue, onInputChange, onClear };
}
