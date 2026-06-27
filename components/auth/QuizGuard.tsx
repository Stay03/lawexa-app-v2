'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAuthStore } from '@/lib/stores/authStore';
import { canAccessQuizPlayer } from '@/lib/utils/quiz-access';
import { Skeleton } from '@/components/ui/skeleton';

interface QuizGuardProps {
  children: React.ReactNode;
}

/**
 * Tracks whether the persisted auth store has finished rehydrating. On a cold
 * page load (e.g. opening /quiz directly) the session is restored from storage
 * asynchronously; deciding access before that finishes would wrongly bounce a
 * logged-in user. `useSyncExternalStore` keeps this SSR-safe and React-Compiler
 * clean (no setState-in-effect).
 */
function useAuthHydrated(): boolean {
  return useSyncExternalStore(
    // Access `.persist` lazily inside the callbacks — these run on the client
    // only, never during the server prerender (which uses the server snapshot).
    (onStoreChange) =>
      useAuthStore.persist?.onFinishHydration(onStoreChange) ?? (() => {}),
    () => useAuthStore.persist?.hasHydrated() ?? false,
    () => false
  );
}

/**
 * Route guard for the Quiz player. Allows only the soft-launch audience
 * (researcher / admin / superadmin); everyone else is redirected home.
 *
 * Gates on role only — verified-email is surfaced as a notice on the player
 * screens, not a reason to bounce. The decision waits until auth has settled
 * (store hydrated + the profile query done) so a direct hard-load to /quiz
 * can't redirect during the brief window before the session is restored.
 */
export function QuizGuard({ children }: QuizGuardProps) {
  const router = useRouter();
  const { user, isGuest, isLoading } = useAuth();
  const hydrated = useAuthHydrated();

  const canAccess = !isGuest && canAccessQuizPlayer(user?.role);
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
        <div className="flex gap-6 mt-6">
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
