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
 * SYMMETRIC SWAP MOTION (owner #24): flipping the switch is no longer a hard
 * cut. `setDesignMode` runs a short fade phase — it raises `fading` (the visible
 * home fades OUT), then after `FADE_MS` swaps the mode and lowers `fading` (the
 * new home fades IN). Both directions animate, and because a single home is
 * mounted at a time the swap never double-renders two heavy designs. The store
 * owns the sequencing entirely (module-scope timers, no React effects), so it is
 * lint-clean. Reduced-motion users skip the fade and get an instant swap.
 *
 * This is intentionally NOT `'use client'`: it exports plain functions + hooks
 * and touches `window`/`localStorage` only inside callbacks (never at module
 * scope), so it is safe to evaluate during SSR and is consumed only by the
 * client components that import it.
 */

export type DesignMode = 'a' | 'b';

const STORAGE_KEY = 'lawexa-v2-design';
const DEFAULT_MODE: DesignMode = 'a';
/** Half a swap: fade the current home out, then the next home in. */
const FADE_MS = 150;

/** Cached snapshots so the `getSnapshot`s return referentially-stable values. */
let currentMode: DesignMode | null = null;
let fading = false;
let fadeTimer: ReturnType<typeof setTimeout> | null = null;
/** The pending swap intent — non-null ONLY during a fade window. Guarding on
 *  this (not the still-displayed `currentMode`) is what makes rapid A→B→A land
 *  on A: during the fade `currentMode` lags, so it can't express intent. */
let targetMode: DesignMode | null = null;
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

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function getModeSnapshot(): DesignMode {
  if (currentMode === null) currentMode = readFromStorage();
  return currentMode;
}

function getFadingSnapshot(): boolean {
  return fading;
}

function getModeServerSnapshot(): DesignMode {
  return DEFAULT_MODE;
}

function getFadingServerSnapshot(): boolean {
  return false;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  // Cross-tab: `localStorage.setItem` fires `storage` only in OTHER tabs, so
  // this reconciles background tabs when the mode is changed elsewhere. A
  // cross-tab change snaps (no fade — the user isn't watching this tab). The
  // same-tab update path goes through `setDesignMode` → `emit()` directly.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      currentMode = readFromStorage();
      fading = false;
      targetMode = null;
      if (fadeTimer) {
        clearTimeout(fadeTimer);
        fadeTimer = null;
      }
      emit();
    }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Persist + broadcast a new design mode (used by the header DesignSwitch), with
 * the symmetric fade sequence described in the module doc.
 */
export function setDesignMode(mode: DesignMode): void {
  // Guard on the pending INTENT (targetMode) when a fade is in flight — the
  // displayed `currentMode` lags during the window, and guarding on it dropped
  // the final click of a rapid A→B→A (reviewer finding). Same-button spam
  // early-returns here, so the timer is never churned into a stuck fade.
  if ((targetMode ?? getModeSnapshot()) === mode) return;

  // Persist the intent immediately; only the on-screen swap is deferred by the
  // fade so a fresh mount / other tab always reads the chosen mode.
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Non-persistent is acceptable for a dev tool; still update in-memory.
  }

  if (fadeTimer) {
    clearTimeout(fadeTimer);
    fadeTimer = null;
  }

  // Reduced motion → instant swap, no fade window.
  if (prefersReducedMotion()) {
    currentMode = mode;
    targetMode = null;
    fading = false;
    emit();
    return;
  }

  // Fade the current home OUT, then swap to the LATEST target and fade IN. A
  // click that lands mid-fade re-enters here, retargets, and restarts the
  // window — the single timer always commits the newest intent.
  targetMode = mode;
  fading = true;
  emit();
  fadeTimer = setTimeout(() => {
    currentMode = targetMode ?? mode;
    targetMode = null;
    fading = false;
    fadeTimer = null;
    emit();
  }, FADE_MS);
}

/** Subscribe a component to the current design mode. */
export function useDesignMode(): DesignMode {
  return useSyncExternalStore(subscribe, getModeSnapshot, getModeServerSnapshot);
}

/**
 * Subscribe to the transient "fading out before a swap" flag. The home wrapper
 * reads this to drop opacity for the `FADE_MS` window, giving the swap a
 * symmetric out→in cross-fade. Matches `FADE_MS` in the wrapper's CSS duration.
 */
export function useDesignFading(): boolean {
  return useSyncExternalStore(
    subscribe,
    getFadingSnapshot,
    getFadingServerSnapshot,
  );
}
