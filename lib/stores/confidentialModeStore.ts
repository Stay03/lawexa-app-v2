'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ConfidentialModeState {
  // Pre-creation toggle on the home page. Resets when a conversation is created.
  isPending: boolean;
  setPending: (v: boolean) => void;
  togglePending: () => void;

  // Session cache: conversation UUIDs the client knows are confidential.
  // Lets us short-circuit server GETs that would 404. Stored as string[] for
  // JSON-serializable persistence; exposed via helpers as a Set.
  confidentialIds: string[];
  isConfidential: (id: string | null | undefined) => boolean;
  markConfidential: (id: string) => void;
  unmarkConfidential: (id: string) => void;

  reset: () => void;
}

export const useConfidentialModeStore = create<ConfidentialModeState>()(
  persist(
    (set, get) => ({
      isPending: false,
      setPending: (v) => set({ isPending: v }),
      togglePending: () => set((s) => ({ isPending: !s.isPending })),

      confidentialIds: [],
      isConfidential: (id) => {
        if (!id) return false;
        return get().confidentialIds.includes(id);
      },
      markConfidential: (id) =>
        set((s) =>
          s.confidentialIds.includes(id)
            ? s
            : { confidentialIds: [...s.confidentialIds, id] },
        ),
      unmarkConfidential: (id) =>
        set((s) => ({
          confidentialIds: s.confidentialIds.filter((x) => x !== id),
        })),

      reset: () =>
        set({
          isPending: false,
          confidentialIds: [],
        }),
    }),
    {
      name: 'lawexa-confidential-mode',
      // sessionStorage matches the "single-session" spirit of the mode — the
      // toggle survives a tab restore but a new browser session starts clean.
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.sessionStorage : (undefined as unknown as Storage),
      ),
    },
  ),
);
