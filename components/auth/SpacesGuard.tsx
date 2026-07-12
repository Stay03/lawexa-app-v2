'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAuthStore } from '@/lib/stores/authStore';
import { canAccessSpaces } from '@/lib/utils/spaces-access';
import { Skeleton } from '@/components/ui/skeleton';

interface SpacesGuardProps {
  children: React.ReactNode;
}

/**
 * Tracks whether the persisted auth store has finished rehydrating. On a cold
 * page load the session is restored from storage asynchronously; deciding
 * access before that finishes would wrongly bounce a logged-in user.
 * `useSyncExternalStore` keeps this SSR-safe and React-Compiler clean.
 */
function useAuthHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) =>
      useAuthStore.persist?.onFinishHydration(onStoreChange) ?? (() => {}),
    () => useAuthStore.persist?.hasHydrated() ?? false,
    () => false
  );
}

/**
 * Route guard for the Spaces (Channels) feature. Allows only the soft-launch
 * audience (researcher / admin / superadmin); everyone else is redirected home.
 * The decision waits until auth has settled (store hydrated + profile query
 * done) so a direct hard-load can't redirect before the session is restored.
 */
export function SpacesGuard({ children }: SpacesGuardProps) {
  const router = useRouter();
  const { user, isGuest, isLoading } = useAuth();
  const hydrated = useAuthHydrated();

  const canAccess = !isGuest && canAccessSpaces(user?.role);
  const settled = hydrated && !isLoading;

  useEffect(() => {
    if (settled && !canAccess) {
      router.replace('/');
    }
  }, [settled, canAccess, router]);

  if (!settled) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <div className="mt-6 flex gap-6">
          <Skeleton className="h-64 w-60" />
          <Skeleton className="h-64 flex-1" />
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return null;
  }

  return <>{children}</>;
}
