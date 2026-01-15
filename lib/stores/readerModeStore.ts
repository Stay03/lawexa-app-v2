import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ReaderModeStore {
  isReaderModeEnabled: boolean;
  toggleReaderMode: () => void;
  enableReaderMode: () => void;
  disableReaderMode: () => void;
}

export const useReaderModeStore = create<ReaderModeStore>()(
  persist(
    (set) => ({
      isReaderModeEnabled: false,

      toggleReaderMode: () =>
        set((state) => ({ isReaderModeEnabled: !state.isReaderModeEnabled })),

      enableReaderMode: () => set({ isReaderModeEnabled: true }),

      disableReaderMode: () => set({ isReaderModeEnabled: false }),
    }),
    {
      name: 'lawexa-reader-mode',
    }
  )
);
