'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAuthStore } from '@/lib/stores/authStore';
import { canAccessSpaces } from '@/lib/utils/spaces-access';
import {
  ChannelViewSkeleton,
  SpaceDetailSkeleton,
  SpacesPageSkeleton,
} from '@/components/collab/skeletons';

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
  const pathname = usePathname();
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
    // Match the destination page's skeleton so a cold refresh shows one
    // continuous placeholder instead of a generic one that then swaps.
    if (pathname.startsWith('/channels/')) return <ChannelViewSkeleton />;
    if (/^\/spaces\/[^/]+/.test(pathname)) return <SpaceDetailSkeleton />;
    return <SpacesPageSkeleton />;
  }

  if (!canAccess) {
    return null;
  }

  return <>{children}</>;
}
