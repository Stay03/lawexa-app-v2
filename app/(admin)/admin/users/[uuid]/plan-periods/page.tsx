'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminUserPlanPeriods } from '@/lib/hooks/useAdmin';
import { AdminPlanPeriodsView } from '@/components/admin';

interface AdminUserPlanPeriodsPageProps {
  params: Promise<{ uuid: string }>;
}

export default function AdminUserPlanPeriodsPage({
  params,
}: AdminUserPlanPeriodsPageProps) {
  const { uuid } = use(params);
  const { data, isLoading, error } = useAdminUserPlanPeriods(uuid);

  const backLink = (
    <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
      <Link href={`/admin/users/${uuid}`}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        User details
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {backLink}
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="space-y-6">
        {backLink}
        <div className="rounded-lg border py-12">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-8 w-8 opacity-40" />
            <p className="text-sm">
              {error?.message?.includes('404')
                ? 'User not found'
                : 'Failed to load plan periods. Please try again.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { user } = data.data;

  return (
    <div className="space-y-6">
      {backLink}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plan periods</h1>
        <p className="text-sm text-muted-foreground">
          {user.name}
          {user.email ? ` · ${user.email}` : ''}
        </p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{user.uuid}</p>
      </div>

      <AdminPlanPeriodsView userUuid={uuid} data={data.data} />
    </div>
  );
}
