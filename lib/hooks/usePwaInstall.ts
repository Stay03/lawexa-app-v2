'use client';

import { useState, useSyncExternalStore } from 'react';
import { usePwaInstallStore } from '@/lib/stores/pwaInstallStore';
import { isIOS, getIosBrowser, type IosBrowser } from '@/lib/utils/pwa';

// Hydration-safe "have we mounted on the client?" without a setState-in-effect:
// false on the server and during hydration, true once the client takes over.
const subscribeNoop = () => () => {};
function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

export interface PwaInstallState {
  /** True only after the client has mounted — gate UI on this to avoid hydration mismatch. */
  mounted: boolean;
  isStandalone: boolean;
  isInstalled: boolean;
  /** True while the user-chosen dismissal cooldown is still active. */
  isDismissed: boolean;
  /** Chromium one-tap install is available (captured event or Web Install API). */
  canPromptNative: boolean;
  /** iOS with no programmatic install — show manual "Add to Home Screen" instructions instead. */
  isIosManual: boolean;
  iosBrowser: IosBrowser;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  dismiss: (days?: number) => void;
}

/**
 * UI-facing view over the PWA install store plus client-only platform detection.
 * Components decide whether to render from this; the actual event capture lives in
 * <PwaInstallProvider> mounted once in the root layout.
 */
export function usePwaInstall(): PwaInstallState {
  const mounted = useHasMounted();
  // Platform is fixed for the session; compute once via lazy initializers (SSR-safe).
  const [ios] = useState(isIOS);
  const [iosBrowser] = useState<IosBrowser>(getIosBrowser);

  const deferredPrompt = usePwaInstallStore((state) => state.deferredPrompt);
  const isStandalone = usePwaInstallStore((state) => state.isStandalone);
  const isInstalled = usePwaInstallStore((state) => state.isInstalled);
  const dismissedUntil = usePwaInstallStore((state) => state.dismissedUntil);
  const promptInstall = usePwaInstallStore((state) => state.promptInstall);
  const dismiss = usePwaInstallStore((state) => state.dismiss);

  const canPromptNative =
    deferredPrompt !== null || (typeof navigator !== 'undefined' && 'install' in navigator);
  // Stale cooldowns are cleared on mount by <PwaInstallProvider>, so a non-null
  // value here always means "still dismissed" — no clock read needed in render.
  const isDismissed = dismissedUntil !== null;
  const isIosManual = ios && !canPromptNative;

  return {
    mounted,
    isStandalone,
    isInstalled,
    isDismissed,
    canPromptNative,
    isIosManual,
    iosBrowser,
    promptInstall,
    dismiss,
  };
}
