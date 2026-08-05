'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { V2_SHELL_CONTENT_ID } from './shell-content';

/**
 * ScrollMemory — back/forward + reload scroll restoration for the shell's ONE
 * scroll container (owner, July 31: "I go to a page, scroll to the bottom,
 * then when I go back it scrolls me to the bottom").
 *
 * ── WHY THIS MODULE EXISTS ─────────────────────────────────────────────────
 * v2 scrolls inside `.v2-shell__content`, not the document — and BOTH native
 * history restoration and Next's router manage only the document scroller.
 * The div persists across soft navigations, so its scrollTop simply carried
 * over: Back landed the previous page at wherever the CURRENT page was,
 * clamped (measured: leave the list at 1136 → read a case to 4673 → Back →
 * the list at 1850). Custom scroll containers must restore themselves; this
 * module is that owner.
 *
 * ── THE OWNERSHIP CONTRACT (one owner per motion — keep it this way) ───────
 *   - PUSH navigations: Next's layout router already scrolls the new segment
 *     into view (measured: every push lands the div at top). This module
 *     NEVER touches a push.
 *   - BACK/FORWARD (popstate) and RELOAD: this module restores the entry's
 *     saved offset. Nothing else in v2 may write scrollTop across a
 *     navigation boundary.
 *   - User-initiated scrolls (new-rows pill, outline anchors) are never
 *     fought — restoration happens only at navigation boundaries.
 *
 * ── WHEN AN OFFSET IS SAVED (the part a scroll listener gets wrong) ────────
 * Recording the reader's CURRENT position under the CURRENT entry's key is
 * valid at any moment — so the design records eagerly at the moments that
 * precede every way of leaving a page, each chosen for measured timing:
 *
 *   - any CLICK (capture phase) — the instant before an App Router push can
 *     begin. The `navigate` event is TOO LATE for pushes: Next calls
 *     `pushState` after the new page is committed and the scroller has
 *     already moved (measured: a mid-transition clamp recorded onto the page
 *     being left). Keyboard link activation synthesizes a click, so it is
 *     covered too.
 *   - `navigate` with type 'traverse' or 'reload' — browser Back/Forward
 *     buttons and reloads fire it synchronously BEFORE anything changes,
 *     while `history.state` still belongs to the page being left. 'push' is
 *     ignored (see above); 'replace' is ignored (nothing is being left).
 *     Observation only — `intercept()` is never called.
 *
 * Engines without the Navigation API fall back to a rAF-throttled scroll
 * listener: same store, same restore, just boundary-inexact under the push
 * race — a degradation, never a break.
 *
 * ── HOW AN ENTRY IS IDENTIFIED (the quiet stamp) ───────────────────────────
 * Offsets are keyed per HISTORY ENTRY, not per URL — two list entries at
 * different depths restore differently. The key is a random id stamped onto
 * `history.state` via `replaceState({ ...state, __v2ScrollKey })`: the spread
 * preserves Next's `__NA` marker and `__PRIVATE_NEXTJS_INTERNALS_TREE`, and a
 * state CARRYING `__NA` makes the App Router's patched `replaceState`
 * early-return to the native call (the same verified mechanism as
 * `quietReplaceUrlParams` — no ACTION_RESTORE, no segment-cache walk). An
 * entry whose state lacks the `__NA` marker is NEVER stamped — a fabricated
 * state object would trigger the Next 16 restore-reducer walk that
 * url-params.ts documents — it just goes unrecorded until Next owns it.
 * `history.state` survives reloads, so stamped keys + sessionStorage give
 * reload restoration for free — native parity for document scrollers.
 * The chat's quiet-pushed `?chat=` entries clone the live state object, key
 * included: those entries SHARE an offset by construction, which is correct —
 * opening or closing the panel must never move the page.
 *
 * WHEN the stamp is written matters as much as what it carries: stamping is
 * done in a SETTLE EFFECT after each navigation commits (pathname or
 * searchParams change — the latter re-stamps entries whose state a loud
 * `replaceUrlParams(null)` write rebuilt), and NEVER inside the `navigate`
 * event: a `replaceState` issued while a navigation is being processed
 * cancels that navigation (measured — the click simply never landed). The
 * boundary snapshot therefore only READS the stamp; an entry the settle
 * effect has not reached yet goes unrecorded once, harmlessly.
 *
 * ── RESTORE SEMANTICS (the second part naive implementations get wrong) ────
 * On traversal the returning page usually streams in as a skeleton, so the
 * target height does not exist yet. Restoring immediately would clamp to the
 * skeleton — the very bug being fixed. So: if the height is already there
 * (router-cache hit), restore in the same frame; otherwise pin to top (the
 * honest skeleton position) and retry each frame until the scroller can hold
 * the target, giving up cleanly at top after {@link RESTORE_DEADLINE_MS}.
 * Restoration is INSTANT, never smooth. The reader outranks the machine: a
 * wheel / touch / key press aborts the pending restore, and a navigation
 * during a pending restore skips its snapshot (the reader never established
 * a position there).
 */

/**
 * ── WHICH ELEMENT SCROLLS (added with the collab frame, Aug 5) ─────────────
 * `.v2-shell__content` is no longer the only scroller. A route may dock a
 * persistent frame — the space rail beside a channel — in which case the frame
 * is `h-full` and the PANE inside it owns the scroll, or the rail would scroll
 * away with the conversation. Such a pane marks itself with
 * {@link V2_SCROLLER_ATTR}, and this module restores the innermost marked
 * scroller when one is mounted, falling back to the shell's.
 *
 * The element is therefore resolved AT EVERY USE, never captured once: an
 * offset is keyed to a history entry, and the entry's route decides which
 * element that offset belongs to. For the same reason the fallback scroll
 * listener and the restore-abort listeners bind to `document` in the capture
 * phase (scroll does not bubble, but it does capture) rather than to an
 * element that the next navigation may replace.
 */
const V2_SCROLLER_ATTR = 'data-v2-scroller';

/** Sits beside Next's own fields on `history.state`. */
const KEY_FIELD = '__v2ScrollKey';
/** The App Router marker url-params.ts documents — presence ⇒ quiet writes. */
const NEXT_MARKER = '__NA';
const STORAGE_KEY = 'v2-scroll-memory';
/** Offsets kept (LRU) — a session's plausible Back/Forward reach. */
const MAX_ENTRIES = 50;
/** How long a streaming page gets to grow before a restore gives up at top. */
const RESTORE_DEADLINE_MS = 3000;
/** How long a hard-loaded entry gets to become router-owned before the
 *  settle effect stops retrying its stamp. */
const STAMP_DEADLINE_MS = 5000;
const PERSIST_DEBOUNCE_MS = 300;

type HistoryState = Record<string, unknown> | null;

/** The slice of the Navigation API this module observes (lib.dom does not
 *  ship it on every TS target yet). Observation only — never `intercept`. */
interface NavigateEventLike extends Event {
  hashChange?: boolean;
  navigationType?: 'push' | 'replace' | 'traverse' | 'reload';
}
interface NavigationLike {
  addEventListener: (type: 'navigate', listener: (event: NavigateEventLike) => void) => void;
  removeEventListener: (type: 'navigate', listener: (event: NavigateEventLike) => void) => void;
}

function loadStore(): Map<string, number> {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Map();
    return new Map(
      parsed.filter(
        (row): row is [string, number] =>
          Array.isArray(row) && typeof row[0] === 'string' && typeof row[1] === 'number',
      ),
    );
  } catch {
    return new Map();
  }
}

function makeKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Read the current entry's stamp — pure, safe anywhere. */
function readKey(state: HistoryState): string | null {
  return state && typeof state[KEY_FIELD] === 'string' ? (state[KEY_FIELD] as string) : null;
}

/**
 * The key of the entry the reader is on RIGHT NOW — the settle effect's
 * in-memory mirror of the stamp. The boundary snapshot falls back to it when
 * a Next write has just wiped the stamp off `history.state` (one instance
 * per app, like the store above).
 */
let activeKey: string | null = null;

/**
 * True from the moment a navigation starts being processed until the next
 * settle effect — the re-assert loop must never `replaceState` inside that
 * window (a history write mid-processing cancels the navigation; measured).
 */
let stampingSuspended = false;

export function ScrollMemory() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The settle effect: after every committed navigation (and after loud
  // filter writes rebuild the entry's state), keep the entry stamped. A
  // one-shot stamp is NOT enough (both measured on hard loads): the effect
  // can run before the App Router owns `history.state`, and Next's
  // post-hydration init can rewrite the state AFTER a successful stamp,
  // wiping it. So the effect chooses ONE stable key for this navigation
  // (adopting an existing stamp — a traversed-to entry keeps its identity),
  // then re-asserts it every frame until the entry has held it long enough
  // to be settled — one property read per frame, a write only when missing.
  useEffect(() => {
    stampingSuspended = false;
    const key = readKey(window.history.state as HistoryState) ?? makeKey();
    activeKey = key;
    const deadline = performance.now() + STAMP_DEADLINE_MS;
    let frame = 0;
    const tick = () => {
      frame = 0;
      if (stampingSuspended) return;
      const state = window.history.state as HistoryState;
      if (state && NEXT_MARKER in state && readKey(state) !== key) {
        window.history.replaceState({ ...state, [KEY_FIELD]: key }, '', window.location.href);
      }
      if (performance.now() > deadline) return;
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pathname, searchParams]);

  useEffect(() => {
    /** The scroller that owns the current route (see the docblock). */
    const activeScroller = (): HTMLElement | null =>
      document.querySelector<HTMLElement>(`[${V2_SCROLLER_ATTR}]`) ??
      document.getElementById(V2_SHELL_CONTENT_ID);

    const offsets = loadStore();
    let restorePending = false;
    let persistTimer = 0;
    let cancelRestore: (() => void) | null = null;

    const persistNow = () => {
      window.clearTimeout(persistTimer);
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...offsets]));
      } catch {
        // Storage unavailable — in-memory restoration still works this visit.
      }
    };
    const persistSoon = () => {
      window.clearTimeout(persistTimer);
      persistTimer = window.setTimeout(persistNow, PERSIST_DEBOUNCE_MS);
    };

    const record = (key: string | null, top: number) => {
      if (!key) return;
      // LRU touch: re-insertion keeps the eviction order honest.
      offsets.delete(key);
      offsets.set(key, top);
      while (offsets.size > MAX_ENTRIES) {
        const oldest = offsets.keys().next().value;
        if (oldest === undefined) break;
        offsets.delete(oldest);
      }
    };

    /* ── Saving ──────────────────────────────────────────────────────────── */

    // PRIMARY: the boundary-exact snapshot (see docblock). READ-ONLY — a
    // stamp write here would cancel the navigation being processed, so it
    // also suspends the settle effect's re-assert loop until the next
    // committed navigation restarts it. `activeKey` covers the window where
    // a Next write has just wiped the entry's stamp.
    const navigation = (window as { navigation?: NavigationLike }).navigation;
    const onNavigate = (event: NavigateEventLike) => {
      if (event.hashChange) return; // in-page jump, not a page boundary
      // The API fires for EVERY history change — including each
      // `replaceState` (Next's post-hydration init, loud filter writes, this
      // module's own stamps). A replace rewrites the entry in place: no page
      // is being left, so there is nothing to snapshot and no navigation
      // whose processing a stamp write could cancel. Ignoring them is what
      // keeps the re-assert loop alive on hard-loaded pages (measured: a
      // 'replace'-triggered suspension left the first entry permanently
      // unstamped, so its offset could never be named on return).
      if (event.navigationType === 'replace') return;
      stampingSuspended = true;
      // A snapshot here is timing-safe ONLY for traverse/reload/cross-doc:
      // those fire before anything changes. An App Router 'push' reaches
      // `pushState` — and therefore this event — AFTER the new page has
      // already been committed and the scroller moved (measured: 241, a
      // mid-transition clamp, recorded onto the page being left). Pushes are
      // covered by the capture-phase click snapshot below instead.
      if (event.navigationType === 'push') return;
      if (restorePending) return;
      const el = activeScroller();
      if (!el) return;
      record(readKey(window.history.state as HistoryState) ?? activeKey, el.scrollTop);
      persistNow(); // synchronous — this may be the last tick before unload
    };

    // The pre-push snapshot: every activation (mouse or keyboard — keyboard
    // link activation synthesizes a click) records the current entry's TRUE
    // position before any transition can move the scroller. Recording the
    // reader's real position is valid at any moment, so over-recording on
    // non-navigating clicks costs one map write and can never corrupt.
    const onAnyClick = () => {
      if (restorePending) return;
      const el = activeScroller();
      if (!el) return;
      record(readKey(window.history.state as HistoryState) ?? activeKey, el.scrollTop);
      persistSoon();
    };

    // FALLBACK: rAF-throttled continuous saving for engines without the API.
    // Same read-only key resolution as the snapshot — the settle effect owns
    // all stamping.
    let rafId = 0;
    const saveFrame = () => {
      rafId = 0;
      if (restorePending) return;
      const el = activeScroller();
      if (!el) return;
      record(readKey(window.history.state as HistoryState) ?? activeKey, el.scrollTop);
      persistSoon();
    };
    // Capture phase on the document: scroll does not bubble, but it does
    // capture, so one listener covers whichever element owns the route.
    const onScroll = (event: Event) => {
      if (restorePending || rafId) return;
      if (event.target !== activeScroller()) return;
      rafId = window.requestAnimationFrame(saveFrame);
    };

    /* ── Restoring ───────────────────────────────────────────────────────── */

    const restore = (key: string | null) => {
      cancelRestore?.();
      const target = (key && offsets.get(key)) || 0;
      restorePending = true;

      let frame = 0;
      const deadline = performance.now() + RESTORE_DEADLINE_MS;
      const abortEvents = ['wheel', 'touchstart', 'keydown'] as const;
      const finish = () => {
        cancelRestore?.();
        cancelRestore = null;
        // Resume on the NEXT frame so the set/clamp scroll event above is
        // never recorded by the fallback listener as the reader's own.
        window.requestAnimationFrame(() => {
          restorePending = false;
        });
      };
      const abort = () => finish();
      // Resolved per attempt, not captured: on a traversal the returning
      // route's scroller may not be the one that was mounted when the restore
      // began (a collab pane replacing the shell scroller, or the reverse).
      const fits = (el: HTMLElement) => el.scrollHeight - el.clientHeight >= target;

      cancelRestore = () => {
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
        for (const type of abortEvents) document.removeEventListener(type, abort, true);
      };

      const first = activeScroller();
      if (first && (target === 0 || fits(first))) {
        first.scrollTop = target;
        finish();
        return;
      }

      // Streaming return: pin to the honest skeleton position and wait for
      // the page to grow tall enough to hold the reader's place.
      if (first) first.scrollTop = 0;
      for (const type of abortEvents) {
        document.addEventListener(type, abort, { capture: true, passive: true });
      }
      const tick = () => {
        frame = 0;
        const el = activeScroller();
        if (el && fits(el)) {
          el.scrollTop = target;
          finish();
          return;
        }
        if (performance.now() > deadline) {
          finish();
          return;
        }
        frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
    };

    const onPopState = () => restore(readKey(window.history.state as HistoryState));
    const onPageHide = () => persistNow();

    /* ── Wiring ──────────────────────────────────────────────────────────── */

    if (navigation) {
      navigation.addEventListener('navigate', onNavigate);
      document.addEventListener('click', onAnyClick, { capture: true, passive: true });
    } else {
      document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    }
    window.addEventListener('popstate', onPopState);
    window.addEventListener('pagehide', onPageHide);

    // Reload / cross-document return: the stamp survives on history.state, the
    // offsets in sessionStorage — restore exactly like a traversal. A fresh
    // entry has no stamp and restores nowhere.
    const initialKey = readKey(window.history.state as HistoryState);
    if (initialKey) restore(initialKey);

    return () => {
      cancelRestore?.();
      if (rafId) window.cancelAnimationFrame(rafId);
      if (navigation) {
        navigation.removeEventListener('navigate', onNavigate);
        document.removeEventListener('click', onAnyClick, { capture: true });
      } else {
        document.removeEventListener('scroll', onScroll, true);
      }
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('pagehide', onPageHide);
      persistNow();
    };
  }, []);

  return null;
}
