'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { usePwaInstallStore } from '@/lib/stores/pwaInstallStore';
import { isStandaloneDisplay } from '@/lib/utils/pwa';

/**
 * Always-on, render-nothing listener mounted once in the root layout. It captures
 * Chromium's `beforeinstallprompt` early (before any install UI mounts, since the
 * event can fire on first paint), tracks standalone/installed state, and best-effort
 * self-detects an already-installed PWA on Chromium desktop. The UI that *reveals*
 * the install affordance lives elsewhere and reads the store.
 */
export function PwaInstallProvider() {
  const capture = usePwaInstallStore((state) => state.capture);
  const setStandalone = usePwaInstallStore((state) => state.setStandalone);
  const markInstalled = usePwaInstallStore((state) => state.markInstalled);
  const expireDismissalIfPast = usePwaInstallStore((state) => state.expireDismissalIfPast);

  useEffect(() => {
    expireDismissalIfPast();
    const updateStandalone = () => setStandalone(isStandaloneDisplay());
    updateStandalone();

    const onBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      // Suppress Chrome's mini-infobar; we reveal our own button at the right moment.
      event.preventDefault();
      capture(event);
    };
    const onAppInstalled = () => {
      markInstalled();
      toast.success('Lawexa was added to your device');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    const displayModeQuery = window.matchMedia('(display-mode: standalone)');
    displayModeQuery.addEventListener('change', updateStandalone);

    // Best-effort: on Chromium desktop, a same-origin PWA can confirm from a normal
    // tab that it is already installed (requires the manifest's webapp self-reference).
    const nav = navigator as Navigator & {
      getInstalledRelatedApps?: () => Promise<Array<{ platform: string; id?: string; url?: string }>>;
    };
    nav.getInstalledRelatedApps?.()
      .then((apps) => {
        if (apps.some((app) => app.platform === 'webapp')) markInstalled();
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      displayModeQuery.removeEventListener('change', updateStandalone);
    };
  }, [capture, setStandalone, markInstalled, expireDismissalIfPast]);

  return null;
}
