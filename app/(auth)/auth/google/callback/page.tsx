'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/authStore';

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    const handleCallback = async () => {
      const accessToken = searchParams.get('access_token');
      const error = searchParams.get('error');

      // Handle error from Google
      if (error) {
        router.push('/login?error=google_auth_failed');
        return;
      }

      // Handle missing token
      if (!accessToken) {
        router.push('/login?error=missing_token');
        return;
      }

      try {
        const response = await authApi.googleCallback(accessToken);
        if (response.success && response.data) {
          setAuth(response.data.user, response.data.token);
          router.push('/');
        }
      } catch {
        router.push('/login?error=google_auth_failed');
      }
    };

    handleCallback();
  }, [searchParams, router, setAuth]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <GoogleCallbackContent />
    </Suspense>
  );
}
