'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useAuthStore } from '@/lib/stores/authStore';
import { inviteJoinPath, shouldReturnToInvite, usePendingInvite } from './pending-invite';

/**
 * PendingInviteReturn — takes a person back to the invite they arrived with,
 * once they can join (the invite join fix, 10 November 2026; Backend's study,
 * confirmed by the techlead).
 *
 * The join screen holds the code before it sends somebody to sign up, but
 * nothing read it again: sign-up confirms the email on another page and
 * onboarding follows, and neither carries the way back, so a brand new person
 * did everything asked of them and never landed in the Space. Mounted once
 * for the whole app; it draws nothing. On the invite page the join screen
 * finishes the join itself (JoinScreen: the held code is this invite's).
 *
 * The code is read at render (`usePendingInvite`), so a fresh page load after
 * confirming an email sees it at once. The account comes from the auth store,
 * which is empty until it has loaded, so the move waits for it rather than
 * acting on an empty first read.
 */
export function PendingInviteReturn() {
  const code = usePendingInvite();
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const signedIn = useAuthStore((state) => state.isAuthenticated);
  const isGuest = useAuthStore((state) => state.isGuest);
  const verified = useAuthStore((state) => state.user?.is_verified === true);
  const go = shouldReturnToInvite({ code, pathname, signedIn, isGuest, verified });

  useEffect(() => {
    if (go && code) router.replace(inviteJoinPath(code));
  }, [go, code, router]);

  return null;
}
