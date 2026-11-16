'use client';

import { useSyncExternalStore } from 'react';

import { isASignInStep } from './pending-invite';

/**
 * The Space somebody opened before they had an account, held across sign-in,
 * sign-up, email confirmation and onboarding so they land on it afterwards
 * (Lucy's walk, 16 November 2026). The same shape as the held invite
 * (`pending-invite.ts`): read at render with `useSyncExternalStore`, so a fresh
 * page load after confirming an email sees it at once, and kept a day at most.
 *
 * Only a Space's own address is ever held or followed: `/spaces/<uuid>` on this
 * site, so a stored value can never send anybody elsewhere (techlead, 16
 * November 2026: no open redirect).
 */

const KEY = 'lawexa-pending-space';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SPACE_PATH = /^\/(?:v2\/)?spaces\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/[^?#]*)?$/i;

/**
 * The Space's own address for a path inside it, or null. A path deeper in the
 * Space (a chat, a folder) returns to the Space itself; `/spaces/discover` and
 * anything that is not one Space's address is null.
 */
export function spaceReturnPath(raw: string | null | undefined): string | null {
  const match = raw ? SPACE_PATH.exec(raw) : null;
  return match ? `/spaces/${match[1].toLowerCase()}` : null;
}

interface StoredSpace {
  path: string;
  at: number;
}

const listeners = new Set<() => void>();
let snapshot: string | null | undefined;

function emit(): void {
  snapshot = undefined;
  listeners.forEach((listener) => listener());
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
    const parsed = JSON.parse(raw) as StoredSpace;
    if (typeof parsed?.at !== 'number' || Date.now() - parsed.at > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    // Checked again on the way out: storage is the page's to write, not ours alone.
    return spaceReturnPath(parsed.path);
  } catch {
    return null;
  }
}

function getSnapshot(): string | null {
  if (snapshot === undefined) snapshot = read();
  return snapshot;
}

function getServerSnapshot(): string | null {
  return null;
}

/** Hold the Space at `path` (any path inside it); nothing is held for any other path. */
export function rememberPendingSpace(path: string): void {
  const space = spaceReturnPath(path);
  if (!space || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ path: space, at: Date.now() } satisfies StoredSpace));
  } catch {
    // Private mode or full storage: sign-in's own `?redirect=` still returns them.
  }
  emit();
}

export function forgetPendingSpace(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to undo */
  }
  emit();
}

/** The held Space's address, read at render. */
export function usePendingSpace(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Sign-in, or sign-up, that comes back to the Space (`?redirect=`, kept across Google sign-in too). */
export function signInToSpaceHref(space: string): string {
  return `/login?redirect=${encodeURIComponent(space)}`;
}

export function signUpToSpaceHref(space: string): string {
  return `/register?redirect=${encodeURIComponent(space)}`;
}

/**
 * What the held Space asks for on this page: `go` back to it, `forget` it (the
 * person is on it now), or nothing yet. It waits until they are signed in with
 * a confirmed account, are past every sign-in and onboarding step, and hold no
 * invite (an invite brings them to its own Space and finishes the join).
 */
export function pendingSpaceStep({
  space,
  pathname,
  signedIn,
  isGuest,
  verified,
  holdsInvite,
}: {
  space: string | null;
  pathname: string;
  signedIn: boolean;
  isGuest: boolean;
  verified: boolean;
  holdsInvite: boolean;
}): 'go' | 'forget' | null {
  if (!space || !signedIn || isGuest || !verified) return null;
  if (spaceReturnPath(pathname) === space) return 'forget';
  if (holdsInvite || isASignInStep(pathname)) return null;
  return 'go';
}
