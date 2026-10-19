'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOutButton } from '@/components/auth/LogOutButton';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  RESEND_WAIT_SECONDS,
  pathAfterVerified,
  resendLabel,
  resendSaysVerified,
  resendWaitAfterError,
} from '@/lib/utils/signup-flow';

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  // After a send, the button waits (row 3 of the sign-up test, 19 October
  // 2026: it had no cooldown); a 429 waits the server's own retry time.
  const [secondsLeft, setSecondsLeft] = useState(0);
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isGuest = useAuthStore((state) => state.isGuest);
  const checking = useRef(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // A verified account moves on, to onboarding when it is unfinished, else
  // the app.
  const moveOnIfVerified = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      const response = await authApi.me();
      const user = response.data?.user;
      if (user?.is_verified) {
        useAuthStore.getState().updateUser(user);
        router.replace(pathAfterVerified(user.profile));
      }
    } catch {
      // Not known yet: the screen stays, and the next look tries again.
    } finally {
      checking.current = false;
    }
  }, [router]);

  // Verified elsewhere (another tab, another device): this screen checks when
  // it opens and whenever it is shown again (row 10).
  useEffect(() => {
    if (!isAuthenticated || isGuest) return;
    void moveOnIfVerified();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void moveOnIfVerified();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isAuthenticated, isGuest, moveOnIfVerified]);

  const handleResend = async () => {
    setIsResending(true);
    setResendMessage(null);
    setResendError(null);

    try {
      const response = await authApi.resendVerification();
      // Verified meanwhile: the server says so (200, "Email already
      // verified."), and the screen moves on instead of counting down.
      if (resendSaysVerified(response.message)) {
        void moveOnIfVerified();
        return;
      }
      setResendMessage('Verification email sent! Please check your inbox.');
      setSecondsLeft(RESEND_WAIT_SECONDS);
    } catch (error) {
      const wait = resendWaitAfterError(error);
      if (wait > 0) {
        setResendError(`Please wait ${wait} seconds before asking for another email.`);
        setSecondsLeft(wait);
      } else {
        setResendError('Failed to resend verification email. Please try again.');
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-center text-2xl font-bold">
            Check your email
          </CardTitle>
          <CardDescription className="text-center">
            We&apos;ve sent a verification link to{' '}
            {email ? (
              <span className="font-medium text-foreground">{email}</span>
            ) : (
              'your email address'
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">
              Didn&apos;t receive the email?
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Check your spam or junk folder</li>
              <li>Make sure you entered the correct email address</li>
              <li>Wait a few minutes and check again</li>
            </ul>
          </div>

          {resendMessage && (
            <p className="text-sm text-green-600 dark:text-green-400 text-center">
              {resendMessage}
            </p>
          )}

          {resendError && (
            <p className="text-sm text-destructive text-center">
              {resendError}
            </p>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={handleResend}
            disabled={isResending || secondsLeft > 0}
          >
            {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <span className="tabular-nums">{resendLabel(secondsLeft)}</span>
          </Button>
        </CardContent>

        <CardFooter className="flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Wrong email?{' '}
            <a href="/register" className="text-primary hover:underline">
              Sign up again
            </a>
          </p>
          <LogOutButton />
        </CardFooter>
      </Card>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-center text-2xl font-bold">
              Loading...
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <CheckEmailContent />
    </Suspense>
  );
}
