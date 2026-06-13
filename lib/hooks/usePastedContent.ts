'use client';

import { useEffect, useState } from 'react';

export interface PastedItem {
  id: string;
  text: string;
}

// Module-scoped counter gives staged pastes stable React keys without
// persisting the ids — so a page reload can't collide a fresh counter with
// ids saved in a previous session.
let pastedItemCounter = 0;

function createPastedItem(text: string): PastedItem {
  pastedItemCounter += 1;
  return { id: `paste-${pastedItemCounter}`, text };
}

function readInitial(storageKey?: string): PastedItem[] {
  if (!storageKey || typeof window === 'undefined') return [];
  const raw = localStorage.getItem(storageKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
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

/**
 * Staging state for large pasted blocks shown as removable cards above a
 * composer. Holds an ordered list with stable ids for React keys; when a
 * storageKey is given it persists as a plain string[] so older singular
 * drafts migrate transparently on first read.
 */
export function usePastedContent(storageKey?: string) {
  const [pastedItems, setPastedItems] = useState<PastedItem[]>(() =>
    readInitial(storageKey)
  );

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    if (pastedItems.length > 0) {
      localStorage.setItem(
        storageKey,
        JSON.stringify(pastedItems.map((item) => item.text))
      );
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [pastedItems, storageKey]);

  const addPasted = (text: string) =>
    setPastedItems((prev) => [...prev, createPastedItem(text)]);
  const removePasted = (id: string) =>
    setPastedItems((prev) => prev.filter((item) => item.id !== id));
  const clearPasted = () => setPastedItems([]);

  return { pastedItems, addPasted, removePasted, clearPasted };
}
