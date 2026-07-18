'use client';

import { useSyncExternalStore } from 'react';

const subscribeNoop = () => () => {};

/**
 * `false` on the server and the first hydration render, `true` once mounted on
 * the client — WITHOUT the classic `useState`+`useEffect` mounted flag, which
 * the React Compiler lint rejects as setState-in-effect.
 *
 * Use it whenever the first paint must be identical on server and client but
 * the real value is client-only (resolved theme, local time, localStorage):
 * render a neutral fallback while `false`, the real thing once `true`.
 * `useSyncExternalStore`'s server snapshot (`false`) and client snapshot
 * (`true`) give exactly that sequencing with no hydration mismatch.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}
