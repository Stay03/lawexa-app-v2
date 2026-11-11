'use client';

import { ShieldAlert } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/hooks/useAuth';

/**
 * Certificates admin is superadmin-only on the server; `AdminGuard` lets every
 * admin into the area, so these pages say so instead of showing failed reads
 * (Techlead 113d06a1, as on operations/chat-errors). The children, and their
 * queries, only mount for a superadmin.
 */
export function SuperadminGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if (user?.role !== 'superadmin') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ShieldAlert aria-hidden className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Superadmin access required</p>
            <p className="text-sm text-muted-foreground">Certificates are managed by superadmins.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
