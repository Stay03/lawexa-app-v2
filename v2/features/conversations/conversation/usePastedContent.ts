'use client';

import { useCallback, useState } from 'react';

/**
 * usePastedContent (v2) — staging state for large pasted blocks shown as removable
 * chips above the composer. v2-native rebuild of v1's `lib/hooks/usePastedContent`
 * (boundary-blocked). Same behavior: an ordered list with stable ids, persisted as
 * a plain `string[]` under `storageKey` so older singular drafts migrate on read.
 *
 * Persistence happens in the MUTATORS (not an effect), the sanctioned React
 * Compiler-clean pattern (mirrors `useComposerDraft`): the lazy initializer stays
 * pure and the setters are the only writers.
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

function readInitial(storageKey?: string): PastedItem[] {
  if (!storageKey || typeof window === 'undefined') return [];
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    return [];
  }
  if (!raw) return [];
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
}

function persist(storageKey: string | undefined, items: PastedItem[]): void {
  if (!storageKey || typeof window === 'undefined') return;
  try {
    if (items.length > 0) {
      window.localStorage.setItem(storageKey, JSON.stringify(items.map((i) => i.text)));
    } else {
      window.localStorage.removeItem(storageKey);
    }
  } catch {
    // localStorage unavailable (private mode) — staging stays in-memory only.
  }
}

export function usePastedContent(storageKey?: string) {
  const [pastedItems, setPastedItems] = useState<PastedItem[]>(() => readInitial(storageKey));

  const addPasted = useCallback(
    (text: string) =>
      setPastedItems((prev) => {
        const next = [...prev, createPastedItem(text)];
        persist(storageKey, next);
        return next;
      }),
    [storageKey],
  );

  const removePasted = useCallback(
    (id: string) =>
      setPastedItems((prev) => {
        const next = prev.filter((item) => item.id !== id);
        persist(storageKey, next);
        return next;
      }),
    [storageKey],
  );

  const clearPasted = useCallback(() => {
    setPastedItems([]);
    persist(storageKey, []);
  }, [storageKey]);

  return { pastedItems, addPasted, removePasted, clearPasted };
}
