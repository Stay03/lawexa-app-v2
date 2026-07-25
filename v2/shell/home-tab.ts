import { useSyncExternalStore } from 'react';

/**
 * The home surface's active product tab — Chat | Work | Study (owner #34, the
 * pivot that graduated the old dev A/B switcher into real product chrome).
 *
 * A tiny module-level external store read through `useSyncExternalStore`, NOT
 * component state, so the header tab control and the home surface stay in
 * lockstep (both subscribe to the same store) and there is no setState-in-effect
 * for the React Compiler lint to reject.
 *
 * SSR-SAFE: `getServerSnapshot` returns the default `'chat'`, so the server and
 * the first client render agree — no hydration crash. On the client the real
 * value is read from `localStorage` after hydration; a tester who last left the
 * Work/Study tab selected sees a single default-chat → their-tab reconcile on
 * hydration (an unavoidable consequence of per-device persistence + SSR — the
 * server cannot know the device's choice). Chat, the default and by far the most
 * common tab, never reconciles. A `storage` listener keeps multiple tabs in sync.
 *
 * SYMMETRIC SWAP MOTION (owner #24): switching tabs is not a hard cut. `setHomeTab`
 * runs a short fade phase — it raises `fading` (the visible home fades OUT), then
 * after `FADE_MS` swaps the tab and lowers `fading` (the new home fades IN). Both
 * directions animate, and because a single home is mounted at a time the swap
 * never double-renders two heavy surfaces. The store owns the sequencing entirely
 * (module-scope timers, no React effects), so it is lint-clean. Reduced-motion
 * users skip the fade and get an instant swap.
 *
 * This is intentionally NOT `'use client'`: it exports plain functions + hooks
 * and touches `window`/`localStorage` only inside callbacks (never at module
 * scope), so it is safe to evaluate during SSR and is consumed only by the
 * client components that import it.
 */

export type HomeTab = 'chat' | 'work' | 'study';

const STORAGE_KEY = 'lawexa-v2-home-tab';
const DEFAULT_TAB: HomeTab = 'chat';
/** Half a swap: fade the current home out, then the next home in. Kept in
 *  lockstep with the home wrapper's `duration-200` CSS (owner #32 softened the
 *  cross-fade to 200ms); the tab swaps at this mark, i.e. the fade-out's low
 *  point. Timing value only — no store-logic change. */
const FADE_MS = 200;

/** Cached snapshots so the `getSnapshot`s return referentially-stable values. */
let currentTab: HomeTab | null = null;
let fading = false;
let fadeTimer: ReturnType<typeof setTimeout> | null = null;
/** The pending swap intent — non-null ONLY during a fade window. Guarding on
 *  this (not the still-displayed `currentTab`) is what makes rapid
 *  chat→work→chat land on chat: during the fade `currentTab` lags, so it can't
 *  express intent. */
let targetTab: HomeTab | null = null;
const listeners = new Set<() => void>();

function readFromStorage(): HomeTab {
  if (typeof window === 'undefined') return DEFAULT_TAB;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'work' || stored === 'study' ? stored : DEFAULT_TAB;
  } catch {
    // Private-mode / storage-disabled: fall back to the default.
    return DEFAULT_TAB;
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

function getTabSnapshot(): HomeTab {
  if (currentTab === null) currentTab = readFromStorage();
  return currentTab;
}

function getFadingSnapshot(): boolean {
  return fading;
}

function getTabServerSnapshot(): HomeTab {
  return DEFAULT_TAB;
}

function getFadingServerSnapshot(): boolean {
  return false;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  // Cross-tab: `localStorage.setItem` fires `storage` only in OTHER tabs, so
  // this reconciles background tabs when the tab is changed elsewhere. A
  // cross-tab change snaps (no fade — the user isn't watching this tab). The
  // same-tab update path goes through `setHomeTab` → `emit()` directly.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      currentTab = readFromStorage();
      fading = false;
      targetTab = null;
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
 * Persist + broadcast a new home tab (used by the header `HomeTabs` control),
 * with the symmetric fade sequence described in the module doc.
 */
export function setHomeTab(tab: HomeTab): void {
  // Guard on the pending INTENT (targetTab) when a fade is in flight — the
  // displayed `currentTab` lags during the window, and guarding on it would drop
  // the final click of a rapid chat→work→chat. Same-tab spam early-returns here,
  // so the timer is never churned into a stuck fade.
  if ((targetTab ?? getTabSnapshot()) === tab) return;

  // Persist the intent immediately; only the on-screen swap is deferred by the
  // fade so a fresh mount / other tab always reads the chosen tab.
  try {
    window.localStorage.setItem(STORAGE_KEY, tab);
  } catch {
    // Non-persistent is acceptable; still update in-memory.
  }

  if (fadeTimer) {
    clearTimeout(fadeTimer);
    fadeTimer = null;
  }

  // Reduced motion → instant swap, no fade window.
  if (prefersReducedMotion()) {
    currentTab = tab;
    targetTab = null;
    fading = false;
    emit();
    return;
  }

  // Fade the current home OUT, then swap to the LATEST target and fade IN. A
  // click that lands mid-fade re-enters here, retargets, and restarts the
  // window — the single timer always commits the newest intent.
  targetTab = tab;
  fading = true;
  emit();
  fadeTimer = setTimeout(() => {
    currentTab = targetTab ?? tab;
    targetTab = null;
    fading = false;
    fadeTimer = null;
    emit();
  }, FADE_MS);
}

/** Subscribe a component to the current home tab. */
export function useHomeTab(): HomeTab {
  return useSyncExternalStore(subscribe, getTabSnapshot, getTabServerSnapshot);
}

function getSelectionSnapshot(): HomeTab {
  return targetTab ?? getTabSnapshot();
}

/**
 * Subscribe to the user's current SELECTION — the pending fade target when a
 * swap is in flight, else the displayed tab. The `HomeTabs` control reads THIS
 * (never the lagging displayed tab) so `aria-checked`, the gold indicator, and
 * arrow-key stepping all reflect the choice the instant it's made, while the
 * home surface itself keeps reading `useHomeTab()` and cross-fades behind it
 * (reviewer findings: the 200ms aria-checked lag + the arrow-key rate limit
 * both came from the control reading the displayed tab mid-fade).
 */
export function useHomeTabSelection(): HomeTab {
  return useSyncExternalStore(
    subscribe,
    getSelectionSnapshot,
    getTabServerSnapshot,
  );
}

/**
 * Subscribe to the transient "fading out before a swap" flag. The home wrapper
 * reads this to drop opacity for the `FADE_MS` window, giving the swap a
 * symmetric out→in cross-fade. Matches `FADE_MS` in the wrapper's CSS duration.
 */
export function useHomeTabFading(): boolean {
  return useSyncExternalStore(
    subscribe,
    getFadingSnapshot,
    getFadingServerSnapshot,
  );
}
