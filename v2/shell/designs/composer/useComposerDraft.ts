'use client';

import { useCallback, useState } from 'react';

import { readAsk } from './ask-param';

/**
 * useComposerDraft — the home composer's unsent-text draft, persisted so it survives
 * a reload AND a home-tab switch, faithful to v1 (`app/(main)/page.tsx` reads/writes
 * `localStorage['home_input_draft']`).
 *
 * SHARED across tabs BY DESIGN. v1 has one composer and one draft; v2 has three home
 * tabs (Chat / Work / Study) that key-remount as you switch. Backing the value with
 * the single `home_input_draft` key means text typed on Chat is still there on Work —
 * the tab that mounts re-reads the same draft. That matches v1's single-draft model
 * and is the better UX (never lose a half-typed question to a tab flip).
 *
 * GUEST → LOGIN preservation: v1 opens an in-place auth modal and restores the saved
 * prompt after login. v2 cannot use that modal (boundary), so a guest submit routes
 * to `/login` — and because the typed text is ALREADY in `home_input_draft`, the v2
 * home restores it automatically after login (the same draft, no separate key).
 *
 * The value is a client-only read, so SSR/first render is `''` and the draft appears
 * on hydration (the sanctioned "lazy useState for client values" pattern — the
 * initializer stays pure, and the setter is the only writer, so there is no
 * setState-in-effect for the React Compiler lint to flag).
 *
 * A LINK'S WORDS COME FIRST (`ask-param.ts`, 28 October 2026): `/?ask=…` opens
 * the box with them in place of the saved draft, and the home stores them as
 * the draft once it has them (`useAskArrival`).
 */
const DRAFT_KEY = 'home_input_draft';

/** Store the home's draft; an empty one is removed. */
export function saveComposerDraft(next: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (next) window.localStorage.setItem(DRAFT_KEY, next);
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // localStorage unavailable (privacy mode) — the draft is in-memory only.
  }
}

export function useComposerDraft(): readonly [string, (next: string) => void] {
  const [value, setValue] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const ask = readAsk({ kind: 'home' });
    if (ask) return ask;
    try {
      return window.localStorage.getItem(DRAFT_KEY) ?? '';
    } catch {
      return '';
    }
  });

  const set = useCallback((next: string) => {
    setValue(next);
    saveComposerDraft(next);
  }, []);

  return [value, set] as const;
}
