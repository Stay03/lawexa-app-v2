'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { useV2Session } from './session-context';
import { signInHref } from './sign-in-href';

/**
 * Save and Add to folder for a visitor (v2 Stage 1, item 1; Stay, 19 October
 * 2026: "Add the folder button that send to sign in"). A visitor reads on a
 * guest pass, and the old design showed them Save and Add to folder all the
 * same, with a tap going to sign in. Those buttons ask this first: for a guest
 * it returns the way to sign in, coming back to this page afterwards; for an
 * account it returns null and the button does its own work.
 */

export function useGuestSignIn(): (() => void) | null {
  const { role } = useV2Session();
  const router = useRouter();
  const go = useCallback(() => {
    router.push(signInHref(`${window.location.pathname}${window.location.search}`));
  }, [router]);
  return role === 'guest' ? go : null;
}
