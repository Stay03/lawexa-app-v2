'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAuthStore } from '@/lib/stores/authStore';
import { Skeleton } from '@/components/ui/skeleton';

interface LawyerGuardProps {
  children: React.ReactNode;
}

export function LawyerGuard({ children }: LawyerGuardProps) {
  const router = useRouter();
  const { user, isAuthenticated, isGuest, isLoading } = useAuth();

  // Wait for Zustand to hydrate from localStorage before making auth decisions.
  // Without this, a page refresh sees default state (isAuthenticated: false)
  // and redirects before the persisted auth data is restored.
  // Initialize to false — the persist API is only available client-side.
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHasHydrated(true);
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setHasHydrated(true));
    return unsub;
  }, []);

  const isLawyer = user?.profile?.user_type === 'lawyer';

  useEffect(() => {
    if (hasHydrated && !isLoading && (!isAuthenticated || isGuest || !isLawyer)) {
      router.replace('/');
    }
  }, [hasHydrated, isLoading, isAuthenticated, isGuest, isLawyer, router]);

  if (!hasHydrated || isLoading) {
    return (
      <div className="w-full mx-auto max-w-3xl space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!isAuthenticated || isGuest || !isLawyer) {
    return null;
  }

  return <>{children}</>;
}
