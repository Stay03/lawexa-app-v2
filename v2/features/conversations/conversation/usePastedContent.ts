'use client';

import { useCallback } from 'react';
import { useDraft, type DraftCodec } from './draft-store';

/**
 * usePastedContent (v2) — staging state for large pasted blocks shown as removable
 * chips above the composer. v2-native rebuild of v1's `lib/hooks/usePastedContent`
 * (boundary-blocked). Same behavior: an ordered list with stable ids, persisted as
 * a plain `string[]` under `storageKey` so older singular drafts migrate on read.
 *
 * Stored through `draft-store`, so the server render and the hydration pass see
 * no cards and the stored ones appear straight after (Fable SSR review F2: the
 * case page renders this composer on the server).
 */
export interface PastedItem {
  id: string;
  text: string;
}

// Module-scoped counter → stable React keys without persisting ids (a reload can't
// collide a fresh counter with ids saved in a previous session).
let pastedItemCounter = 0;
function createPastedItem(text: string): PastedItem {
  pastedItemCounter += 1;
  return { id: `paste-${pastedItemCounter}`, text };
}

const NO_ITEMS: PastedItem[] = [];

export const PASTED_DRAFT: DraftCodec<PastedItem[]> = {
  empty: NO_ITEMS,
  decode(raw) {
    if (!raw) return NO_ITEMS;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((entry): entry is string => typeof entry === 'string')
          .map(createPastedItem);
      }
    } catch {
      // Legacy singular format: a raw paste string saved before multi-paste.
    }
    return [createPastedItem(raw)];
  },
  encode: (items) => (items.length > 0 ? JSON.stringify(items.map((item) => item.text)) : null),
};

export function usePastedContent(storageKey: string) {
  const [pastedItems, update] = useDraft(storageKey, PASTED_DRAFT);

  const addPasted = useCallback(
    (text: string) => update((previous) => [...previous, createPastedItem(text)]),
    [update],
  );

  const removePasted = useCallback(
    (id: string) => update((previous) => previous.filter((item) => item.id !== id)),
    [update],
  );

  const clearPasted = useCallback(() => update(() => NO_ITEMS), [update]);

  return { pastedItems, addPasted, removePasted, clearPasted };
}
