import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CurrencyStore {
  exchangeRate: number;
  showNGN: boolean;
  setExchangeRate: (rate: number) => void;
  setShowNGN: (show: boolean) => void;
  toggleShowNGN: () => void;
}

export const useCurrencyStore = create<CurrencyStore>()(
  persist(
    (set) => ({
      exchangeRate: 1500,
      showNGN: false,
      setExchangeRate: (rate) => set({ exchangeRate: rate }),
      setShowNGN: (show) => set({ showNGN: show }),
      toggleShowNGN: () => set((state) => ({ showNGN: !state.showNGN })),
    }),
    { name: 'lawexa-currency' }
  )
);
