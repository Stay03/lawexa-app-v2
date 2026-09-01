import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * What the browser remembers about how to show AI costs.
 *
 * ── THE RATE LIVES ON THE SERVER NOW, AND THIS ONLY OVERRIDES IT ───────────
 * This store used to hold `exchangeRate: 1500`, a number typed into the source
 * once and then left alone while the real rate moved. It is now a setting,
 * `usd_to_ngn_display_rate`, and the screens read that. What stays here is an
 * OVERRIDE for one person in one browser: a way to ask "what would this cost
 * at 1,700" without changing the figure everybody else sees.
 *
 * `manualRate` is null when nobody has asked that question, which is the normal
 * state. Null means follow the server — it does not mean zero and it is not a
 * missing value to be defaulted away.
 */
interface CurrencyStore {
  /** An override for this browser only. Null means follow the server. */
  manualRate: number | null;
  showNGN: boolean;
  setManualRate: (rate: number) => void;
  /** Go back to whatever the server says, forgetting the override. */
  clearManualRate: () => void;
  setShowNGN: (show: boolean) => void;
  toggleShowNGN: () => void;
}

export const useCurrencyStore = create<CurrencyStore>()(
  persist(
    (set) => ({
      manualRate: null,
      showNGN: false,
      setManualRate: (rate) => set({ manualRate: rate }),
      clearManualRate: () => set({ manualRate: null }),
      setShowNGN: (show) => set({ showNGN: show }),
      toggleShowNGN: () => set((state) => ({ showNGN: !state.showNGN })),
    }),
    {
      name: 'lawexa-currency',
      version: 1,
      /**
       * THE OLD SAVED RATE IS DROPPED, DELIBERATELY, AND THIS MATTERS.
       *
       * Every admin who has opened these screens has `exchangeRate: 1500` in
       * their browser, saved automatically because it was the default and not
       * because anyone chose it. Carrying it across as an override would mean
       * the new setting changed nothing for exactly the people who use these
       * screens most: the server would say 1,700 and every existing browser
       * would quietly keep saying 1,500, with nothing on screen explaining why.
       *
       * Nothing can distinguish "typed 1500" from "never touched it", so the
       * saved number goes and the server becomes the source. Anyone who wants
       * an override sets it again, and now sees that it IS one.
       */
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<CurrencyStore> & {
          exchangeRate?: number;
        };
        if (version === 0) {
          const rest = { ...state };
          delete rest.exchangeRate;
          return { ...rest, manualRate: null } as CurrencyStore;
        }
        return state as CurrencyStore;
      },
    },
  ),
);
