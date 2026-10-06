'use client';

import { useMemo, type PointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createIntentPrefetch, INTENT_TOUCH_MS } from './intent-prefetch';

/**
 * The event handlers that prefetch `href` on intent (see `intent-prefetch.ts`).
 * Spread them onto a `<Link prefetch={false}>`: `prefetch={false}` stops the
 * viewport prefetch, and these send the same prefetch Next would have sent
 * (`router.prefetch`, the default "auto" kind) when the reader reaches for it.
 */
export function useIntentPrefetch(href: string) {
  const router = useRouter();
  const intent = useMemo(() => createIntentPrefetch((target) => router.prefetch(target)), [router]);

  return {
    // Mouse: rest. Pen: now. Touch is left to the touch events below, which
    // can tell a tap from a scroll.
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType === 'mouse') intent.rest(href);
      else if (event.pointerType === 'pen') intent.now(href);
    },
    onPointerLeave: (event: PointerEvent) => {
      if (event.pointerType === 'mouse') intent.leave();
    },
    onTouchStart: () => intent.rest(href, INTENT_TOUCH_MS),
    onTouchMove: () => intent.leave(),
    onTouchEnd: () => intent.commit(),
    onTouchCancel: () => intent.leave(),
    onFocus: () => intent.now(href),
  };
}
