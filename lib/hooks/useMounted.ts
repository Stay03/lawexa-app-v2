'use client';

import { useSyncExternalStore } from 'react';

const subscribeNoop = () => () => {};

/**
 * `false` on the server and during the hydration render, `true` from the first
 * client render onwards — WITHOUT the classic `useState`+`useEffect` mounted
 * flag, which the React Compiler lint rejects as setState-in-effect.
 *
 * Reach for this whenever a decision must not be made from a store's *initial*
 * state. Zustand reads `getInitialState()` during the hydration render (it is
 * `useSyncExternalStore`'s server snapshot), so a persisted store reports its
 * defaults on that pass even though `localStorage` was already read at store
 * creation. Anything that redirects or renders off those values must wait for
 * the first post-hydration render, or it acts on data that is merely not
 * visible yet.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}
