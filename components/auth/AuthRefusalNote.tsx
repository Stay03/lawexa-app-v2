'use client';

import { useSyncExternalStore } from 'react';

import { returnPathFromLocation } from '@/lib/utils/auth-return';
import { EMAIL_TAKEN_LINE, USE_GOOGLE_LINE, signInWithEmailHref, type AuthRefusal } from '@/lib/utils/auth-refusal';
import { GoogleAuthButton } from './GoogleAuthButton';

const noSubscription = () => () => {};

/**
 * What to do instead, said where the refusal happened (lib/utils/auth-refusal.ts):
 * a Google account gets the Google button right under the line, never a way to
 * make a second account; a taken email gets Sign in, with the email and this
 * page's way back carried. Google sign-in keeps `?redirect=` itself
 * (auth-return.ts), and a referral code is already held by the visit.
 */
export function AuthRefusalNote({ refusal, email }: { refusal: AuthRefusal; email: string }) {
  const returnPath = useSyncExternalStore(noSubscription, returnPathFromLocation, () => null);
  if (refusal === 'use_google') {
    return (
      <div role="alert" className="space-y-2 rounded-lg border border-border bg-muted/50 p-3">
        <p className="text-sm font-medium text-foreground">{USE_GOOGLE_LINE}</p>
        <GoogleAuthButton />
      </div>
    );
  }
  return (
    <div role="alert" className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
      <p className="font-medium text-foreground">{EMAIL_TAKEN_LINE}</p>
      <a href={signInWithEmailHref(email, returnPath)} className="mt-1 inline-block font-medium text-primary hover:underline">
        Sign in
      </a>
    </div>
  );
}
