import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TCurrency } from '@/types/payment';

/******************************************************************************
                               Types
******************************************************************************/

interface UserCurrencyStore {
  /**
   * The currency the user pays in. `null` means we haven't established a
   * default yet — geo detection runs once, then this is non-null forever.
   */
  currency: TCurrency | null;
  /**
   * True once the user has explicitly picked a currency. Stops geo detection
   * from re-running and overwriting a deliberate choice on future visits.
   */
  manualOverride: boolean;
  /** Apply a geo-detected default. No-op if the user has already overridden. */
  setDetected: (currency: TCurrency) => void;
  /** Persist a deliberate user choice. */
  setManual: (currency: TCurrency) => void;
}

/******************************************************************************
                               Store
******************************************************************************/

/**
 * User-facing payment currency. Separate from the admin sponsor-cost
 * NGN/USD reporting toggle in `lib/stores/currencyStore.ts`.
 */
export const useUserCurrencyStore = create<UserCurrencyStore>()(
  persist(
    (set, get) => ({
      currency: null,
      manualOverride: false,
      setDetected: (currency) => {
        if (get().manualOverride) return;
        set({ currency });
      },
      setManual: (currency) => set({ currency, manualOverride: true }),
    }),
    { name: 'lawexa-user-currency' }
  )
);
