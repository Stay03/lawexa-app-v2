'use client';

import { useSyncExternalStore } from 'react';

const subscribeNoop = () => () => {};

/**
 * The device's IANA timezone — `null` on the server AND on the hydration
 * render, the real zone once mounted.
 *
 * WHY NOT A LAZY `useState` INITIALIZER: the create form is fully
 * server-rendered (the v2 layout resolves the session server-side), and a
 * lazy initializer runs during SSR too — the server's zone would go into the
 * rendered timezone text, the client's first render would disagree, and every
 * `/radars/new` load would throw a React hydration error. This is the exact
 * client-only-value class `use-mounted.ts` documents: `useSyncExternalStore`
 * with a `null` server snapshot renders one identical held shape on both
 * sides, then swaps in the real zone after mount.
 *
 * The snapshot re-derives the string per call; `useSyncExternalStore`
 * compares with `Object.is`, and equal strings are `Object.is`-equal, so the
 * store never loops.
 */
export function useDeviceTimeZone(): string | null {
  return useSyncExternalStore(
    subscribeNoop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
}
