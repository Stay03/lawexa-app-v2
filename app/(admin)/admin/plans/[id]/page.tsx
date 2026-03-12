'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminPlan } from '@/lib/hooks/useAdmin';
import { AdminPlanDetailView } from '@/components/admin/plans/AdminPlanDetailView';
import { AdminPlanLimitsForm } from '@/components/admin/plans/AdminPlanLimitsForm';
import { AdminPlanSubscriptionsTable } from '@/components/admin/plans/AdminPlanSubscriptionsTable';

/******************************************************************************
                                 Component
******************************************************************************/

function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const id = Number(rawId);
  const { data, isLoading, error } = useAdminPlan(id);

  // Back button
  const backLink = (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link href="/admin/plans">
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Plans
      </Link>
    </Button>
  );

  // Invalid ID
  if (isNaN(id) || id <= 0) {
    return (
      <div className="space-y-6">
        {backLink}
        <div className="rounded-lg border py-12">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-8 w-8 opacity-40" />
            <p className="text-sm">Invalid plan ID</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="space-y-6">
        {backLink}
        <Skeleton className="h-8 w-[260px]" />
        <Skeleton className="h-[420px] rounded-2xl" />
        <Skeleton className="h-[200px] rounded-2xl" />
        <Skeleton className="h-[200px] rounded-2xl" />
      </div>
    );
  }

  // Error / Not found
  if (error || !data?.data) {
    return (
      <div className="space-y-6">
        {backLink}
        <div className="rounded-lg border py-12">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-8 w-8 opacity-40" />
            <p className="text-sm">
              {error?.message?.includes('404')
                ? 'Plan not found'
                : 'Failed to load plan. Please try again.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const plan = data.data;

  return (
    <div className="space-y-6">
      {backLink}

      <h1 className="text-2xl font-semibold tracking-tight">{plan.name}</h1>

      <AdminPlanDetailView plan={plan} />

      <AdminPlanLimitsForm plan={plan} />

      {plan.recent_subscriptions && (
        <AdminPlanSubscriptionsTable
          subscriptions={plan.recent_subscriptions}
        />
      )}
    </div>
  );
}

export default PlanDetailPage;
