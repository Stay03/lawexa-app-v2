'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useAuthStore } from '@/lib/stores/authStore';
import { usePendingInvite } from './pending-invite';
import { forgetPendingSpace, pendingSpaceStep, usePendingSpace } from './pending-space';

/**
 * PendingSpaceReturn — takes a person back to the Space they opened before
 * they had an account, once they are signed in with a confirmed account
 * (Lucy's walk, 16 November 2026). Sign-in returns by `?redirect=` already;
 * sign-up confirms the email on another page and onboarding follows, and
 * neither keeps it, so this is what brings a brand new person to the Space.
 * Mounted once for the whole app beside `PendingInviteReturn`; it draws
 * nothing. A held invite goes first: it lands on its own Space and joins.
 */
export function PendingSpaceReturn() {
  const space = usePendingSpace();
  const holdsInvite = usePendingInvite() !== null;
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const signedIn = useAuthStore((state) => state.isAuthenticated);
  const isGuest = useAuthStore((state) => state.isGuest);
  const verified = useAuthStore((state) => state.user?.is_verified === true);
  const step = pendingSpaceStep({ space, pathname, signedIn, isGuest, verified, holdsInvite });

  useEffect(() => {
    if (step === 'forget') forgetPendingSpace();
    else if (step === 'go' && space) router.replace(space);
  }, [step, space, router]);

  return null;
}
