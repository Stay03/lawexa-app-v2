'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { apiClient } from '@/lib/api/client';

type VerificationStatus = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const params = useParams();
  const router = useRouter();
  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const response = await apiClient.get(
          `/auth/verify-email/${params.id}/${params.hash}${window.location.search}`
        );

        if (response.data.success) {
          setStatus('success');
          setMessage('Your email has been verified successfully.');
          // Redirect to home after 3 seconds
          setTimeout(() => {
            router.push('/');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(response.data.message || 'Verification failed.');
        }
      } catch {
        setStatus('error');
        setMessage('The verification link is invalid or has expired.');
      }
    };

    if (params.id && params.hash) {
      verifyEmail();
    }
  }, [params.id, params.hash, router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          {status === 'loading' && (
            <>
              <div className="mx-auto mb-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
              <CardTitle className="text-center text-2xl font-bold">
                Verifying your email...
              </CardTitle>
              <CardDescription className="text-center">
                Please wait while we verify your email address.
              </CardDescription>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-center text-2xl font-bold">
                Email verified!
              </CardTitle>
              <CardDescription className="text-center">{message}</CardDescription>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-center text-2xl font-bold">
                Verification failed
              </CardTitle>
              <CardDescription className="text-center">{message}</CardDescription>
            </>
          )}
        </CardHeader>

        <CardFooter className="flex justify-center">
          {status === 'success' && (
            <a href="/" className="text-sm text-primary hover:underline">
              Continue to app
            </a>
          )}
          {status === 'error' && (
            <a href="/login" className="text-sm text-primary hover:underline">
              Back to login
            </a>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
