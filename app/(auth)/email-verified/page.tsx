'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle } from 'lucide-react';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function EmailVerifiedContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const isSuccess = status === 'success';

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          {isSuccess ? (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-center text-2xl font-bold">
                Email verified!
              </CardTitle>
              <CardDescription className="text-center">
                Your email has been verified successfully. You can now continue to the app.
              </CardDescription>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-center text-2xl font-bold">
                Verification failed
              </CardTitle>
              <CardDescription className="text-center">
                The verification link is invalid or has expired. Please try again or request a new verification email.
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardFooter className="flex justify-center">
          {isSuccess ? (
            <Button asChild>
              <a href="/onboarding">Continue to app</a>
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <a href="/login">Back to login</a>
            </Button>
          )}
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
