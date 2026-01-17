import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WriterModeStore {
  isWriterModeEnabled: boolean;
  toggleWriterMode: () => void;
  enableWriterMode: () => void;
  disableWriterMode: () => void;
}

export const useWriterModeStore = create<WriterModeStore>()(
  persist(
    (set) => ({
      isWriterModeEnabled: false,

      toggleWriterMode: () =>
        set((state) => ({ isWriterModeEnabled: !state.isWriterModeEnabled })),

      enableWriterMode: () => set({ isWriterModeEnabled: true }),

      disableWriterMode: () => set({ isWriterModeEnabled: false }),
    }),
    {
      name: 'lawexa-writer-mode',
    }
  )
);
