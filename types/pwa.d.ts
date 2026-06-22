// Types for the non-standard / experimental PWA install APIs that are not part
// of TypeScript's built-in lib.dom.d.ts. Declaring them here (rather than casting
// to `any`) keeps the install code fully typed.

/**
 * Chromium-only event fired when the browser deems the app installable. We capture
 * it, suppress the default mini-infobar, stash it, and replay `prompt()` from a
 * user gesture later. See https://developer.mozilla.org/docs/Web/API/BeforeInstallPromptEvent
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
}

interface Navigator {
  /** iOS Safari only, non-standard: true when running as an installed home-screen web app. */
  readonly standalone?: boolean;
  /** Web Install API — origin trial (Chromium desktop, 2026). Treated as progressive enhancement only. */
  install?: () => Promise<{ id: string }>;
}
