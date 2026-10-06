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
 * - Touch start and focus prefetch AT ONCE: a finger on the row is about to
 *   lift, a focused row is about to get Enter.
 * - A mouse prefetches after it RESTS on the row for `restMs`, and leaving
 *   cancels it, so a pointer crossing the list on its way elsewhere costs
 *   nothing.
 * - Each href is prefetched once per row; Next dedupes the rest.
 *
 * Pure (timers injected), so the rules are tested without a browser.
 */
export interface IntentPrefetch {
  /** Mouse entered: prefetch if it is still there after `restMs`. */
  rest(href: string): void;
  /** Mouse left: cancel a pending rest. */
  leave(): void;
  /** Touch or focus: prefetch now. */
  now(href: string): void;
}

export interface IntentPrefetchOptions {
  restMs?: number;
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

/** 100 ms: long enough that a pointer passing over does not count, short
 *  enough that it lands before a click. */
export const INTENT_REST_MS = 100;

export function createIntentPrefetch(
  prefetch: (href: string) => void,
  {
    restMs = INTENT_REST_MS,
    setTimer = (run, ms) => setTimeout(run, ms),
    clearTimer = (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
  }: IntentPrefetchOptions = {},
): IntentPrefetch {
  const sent = new Set<string>();
  let pending: unknown = null;

  const cancel = () => {
    if (pending !== null) {
      clearTimer(pending);
      pending = null;
    }
  };

  const fire = (href: string) => {
    cancel();
    if (sent.has(href)) return;
    sent.add(href);
    prefetch(href);
  };

  return {
    rest(href) {
      if (sent.has(href) || pending !== null) return;
      pending = setTimer(() => {
        pending = null;
        fire(href);
      }, restMs);
    },
    leave: cancel,
    now: fire,
  };
}
