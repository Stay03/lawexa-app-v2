'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const { user, isAuthenticated, isGuest, isLoading } = useAuth();

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || isGuest || !isAdmin)) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, isGuest, isAdmin, router]);

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

  if (!isAuthenticated || isGuest || !isAdmin) {
    return null;
  }

  return <>{children}</>;
}
