'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/common/ErrorState';
import PlanSection from '@/components/subscriptions/PlanSection';
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

  const showCancellation =
    !currentData.is_free_tier && currentData.subscription?.status === 'active';

  // Return
  return (
    <div>
      {/* Plan section */}
      <PlanSection data={currentData} />

      <Separator className="my-8" />

      {/* Invoices section */}
      <InvoiceSection />

      {/* Cancellation section */}
      {showCancellation && (
        <>
          <Separator className="my-8" />
          <CancellationSection onCancel={() => setIsCancelOpen(true)} />
        </>
      )}

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
 * Invoices section with accent heading.
 */
function InvoiceSection() {
  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
        Invoices
      </h3>
      <InvoiceTable />
    </div>
  );
}

/**
 * Cancellation section with destructive action.
 */
function CancellationSection({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
        Cancellation
      </h3>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium">Cancel plan</p>
        <Button variant="destructive" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * Skeleton for the billing page.
 */
function BillingSkeleton() {
  return (
    <div>
      {/* Plan section skeleton */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>

      <Separator className="my-8" />

      {/* Invoices section skeleton */}
      <div className="space-y-5">
        <Skeleton className="h-4 w-16" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-10" />
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
