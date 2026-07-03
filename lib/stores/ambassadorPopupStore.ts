import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_REMIND_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

interface AmbassadorPopupStore {
  /** Epoch ms until which the popup stays hidden after "Remind me later". Persisted. */
  remindAfter: number | null;
  /** Set by "Don't show again" or once the program has been viewed — never re-show. Persisted. */
  dismissedForever: boolean;

  /** Snooze the popup for a few days ("Remind me later" / X / Esc). */
  remindLater: (days?: number) => void;
  /** Permanently stop showing the popup ("Don't show again" / "Apply now"). */
  dismissForever: () => void;
  /** Clear a snooze whose cooldown has elapsed. Called once on mount so render never reads the clock. */
  expireRemindIfPast: () => void;
}

/**
 * Client-persisted dismissal state for the ambassador program popup. Mirrors the
 * PWA install card's store (see lib/stores/pwaInstallStore.ts): a "remind me later"
 * stores an absolute expiry timestamp, and the stale cooldown is cleared once on
 * mount so the UI never reads Date.now() during render (React Compiler safe).
 */
export const useAmbassadorPopupStore = create<AmbassadorPopupStore>()(
  persist(
    (set, get) => ({
      remindAfter: null,
      dismissedForever: false,

      remindLater: (days = DEFAULT_REMIND_DAYS) =>
        set({ remindAfter: Date.now() + days * DAY_MS }),

      dismissForever: () => set({ dismissedForever: true }),

      expireRemindIfPast: () => {
        const { remindAfter } = get();
        if (remindAfter !== null && Date.now() >= remindAfter) {
          set({ remindAfter: null });
        }
      },
    }),
    {
      name: 'lawexa-ambassador-popup',
      partialize: (state) => ({
        remindAfter: state.remindAfter,
        dismissedForever: state.dismissedForever,
      }),
    }
  )
);
