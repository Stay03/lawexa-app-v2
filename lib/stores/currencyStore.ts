import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * What the browser remembers about how to show AI costs.
 *
 * ── THE RATE IS NOT HERE ───────────────────────────────────────────────────
 * One naira-to-dollar rate, set in admin settings (`usd_to_ngn_display_rate`),
 * is used everywhere (Stay, 19 November 2026). This store only remembers
 * whether this browser shows AI costs in naira or dollars. It once held a
 * rate (`exchangeRate`, then a per-admin `manualRate`); both are dropped from
 * saved state on load.
 */
interface CurrencyStore {
  showNGN: boolean;
  setShowNGN: (show: boolean) => void;
  toggleShowNGN: () => void;
}

export const useCurrencyStore = create<CurrencyStore>()(
  persist(
    (set) => ({
      showNGN: false,
      setShowNGN: (show) => set({ showNGN: show }),
      toggleShowNGN: () => set((state) => ({ showNGN: !state.showNGN })),
    }),
    {
      name: 'lawexa-currency',
      version: 2,
      /**
       * EVERY SAVED RATE IS DROPPED, DELIBERATELY. Version 0 saved `exchangeRate`
       * and version 1 a per-admin `manualRate`; one rate in settings replaces
       * both, so neither may survive a reload and quietly disagree with it.
       *
       * Why the version 0 rate went:
       *
       * Every admin who has opened these screens has `exchangeRate: 1500` in
       * their browser, saved automatically because it was the default and not
       * because anyone chose it. Carrying it across as an override would mean
       * the new setting changed nothing for exactly the people who use these
       * screens most: the server would say 1,700 and every existing browser
       * would quietly keep saying 1,500, with nothing on screen explaining why.
       *
       * Nothing can distinguish "typed 1500" from "never touched it", so the
       * saved number goes and the server becomes the source.
       */
      migrate: (persisted, version) => {
        const state = { ...((persisted ?? {}) as Partial<CurrencyStore> & {
          exchangeRate?: number;
          manualRate?: number | null;
        }) };
        if (version < 2) {
          delete state.exchangeRate;
          delete state.manualRate;
        }
        return state as CurrencyStore;
      },
    },
  ),
);
