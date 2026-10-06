'use client';

import { useMemo, type PointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createIntentPrefetch } from './intent-prefetch';

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
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType === 'mouse') intent.rest(href);
      else intent.now(href);
    },
    onPointerLeave: () => intent.leave(),
    onTouchStart: () => intent.now(href),
    onFocus: () => intent.now(href),
  };
}
