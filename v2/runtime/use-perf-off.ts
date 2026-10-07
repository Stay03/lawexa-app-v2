'use client';

import { useSyncExternalStore } from 'react';
import { perfOffInBrowser } from './perf-switch';

const noSubscribe = () => () => undefined;

/**
 * The speed-features switch for rendering (`perf-switch.ts`): the server
 * snapshot is "on", so the server HTML and the first client render agree,
 * then it settles to the cookie. The page reloads on every change, so no live
 * subscription is needed. Kept apart from `perf-switch.ts`, which server code
 * imports and so must not use client hooks.
 */
export function usePerfOff(): boolean {
  return useSyncExternalStore(noSubscribe, perfOffInBrowser, () => false);
}
