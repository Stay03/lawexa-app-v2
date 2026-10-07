/**
 * Prefetch a link's page only when the reader shows intent: a touch, keyboard
 * focus, or the mouse resting on it. Never because the link scrolled into view.
 *
 * WHY (owner, 6 October 2026, "yes go"). A case-library search showed 15 rows,
 * and Next's default viewport prefetch fetched each row's page twice (route
 * tree, then the page down to its loading boundary): 32 requests and about
 * 90 KB per search, and up to 9 API reads on the server, repeated on every
 * keystroke that changed the rows. Almost none of those pages are opened.
 *
 * - Keyboard focus prefetches AT ONCE: a focused row is about to get Enter.
 * - A mouse prefetches after it RESTS on the row for `restMs`, and leaving
 *   cancels it, so a pointer crossing the list on its way elsewhere costs
 *   nothing.
 * - A finger is a TAP only if it does not move. A scroll also starts with a
 *   touch on a row, so a touch waits `INTENT_TOUCH_MS`, any movement cancels
 *   it, and lifting the finger without moving prefetches at once. A tap
 *   therefore always prefetches before its click; a scroll never does.
 * - Each href is prefetched once per row; Next dedupes the rest.
 *
 * Pure (timers injected), so the rules are tested without a browser.
 */
/** What showed the intent: a finger, or a mouse, pen or keyboard focus. */
export type IntentSource = 'touch' | 'pointer';

export interface IntentPrefetch {
  /** Mouse entered or finger down: prefetch if still there after `ms`
   *  (default `restMs`). */
  rest(href: string, ms?: number, source?: IntentSource): void;
  /** Mouse left, finger moved, touch cancelled: drop a pending rest. */
  leave(): void;
  /** Finger lifted: if a rest is still pending (no movement), prefetch now. */
  commit(): void;
  /** Focus: prefetch now. */
  now(href: string, source?: IntentSource): void;
}

export interface IntentPrefetchOptions {
  restMs?: number;
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

/** 100 ms: long enough that a pointer passing over does not count, short
 *  enough that it lands before a click. */
export const INTENT_REST_MS = 100;

/** A touch held this long without moving counts as a tap before it lifts. A
 *  scroll moves well inside it; a quicker tap is caught when the finger lifts. */
export const INTENT_TOUCH_MS = 80;

export function createIntentPrefetch(
  prefetch: (href: string, source: IntentSource) => void,
  {
    restMs = INTENT_REST_MS,
    setTimer = (run, ms) => setTimeout(run, ms),
    clearTimer = (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
  }: IntentPrefetchOptions = {},
): IntentPrefetch {
  const sent = new Set<string>();
  let pending: unknown = null;
  let pendingHref: string | null = null;
  let pendingSource: IntentSource = 'pointer';

  const cancel = () => {
    if (pending !== null) {
      clearTimer(pending);
      pending = null;
      pendingHref = null;
    }
  };

  const fire = (href: string, source: IntentSource) => {
    cancel();
    if (sent.has(href)) return;
    sent.add(href);
    prefetch(href, source);
  };

  return {
    rest(href, ms = restMs, source = 'pointer') {
      if (sent.has(href) || pending !== null) return;
      pendingHref = href;
      pendingSource = source;
      pending = setTimer(() => {
        pending = null;
        pendingHref = null;
        fire(href, source);
      }, ms);
    },
    leave: cancel,
    commit() {
      if (pendingHref !== null) fire(pendingHref, pendingSource);
    },
    now(href, source = 'pointer') {
      fire(href, source);
    },
  };
}
