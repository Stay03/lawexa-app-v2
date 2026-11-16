'use client';

import type { ComponentProps } from 'react';
import Link from 'next/link';

import { rememberPendingSpace, signInToSpaceHref, signUpToSpaceHref } from '@/lib/utils/pending-space';

/**
 * Sign in, or create an account, from a collab panel. At a Space's address
 * (`returnTo`, already checked to be `/spaces/<uuid>`) the link carries
 * `?redirect=` back to it and holds the Space, so a sign-up that confirms its
 * email and onboards first still lands there (`PendingSpaceReturn`). Anywhere
 * else it is the plain page, as before. Props pass through so a `Button
 * asChild` styles it.
 */
export function AuthLink({
  to,
  returnTo,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href'> & { to: 'login' | 'register'; returnTo: string | null }) {
  const href = !returnTo ? `/${to}` : to === 'login' ? signInToSpaceHref(returnTo) : signUpToSpaceHref(returnTo);
  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        if (returnTo) rememberPendingSpace(returnTo);
        onClick?.(event);
      }}
    />
  );
}
