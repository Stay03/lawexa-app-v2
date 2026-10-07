'use client';

import { useSyncExternalStore } from 'react';
import { layersOffIn, perfValueInBrowser, type PerfLayer } from './perf-switch';

const noSubscribe = () => () => undefined;

/**
 * The performance-layer switches for rendering (`perf-switch.ts`): the server
 * snapshot is "all on", so the server HTML and the first client render agree,
 * then it settles to the cookie. The snapshot is the cookie's string (stable
 * between renders); the set is derived from it. The page reloads on every
 * change, so no live subscription is needed. Kept apart from `perf-switch.ts`,
 * which server code imports and so must not use client hooks.
 */
export function usePerfLayersOff(): ReadonlySet<PerfLayer> {
  return layersOffIn(useSyncExternalStore(noSubscribe, perfValueInBrowser, () => ''));
}
