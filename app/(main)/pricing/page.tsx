'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { PageContainer } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import PlanCard from '@/components/subscriptions/PlanCard';
import type { TPlanAction } from '@/components/subscriptions/PlanCard';
import type { IPlan, IUpgradeInitData } from '@/types/subscription';
import {
  usePlans,
  useCurrentSubscription,
  useSubscribeFree,
  useInitializePayment,
  useInitializeUpgrade,
} from '@/lib/hooks/useSubscriptions';

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Pricing page with plan selection grid.
 */
function PricingPage() {
  const router = useRouter();
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  // Data
  const plansQuery = usePlans();
  const currentQuery = useCurrentSubscription();
  // Mutations
  const subscribeFree = useSubscribeFree();
  const initPayment = useInitializePayment();
  const initUpgrade = useInitializeUpgrade();

  const isLoading = plansQuery.isLoading || currentQuery.isLoading;
  const isError = plansQuery.isError || currentQuery.isError;
  const plans = plansQuery.data?.data ?? [];
  const currentData = currentQuery.data?.data ?? null;

  /** Handle plan selection based on the resolved action. */
  const handleSelect = useCallback(
    async (plan: IPlan, action: TPlanAction) => {
      if (action === 'current' || action === 'downgrade' || action === 'unavailable') {
        if (action === 'downgrade') {
          toast.info(
            'To switch to a lower plan, cancel your current subscription first. Once your billing period ends, you can subscribe to the new plan.'
          );
        }
        return;
      }
      setActivePlanId(plan.id);
      try {
        if (plan.is_free) {
          // Free plan subscription
          const result = await subscribeFree.mutateAsync(plan.id);
          toast.success(result.message || 'Subscribed to free plan!');
          router.push('/settings/billing');
        } else if (action === 'upgrade') {
          // Upgrade from a paid plan
          const result = await initUpgrade.mutateAsync(plan.id);
          const data = result.data;
          if (data && 'authorization_url' in data) {
            // Payment required — redirect to Paystack
            window.location.href = (data as IUpgradeInitData).authorization_url;
          } else {
            // Proration covered the cost — upgrade complete
            toast.success(result.message || 'Plan upgraded successfully!');
            router.push('/settings/billing');
          }
        } else {
          // New subscription (from free tier or no subscription)
          const result = await initPayment.mutateAsync(plan.id);
          if (result.data?.authorization_url) {
            window.location.href = result.data.authorization_url;
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong. Please try again.';
        toast.error(message);
      } finally {
        setActivePlanId(null);
      }
    },
    [subscribeFree, initPayment, initUpgrade, router]
  );

  // Loading state
  if (isLoading) {
    return (
      <PageContainer className="max-w-5xl">
        <PricingHeader />
        <PricingGridSkeleton />
      </PageContainer>
    );
  }

  // Error state
  if (isError) {
    return (
      <PageContainer className="max-w-5xl">
        <PricingHeader />
        <ErrorState
          title="Failed to load plans"
          description="We couldn't load the available plans. Please try again."
          retry={() => {
            plansQuery.refetch();
            currentQuery.refetch();
          }}
        />
      </PageContainer>
    );
  }

  // Return
  return (
    <PageContainer className="max-w-5xl">
      <PricingHeader />
      {/* Cancelled subscription notice */}
      {currentData?.subscription?.status === 'cancelled' && currentData.subscription.has_access && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
          Your current plan is cancelled. Access continues until{' '}
          {new Date(currentData.subscription.ends_at!).toLocaleDateString()}.
          You can subscribe to a new plan after that date.
        </div>
      )}
      {/* Plan grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            currentData={currentData}
            isLoading={activePlanId === plan.id}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </PageContainer>
  );
}

/**
 * Page header for the pricing page.
 */
function PricingHeader() {
  return (
    <div className="text-center space-y-2">
      <h1 className="text-3xl font-bold tracking-tight">Choose Your Plan</h1>
      <p className="text-muted-foreground max-w-lg mx-auto">
        Select the plan that works best for you. Upgrade or downgrade at any time.
      </p>
    </div>
  );
}

/**
 * Skeleton loader for the pricing grid.
 */
function PricingGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-4 rounded-2xl border p-6">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="h-9 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default PricingPage;
