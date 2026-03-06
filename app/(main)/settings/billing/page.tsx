'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import CurrentPlanCard from '@/components/subscriptions/CurrentPlanCard';
import InvoiceTable from '@/components/subscriptions/InvoiceTable';
import CancelDialog from '@/components/subscriptions/CancelDialog';
import {
  useCurrentSubscription,
  useCancelSubscription,
} from '@/lib/hooks/useSubscriptions';

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Billing settings page with current plan and invoice history.
 */
function BillingPage() {
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const currentQuery = useCurrentSubscription();
  const cancelMutation = useCancelSubscription();
  const currentData = currentQuery.data?.data ?? null;

  /** Handle subscription cancellation. */
  const handleCancel = () => {
    cancelMutation.mutate(undefined, {
      onSuccess: (data) => {
        toast.success(data.message || 'Subscription cancelled.');
        setIsCancelOpen(false);
      },
      onError: (err) => {
        const message =
          err instanceof Error ? err.message : 'Failed to cancel subscription.';
        toast.error(message);
      },
    });
  };

  // Loading
  if (currentQuery.isLoading) {
    return <BillingSkeleton />;
  }

  // Error
  if (currentQuery.isError || !currentData) {
    return (
      <ErrorState
        title="Failed to load billing"
        description="We couldn't load your subscription details."
        retry={() => currentQuery.refetch()}
      />
    );
  }

  // Return
  return (
    <div className="space-y-8">
      {/* Current plan */}
      <CurrentPlanCard
        data={currentData}
        onCancel={() => setIsCancelOpen(true)}
      />

      {/* Invoice history */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Invoice History</h2>
          <p className="text-sm text-muted-foreground">
            View your past payments and billing history.
          </p>
        </div>
        <InvoiceTable />
      </div>

      {/* Cancel dialog */}
      <CancelDialog
        open={isCancelOpen}
        onOpenChange={setIsCancelOpen}
        subscription={currentData.subscription}
        isPending={cancelMutation.isPending}
        onConfirm={handleCancel}
      />
    </div>
  );
}

/**
 * Skeleton for the billing page.
 */
function BillingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border p-6 space-y-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-36 rounded-full" />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-56" />
        <div className="rounded-lg border p-4 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default BillingPage;
