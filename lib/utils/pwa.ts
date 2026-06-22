// Pure, framework-agnostic helpers for detecting PWA install state and platform.
// All access to browser globals is guarded so these are safe to import anywhere;
// they should still only be *called* on the client (inside effects).

export type IosBrowser = 'safari' | 'chrome' | 'firefox' | 'edge' | 'other';

/**
 * True when the page is running as an installed/standalone app rather than in a
 * normal browser tab. Combines the cross-browser display-mode signals (including
 * window-controls-overlay, which Chrome reports instead of `standalone`), the
 * iOS-only `navigator.standalone`, and the Android TWA `android-app://` referrer.
 */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;

  const matches = (query: string) => window.matchMedia(query).matches;
  const displayStandalone =
    matches('(display-mode: standalone)') ||
    matches('(display-mode: minimal-ui)') ||
    matches('(display-mode: fullscreen)') ||
    matches('(display-mode: window-controls-overlay)');

  return (
    displayStandalone ||
    window.navigator.standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

/**
 * True for iPhone/iPod/iPad. iPadOS reports a desktop-Safari UA and
 * `navigator.platform === 'MacIntel'`, so iPads are caught via the touch-point
 * heuristic (Macs report 0/1; touch iPads report > 1).
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isIOSDevice || isIPadOS;
}

/**
 * Which browser an iOS user is on. The "Add to Home Screen" entry point lives in
 * a different place per browser, so the instructions are tailored accordingly.
 * Order matters: the in-app browser tokens (CriOS/FxiOS/EdgiOS) must be checked
 * before the generic Safari token, which they also contain.
 */
export function getIosBrowser(): IosBrowser {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/CriOS/.test(ua)) return 'chrome';
  if (/FxiOS/.test(ua)) return 'firefox';
  if (/EdgiOS/.test(ua)) return 'edge';
  if (/Safari/.test(ua)) return 'safari';
  return 'other';
}
