'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/authStore';
import { emailVerifiedState, pathAfterVerified, resendWaitAfterError } from '@/lib/utils/signup-flow';

function EmailVerifiedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // success, already-verified (row 8), expired (row 9) or invalid: the
  // server's redirect (sign-up test, 19 October 2026).
  const state = emailVerifiedState(searchParams.get('status'));
  const verified = state === 'success' || state === 'already-verified';
  const isAuthenticated = useAuthStore((store) => store.isAuthenticated);
  const isGuest = useAuthStore((store) => store.isGuest);
  const signedIn = isAuthenticated && !isGuest;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verified: on to onboarding when it is unfinished, else the app. Signed
  // out on this device (the link opened in another browser): sign in first.
  const handleContinue = async () => {
    if (!signedIn) {
      router.push('/login');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const response = await authApi.me();
      if (!response.data) {
        throw new Error('No user data received');
      }
      useAuthStore.getState().updateUser(response.data.user);
      router.push(pathAfterVerified(response.data.user.profile));
    } catch (err) {
      console.error('[EmailVerified] Failed to fetch user data:', err);
      setError('Failed to load user data. Please try again.');
      setIsLoading(false);
    }
  };

  // A link that expired or broke: a new one is one tap for a signed-in
  // reader; anyone else signs in first and asks from "Check your email".
  const handleNewLink = async () => {
    if (!signedIn) {
      router.push(`/login?redirect=${encodeURIComponent('/check-email')}`);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await authApi.resendVerification();
      router.push('/check-email');
    } catch (err) {
      const wait = resendWaitAfterError(err);
      setError(
        wait > 0
          ? `Please wait ${wait} seconds before asking for another email.`
          : 'Failed to send a new link. Please try again.',
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          {verified ? (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-center text-2xl font-bold">
                {state === 'success' ? 'Email verified!' : 'Your email is already verified'}
              </CardTitle>
              <CardDescription className="text-center">
                {state === 'success'
                  ? 'Your email has been verified successfully. You can now continue to the app.'
                  : 'This link was used before. Your email is verified, so you can carry on.'}
              </CardDescription>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-center text-2xl font-bold">
                This link has expired or is broken
              </CardTitle>
              <CardDescription className="text-center">
                Verification links last a limited time and work once. Send yourself a new one.
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardFooter className="flex flex-col gap-2">
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center">
              {error}
            </p>
          )}
          <div className="flex justify-center w-full">
            <Button onClick={verified ? handleContinue : handleNewLink} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : verified ? (
                signedIn ? 'Continue to app' : 'Sign in to continue'
              ) : (
                'Send a new link'
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function EmailVerifiedPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-center text-2xl font-bold">
              Loading...
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <EmailVerifiedContent />
    </Suspense>
  );
}
