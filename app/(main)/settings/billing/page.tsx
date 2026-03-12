'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/common/ErrorState';
import PlanSection from '@/components/subscriptions/PlanSection';
import InvoiceTable from '@/components/subscriptions/InvoiceTable';
import CancelDialog from '@/components/subscriptions/CancelDialog';
import TrialCancelDialog from '@/components/subscriptions/TrialCancelDialog';
import {
  useCurrentSubscription,
  useCancelSubscription,
} from '@/lib/hooks/useSubscriptions';
import { useTrialStatus, useCancelTrial } from '@/lib/hooks/useTrial';

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Billing settings page with current plan and invoice history.
 */
function BillingPage() {
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isTrialCancelOpen, setIsTrialCancelOpen] = useState(false);
  const currentQuery = useCurrentSubscription();
  const cancelMutation = useCancelSubscription();
  const currentData = currentQuery.data?.data ?? null;

  // Trial-specific hooks
  const isTrialing = currentData?.subscription?.status === 'trialing';
  const trialQuery = useTrialStatus(isTrialing);
  const trialData = trialQuery.data?.data ?? null;
  const cancelTrialMutation = useCancelTrial();

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

  /** Handle trial cancellation. */
  const handleCancelTrial = () => {
    cancelTrialMutation.mutate(undefined, {
      onSuccess: (data) => {
        toast.success(data.message || 'Trial cancelled.');
        setIsTrialCancelOpen(false);
      },
      onError: (err) => {
        const message =
          err instanceof Error ? err.message : 'Failed to cancel trial.';
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

  const showSubscriptionCancellation =
    !currentData.is_free_tier && currentData.subscription?.status === 'active';
  const showTrialCancellation = isTrialing;

  // Return
  return (
    <div>
      {/* Plan section */}
      <PlanSection data={currentData} trialData={trialData} />

      <Separator className="my-8" />

      {/* PAYG link */}
      <PaygLinkSection />

      <Separator className="my-8" />

      {/* Invoices section */}
      <InvoiceSection />

      {/* Subscription cancellation section */}
      {showSubscriptionCancellation && (
        <>
          <Separator className="my-8" />
          <CancellationSection onCancel={() => setIsCancelOpen(true)} />
        </>
      )}

      {/* Trial cancellation section */}
      {showTrialCancellation && (
        <>
          <Separator className="my-8" />
          <CancellationSection label="Cancel trial" onCancel={() => setIsTrialCancelOpen(true)} />
        </>
      )}

      {/* Cancel subscription dialog */}
      <CancelDialog
        open={isCancelOpen}
        onOpenChange={setIsCancelOpen}
        subscription={currentData.subscription}
        isPending={cancelMutation.isPending}
        onConfirm={handleCancel}
      />

      {/* Cancel trial dialog */}
      <TrialCancelDialog
        open={isTrialCancelOpen}
        onOpenChange={setIsTrialCancelOpen}
        trial={trialData}
        isPending={cancelTrialMutation.isPending}
        onConfirm={handleCancelTrial}
      />
    </div>
  );
}

/**
 * PAYG message packs link section.
 */
function PaygLinkSection() {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">Message Packs</p>
        <p className="text-xs text-muted-foreground">
          Need more AI messages? Buy pay-as-you-go message packs.
        </p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href="/settings/message-packs">
          View packs
          <ArrowRight className="size-4" />
        </Link>
      </Button>
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
function CancellationSection({ label = 'Cancel plan', onCancel }: { label?: string; onCancel: () => void }) {
  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
        Cancellation
      </h3>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium">{label}</p>
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
