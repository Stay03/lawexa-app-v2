'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { canAccessQuizPlayer } from '@/lib/utils/quiz-access';
import { Skeleton } from '@/components/ui/skeleton';

interface QuizGuardProps {
  children: React.ReactNode;
}

/**
 * Route guard for the Quiz player. Allows only the soft-launch audience
 * (researcher / admin / superadmin) through; everyone else is redirected home —
 * they should never have seen a link here anyway (the sidebar hides it).
 *
 * Mirrors AdminGuard. Note this gates on **role only**: verified-email is a
 * backend requirement surfaced as a friendly notice on the player screens (a
 * `403`), not a reason to bounce an allowed-role user off the route.
 */
export function QuizGuard({ children }: QuizGuardProps) {
  const router = useRouter();
  const { user, isAuthenticated, isGuest, isLoading } = useAuth();

  const canAccess =
    isAuthenticated && !isGuest && canAccessQuizPlayer(user?.role);

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace('/');
    }
  }, [isLoading, canAccess, router]);

  if (isLoading) {
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
