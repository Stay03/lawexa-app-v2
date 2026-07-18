import { useSyncExternalStore } from 'react';

/**
 * The dev-only A/B home-design switch state (deliverable #6).
 *
 * A tiny module-level external store read through `useSyncExternalStore`, NOT
 * component state, so the header switch and the home surface stay in lockstep
 * (both subscribe to the same store) and there is no setState-in-effect for the
 * React Compiler lint to reject.
 *
 * SSR-SAFE: `getServerSnapshot` returns the default `'a'`, so the server and the
 * first client render agree — no hydration crash. On the client the real value
 * is read from `localStorage` after hydration; if the tester had `'b'` selected
 * there is a single default-A → B swap (an acceptable, documented flash for a
 * dev tool, per the brief). A `storage` listener keeps multiple tabs in sync.
 *
 * This is intentionally NOT `'use client'`: it exports plain functions + a hook
 * and touches `window`/`localStorage` only inside callbacks (never at module
 * scope), so it is safe to evaluate during SSR and is consumed only by the
 * client components that import it.
 */

export type DesignMode = 'a' | 'b';

const STORAGE_KEY = 'lawexa-v2-design';
const DEFAULT_MODE: DesignMode = 'a';

/** Cached snapshot so `getSnapshot` returns a referentially-stable value. */
let currentMode: DesignMode | null = null;
const listeners = new Set<() => void>();

function readFromStorage(): DesignMode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'b' ? 'b' : 'a';
  } catch {
    // Private-mode / storage-disabled: fall back to the default.
    return DEFAULT_MODE;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function getSnapshot(): DesignMode {
  if (currentMode === null) currentMode = readFromStorage();
  return currentMode;
}

function getServerSnapshot(): DesignMode {
  return DEFAULT_MODE;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  // Cross-tab: `localStorage.setItem` fires `storage` only in OTHER tabs, so
  // this reconciles background tabs when the mode is changed elsewhere. The
  // same-tab update path goes through `setDesignMode` → `emit()` directly.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      currentMode = readFromStorage();
      emit();
    }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** Persist + broadcast a new design mode (used by the header DesignSwitch). */
export function setDesignMode(mode: DesignMode): void {
  currentMode = mode;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Non-persistent is acceptable for a dev tool; still update in-memory.
  }
  emit();
}

/** Subscribe a component to the current design mode. */
export function useDesignMode(): DesignMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
