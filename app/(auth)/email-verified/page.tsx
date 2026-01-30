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

function EmailVerifiedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const status = searchParams.get('status');
  const isSuccess = status === 'success';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch fresh user data from the server
      const response = await authApi.me();

      // Update the auth store with the fresh user data (including is_verified: true)
      useAuthStore.getState().updateUser(response.data.user);

      // Now navigate to onboarding
      router.push('/onboarding');
    } catch (err) {
      console.error('[EmailVerified] Failed to fetch user data:', err);
      setError('Failed to load user data. Please try again.');
      setIsLoading(false);
    }
  };

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

        <CardFooter className="flex flex-col gap-2">
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center">
              {error}
            </p>
          )}
          <div className="flex justify-center w-full">
            {isSuccess ? (
              <Button onClick={handleContinue} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Continue to app'
                )}
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <a href="/login">Back to login</a>
              </Button>
            )}
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
