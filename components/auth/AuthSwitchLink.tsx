'use client';

import { useSyncExternalStore } from 'react';

import { returnPathFromLocation } from '@/lib/utils/auth-return';

/**
 * The link between sign-in and sign-up ("Don't have an account? Sign up", and
 * back), carrying this page's `?redirect=` across, so a person sent to sign in
 * from an invite (/join/{code}) who turns out to need an account still comes
 * back to it after signing up (the invite join fix, 10 November 2026).
 *
 * The address is read at render through `useSyncExternalStore`: `null` on the
 * server and on the first paint, so hydration matches, then the real address.
 * The address does not change while the form is up, so nothing to subscribe to.
 */
const noSubscription = () => () => {};

export function AuthSwitchLink({ to, children }: { to: '/login' | '/register'; children: React.ReactNode }) {
  const returnPath = useSyncExternalStore(noSubscription, returnPathFromLocation, () => null);
  const href = returnPath ? `${to}?redirect=${encodeURIComponent(returnPath)}` : to;
  return (
    <a href={href} className="text-primary hover:underline">
      {children}
    </a>
  );
}
