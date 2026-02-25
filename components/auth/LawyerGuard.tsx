'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

interface LawyerGuardProps {
  children: React.ReactNode;
}

export function LawyerGuard({ children }: LawyerGuardProps) {
  const router = useRouter();
  const { user, isAuthenticated, isGuest, isLoading } = useAuth();

  const isLawyer = user?.profile?.user_type === 'lawyer';

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || isGuest || !isLawyer)) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, isGuest, isLawyer, router]);

  if (isLoading) {
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
