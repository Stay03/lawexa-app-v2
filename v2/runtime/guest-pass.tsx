'use client';

import { useEffect, useSyncExternalStore } from 'react';

import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/authStore';
import { setCachedFingerprint } from '@/lib/utils/device-id';

/**
 * GuestPass — a visitor who is not signed in reads as a GUEST, the way v1 lets
 * them (v2 Stage 1, item 1; Stay, 19 October 2026, 02:10 UTC). The API answers
 * the case, statute and note reads with a guest token and refuses them with
 * none; v1 mints that token for every visitor (`useGuestAuth`), v2 never did,
 * so a visitor met "Sign in" on the libraries.
 *
 * ONE MINT, IN THE BROWSER, THROUGH v1's OWN CALL. `authApi.guestToken` carries
 * the referral attribution (`lib/utils/attribution.ts`: the first auth call a
 * visitor makes credits the link they came in on, and for almost everybody that
 * is this one), the fingerprint and the device id. The token lands in the same
 * store every v2 read already sends (`lib/api/client.ts`), and `SessionSync`
 * mirrors it into the session cookie and refreshes the layout, which then
 * resolves the guest through `/auth/me` and opens every read gate. No server
 * code: the server never mints.
 *
 * ONCE PER DEVICE, NOT PER TAB OR LOAD. The store is shared through
 * `localStorage`, so a second tab, or the next load, finds the token and mints
 * nothing; a module promise folds concurrent mounts in one tab into one call.
 *
 * AN EXPIRED PASS IS RENEWED. A guest token lives 24 hours. When the device
 * holds one and the server read nobody, a silent `/auth/me` asks the API: a
 * live token answers and `SessionSync` mirrors it as before; a dead one gets a
 * 401, which the shared client answers with its own guest renewal (`client.ts`)
 * and `SessionSync` then carries the new token.
 *
 * WHAT A PAGE SHOWS MEANWHILE. Until the layout has re-rendered as the guest,
 * the published session still says signed out. {@link useGuestPassFailed}
 * lets a read gate show its loading shape instead of a sign-in wall that would
 * only flash; the wall stays for a pass that could not be had.
 */

type Status = 'idle' | 'minting' | 'failed';

let status: Status = 'idle';
const listeners = new Set<() => void>();
let minting: Promise<void> | null = null;
/** The token this module just minted: known good, so it is never checked again. */
let mintedToken: string | null = null;

function setStatus(next: Status): void {
  if (status === next) return;
  status = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True once a guest pass could not be had: the read gates then show their sign-in panel. */
export function useGuestPassFailed(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => status === 'failed',
    () => false,
  );
}

/** The device's fingerprint, kept where every request reads it (`X-Fingerprint`). */
async function fingerprint(): Promise<string | undefined> {
  try {
    const FingerprintJS = (await import('@fingerprintjs/fingerprintjs')).default;
    const agent = await FingerprintJS.load();
    const { visitorId } = await agent.get();
    setCachedFingerprint(visitorId);
    return visitorId;
  } catch {
    // The pass works without one: the server falls back to the device id.
    return undefined;
  }
}

function mint(): Promise<void> {
  if (minting) return minting;
  setStatus('minting');
  minting = fingerprint()
    .then((visitorId) => authApi.guestToken(visitorId))
    .then((response) => {
      if (!response.success || !response.data) throw new Error('No guest pass');
      mintedToken = response.data.token;
      useAuthStore.getState().setAuth(response.data.user, response.data.token);
      setStatus('idle');
    })
    .catch(() => setStatus('failed'))
    .finally(() => {
      minting = null;
    });
  return minting;
}

/** Ask the API who holds the token; a dead guest token is renewed on the way (`client.ts`). */
function renew(): void {
  if (minting) return;
  minting = authApi
    .meSilent()
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      minting = null;
    });
}

/** Try again from a failed pass (the sign-in panel's retry). */
export function retryGuestPass(): void {
  if (useAuthStore.getState().token) return;
  void mint();
}

/**
 * Renders nothing. Mounted once in the v2 layout beside `SessionSync`, with
 * the session that layout published.
 */
export function GuestPass({ serverSignedIn }: { serverSignedIn: boolean }): null {
  const token = useAuthStore((state) => state.token);
  const isGuest = useAuthStore((state) => state.isGuest);
  // The store serves an empty state until it has read `localStorage`; a mint
  // decided before that would replace a real reader's token with a guest's.
  const hydrated = useSyncExternalStore(
    (listener) => useAuthStore.persist.onFinishHydration(listener),
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  );

  useEffect(() => {
    if (!hydrated || serverSignedIn) return;
    if (!token) {
      void mint();
      return;
    }
    if (isGuest && token !== mintedToken) renew();
  }, [hydrated, serverSignedIn, token, isGuest]);

  return null;
}
