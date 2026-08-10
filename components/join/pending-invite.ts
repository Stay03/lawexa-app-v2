'use client';

import { useSyncExternalStore } from 'react';

/**
 * The invite code somebody arrived with, held across sign-up and email
 * confirmation so we can finish the join when they come back.
 *
 * ── WHY THIS IS NOT A `useEffect` AND NOT ZUSTAND-PERSIST ──────────────────
 * The flow is: land on the invite → sign up → confirm email → come back on a
 * FRESH PAGE LOAD → we must know the code. That is the exact shape of the
 * onboarding bug from July: zustand's persist middleware serves
 * `getInitialState()` during React's hydration pass, so anything that reads it
 * inside an effect sees the EMPTY value first, decides the code is gone, and
 * acts on that. There it bounced people to step one; here it would silently
 * drop the invite of a brand new user who has just done everything we asked.
 *
 * `useSyncExternalStore` is the fix, and it is a fix rather than a workaround:
 * `getServerSnapshot` returns `null` so the server and the first client paint
 * agree (no hydration mismatch), and the store is then read from
 * `localStorage` synchronously ON EVERY RENDER rather than once in an effect.
 * There is no frame in which the value is wrongly absent.
 *
 * ── IT EXPIRES, BECAUSE A STALE INVITE IS WORSE THAN NONE ──────────────────
 * Somebody who abandons sign-up and returns a fortnight later should not be
 * silently pushed into a space they have forgotten agreeing to. A day is long
 * enough for "confirm your email, then come back" and short enough that the
 * code cannot outlive the intent.
 */

const KEY = 'lawexa-pending-invite';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface StoredInvite {
  code: string;
  at: number;
}

/** Bumped on every write so `useSyncExternalStore` re-reads. Also driven by
 *  `storage` events, so finishing sign-up in a second tab is not missed. */
const listeners = new Set<() => void>();
let snapshot: string | null | undefined;

function emit(): void {
  snapshot = undefined; // force a re-read on the next getSnapshot
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) emit();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

function read(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredInvite;
    if (typeof parsed?.code !== 'string' || typeof parsed?.at !== 'number') {
      return null;
    }
    if (Date.now() - parsed.at > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return parsed.code;
  } catch {
    // A corrupt or unreadable value is the same as no invite. Never throw on
    // the path a first-time user is standing in.
    return null;
  }
}

/** Cached so `getSnapshot` is referentially stable between writes — returning a
 *  fresh value every call makes `useSyncExternalStore` loop. */
function getSnapshot(): string | null {
  if (snapshot === undefined) snapshot = read();
  return snapshot;
}

/** `null` on the server and on the first paint, so hydration matches. */
function getServerSnapshot(): string | null {
  return null;
}

export function rememberPendingInvite(code: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ code, at: Date.now() } satisfies StoredInvite),
    );
  } catch {
    // Private mode, or storage full. The invite simply is not remembered — the
    // link still works, they just land on it again rather than being carried.
  }
  emit();
}

export function forgetPendingInvite(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to undo */
  }
  emit();
}

/** The held code, read at RENDER — never in an effect. See the docblock. */
export function usePendingInvite(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
