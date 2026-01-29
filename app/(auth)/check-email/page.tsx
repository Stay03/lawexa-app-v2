'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { authApi } from '@/lib/api/auth';

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  const handleResend = async () => {
    setIsResending(true);
    setResendMessage(null);
    setResendError(null);

    try {
      await authApi.resendVerification();
      setResendMessage('Verification email sent! Please check your inbox.');
    } catch {
      setResendError('Failed to resend verification email. Please try again.');
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
            disabled={isResending}
          >
            {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Resend verification email
          </Button>
        </CardContent>

        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Wrong email?{' '}
            <a href="/register" className="text-primary hover:underline">
              Sign up again
            </a>
          </p>
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
