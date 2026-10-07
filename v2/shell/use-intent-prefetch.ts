'use client';

import { useMemo, type PointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createIntentPrefetch, INTENT_TOUCH_MS } from './intent-prefetch';

export interface IntentPrefetchHooks {
  /** Runs with the route prefetch, once per href: the moment intent is clear. */
  onIntent?: () => void;
  /** Runs when the reader moves on: the mouse leaves, the finger scrolls or lifts off elsewhere. */
  onAbandon?: () => void;
}

/**
 * The event handlers that prefetch `href` on intent (see `intent-prefetch.ts`).
 * Spread them onto a `<Link prefetch={false}>`: `prefetch={false}` stops the
 * viewport prefetch, and these send the same prefetch Next would have sent
 * (`router.prefetch`, the default "auto" kind) when the reader reaches for it.
 *
 * `onIntent` lets a surface read its own data at the same moment (the case
 * rows read the case), and `onAbandon` lets it cancel that read. Pass stable
 * callbacks (`useCallback`), or the intent state is rebuilt on every render.
 */
export function useIntentPrefetch(href: string, { onIntent, onAbandon }: IntentPrefetchHooks = {}) {
  const router = useRouter();
  const intent = useMemo(
    () =>
      createIntentPrefetch((target) => {
        router.prefetch(target);
        onIntent?.();
      }),
    [router, onIntent],
  );

  return {
    // Mouse: rest. Pen: now. Touch is left to the touch events below, which
    // can tell a tap from a scroll.
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType === 'mouse') intent.rest(href);
      else if (event.pointerType === 'pen') intent.now(href);
    },
    onPointerLeave: (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      intent.leave();
      onAbandon?.();
    },
    onTouchStart: () => intent.rest(href, INTENT_TOUCH_MS),
    onTouchMove: () => {
      intent.leave();
      onAbandon?.();
    },
    onTouchEnd: () => intent.commit(),
    onTouchCancel: () => {
      intent.leave();
      onAbandon?.();
    },
    onFocus: () => intent.now(href),
  };
}
