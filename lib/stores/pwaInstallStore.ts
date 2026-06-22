import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_DISMISS_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

interface PwaInstallStore {
  /** Live, single-use Chromium event. In-memory only — never persisted. */
  deferredPrompt: BeforeInstallPromptEvent | null;
  /** Running as an installed/standalone app. */
  isStandalone: boolean;
  /** Confirmed installed (via appinstalled or getInstalledRelatedApps). */
  isInstalled: boolean;
  /** Epoch ms until which the prompt stays hidden after a dismissal. Persisted. */
  dismissedUntil: number | null;

  capture: (event: BeforeInstallPromptEvent) => void;
  setStandalone: (value: boolean) => void;
  markInstalled: () => void;
  dismiss: (days?: number) => void;
  /** Clear a dismissal whose cooldown has elapsed. Called once on mount so render never reads the clock. */
  expireDismissalIfPast: () => void;
  /** Trigger the native install. Returns the outcome, or 'unavailable' if nothing to prompt. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export const usePwaInstallStore = create<PwaInstallStore>()(
  persist(
    (set, get) => ({
      deferredPrompt: null,
      isStandalone: false,
      isInstalled: false,
      dismissedUntil: null,

      capture: (event) => set({ deferredPrompt: event }),
      setStandalone: (value) => set({ isStandalone: value }),
      markInstalled: () => set({ deferredPrompt: null, isInstalled: true }),
      dismiss: (days = DEFAULT_DISMISS_DAYS) =>
        set({ dismissedUntil: Date.now() + days * DAY_MS }),

      expireDismissalIfPast: () => {
        const { dismissedUntil } = get();
        if (dismissedUntil !== null && Date.now() >= dismissedUntil) {
          set({ dismissedUntil: null });
        }
      },

      promptInstall: async () => {
        // Progressive enhancement: prefer the Web Install API where it has shipped
        // (Chromium desktop, 2026+). Falls back to the captured beforeinstallprompt.
        if (typeof navigator !== 'undefined' && typeof navigator.install === 'function') {
          try {
            await navigator.install();
            get().markInstalled();
            return 'accepted';
          } catch (error) {
            if ((error as DOMException)?.name === 'AbortError') return 'dismissed';
            throw error;
          }
        }

        const event = get().deferredPrompt;
        if (!event) return 'unavailable';

        const { outcome } = await event.prompt();
        // The deferred event is single-use; discard it. Chrome may fire a fresh one
        // later (re-captured by the provider) if the user dismissed.
        set({
          deferredPrompt: null,
          isInstalled: outcome === 'accepted' ? true : get().isInstalled,
        });
        return outcome;
      },
    }),
    {
      name: 'lawexa-pwa-install',
      // Only the dismissal cooldown survives reloads. The deferred event is a live,
      // non-serializable, single-use object and must stay in memory.
      partialize: (state) => ({ dismissedUntil: state.dismissedUntil }),
    }
  )
);
