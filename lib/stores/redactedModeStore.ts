'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface RedactedModeState {
  // Pre-creation toggle on the home page. Resets when a conversation is created.
  isPending: boolean;
  setPending: (v: boolean) => void;
  togglePending: () => void;

  // Session cache of conversation UUIDs the client knows are redacted, so the
  // composer can lock the toggle and the header can show a badge without a
  // server round-trip.
  redactedIds: string[];
  isRedacted: (id: string | null | undefined) => boolean;
  markRedacted: (id: string) => void;
  unmarkRedacted: (id: string) => void;

  reset: () => void;
}

export const useRedactedModeStore = create<RedactedModeState>()(
  persist(
    (set, get) => ({
      isPending: false,
      setPending: (v) => set({ isPending: v }),
      togglePending: () => set((s) => ({ isPending: !s.isPending })),

      redactedIds: [],
      isRedacted: (id) => {
        if (!id) return false;
        return get().redactedIds.includes(id);
      },
      markRedacted: (id) =>
        set((s) =>
          s.redactedIds.includes(id)
            ? s
            : { redactedIds: [...s.redactedIds, id] },
        ),
      unmarkRedacted: (id) =>
        set((s) => ({
          redactedIds: s.redactedIds.filter((x) => x !== id),
        })),

      reset: () =>
        set({
          isPending: false,
          redactedIds: [],
        }),
    }),
    {
      name: 'lawexa-redacted-mode',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.sessionStorage : (undefined as unknown as Storage),
      ),
    },
  ),
);
