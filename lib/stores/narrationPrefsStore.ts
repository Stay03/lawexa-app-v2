import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type NarrationMode = 'orchestrator' | 'all';

interface NarrationPrefsStore {
  narrationMode: NarrationMode;
  setNarrationMode: (mode: NarrationMode) => void;
}

export const useNarrationPrefsStore = create<NarrationPrefsStore>()(
  persist(
    (set) => ({
      narrationMode: 'orchestrator',
      setNarrationMode: (mode) => set({ narrationMode: mode }),
    }),
    { name: 'lawexa-narration-prefs' }
  )
);
