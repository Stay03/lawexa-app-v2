'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { PageContainer } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
                               Types
******************************************************************************/

type TInterval = 'daily' | 'monthly' | 'annually';

interface ITierGroup {
  tierKey: string;
  displayName: string;
  plansByInterval: Partial<Record<TInterval, IPlan>>;
  freePlan?: IPlan;
}

/******************************************************************************
                               Constants
******************************************************************************/

const INTERVAL_ORDER: TInterval[] = ['daily', 'monthly', 'annually'];

const INTERVAL_LABELS: Record<TInterval, string> = {
  daily: 'Daily',
  monthly: 'Monthly',
  annually: 'Annually',
};

const TIER_DISPLAY_NAMES: Record<string, string> = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
  'ai-counsel': 'AI Counsel',
};

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Pricing page with interval toggle and tiered plan grid.
 */
function PricingPage() {
  const router = useRouter();
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<TInterval>('monthly');

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

  // Derived data
  const availableIntervals = useMemo(() => getAvailableIntervals(plans), [plans]);
  const tierGroups = useMemo(() => groupPlansByTier(plans), [plans]);
  const freeTierGroup = tierGroups.find((g) => g.tierKey === 'free') ?? null;
  const paidTierGroups = tierGroups.filter((g) => g.tierKey !== 'free');

  // Fall back to first available interval if selected isn't available
  const effectiveInterval: TInterval = availableIntervals.includes(selectedInterval)
    ? selectedInterval
    : availableIntervals[0] ?? 'monthly';

  // Best savings % across all tiers (for the "Save X%" badge on annual tab)
  const annualSavings = useMemo(
    () =>
      paidTierGroups.reduce((best, group) => {
        const s = calcSavingsPercent(group.plansByInterval.monthly, group.plansByInterval.annually);
        return Math.max(best, s);
      }, 0),
    [paidTierGroups]
  );

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
      <PageContainer className="max-w-6xl">
        <PricingHeader />
        <div className="flex justify-center">
          <Skeleton className="h-10 w-72 rounded-lg" />
        </div>
        <PricingGridSkeleton />
      </PageContainer>
    );
  }

  // Error state
  if (isError) {
    return (
      <PageContainer className="max-w-6xl">
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

  return (
    <PageContainer className="max-w-6xl">
      <PricingHeader />

      {/* Cancelled subscription notice */}
      {currentData?.subscription?.status === 'cancelled' && currentData.subscription.has_access && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
          Your current plan is cancelled. Access continues until{' '}
          {new Date(currentData.subscription.ends_at!).toLocaleDateString()}.
          You can subscribe to a new plan after that date.
        </div>
      )}

      {/* Billing interval toggle */}
      {availableIntervals.length > 1 && (
        <div className="flex justify-center">
          <Tabs
            value={effectiveInterval}
            onValueChange={(v) => setSelectedInterval(v as TInterval)}
          >
            <TabsList>
              {availableIntervals.map((interval) => (
                <TabsTrigger key={interval} value={interval} className="gap-1.5">
                  {INTERVAL_LABELS[interval]}
                  {interval === 'annually' && annualSavings > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 font-semibold text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/50"
                    >
                      Save {annualSavings}%
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Plan grid — one column per tier, centered */}
      <div className="flex flex-wrap justify-center gap-6">
        {/* Free tier — always visible */}
        {freeTierGroup?.freePlan && (
          <div className="w-full max-w-[300px]">
            <PlanCard
              key={freeTierGroup.freePlan.id}
              plan={freeTierGroup.freePlan}
              displayName="Free"
              currentData={currentData}
              isLoading={activePlanId === freeTierGroup.freePlan.id}
              onSelect={handleSelect}
            />
          </div>
        )}

        {/* Paid tiers — filtered by selected interval */}
        {paidTierGroups.map((group) => {
          const plan = group.plansByInterval[effectiveInterval];
          if (!plan) return null;
          return (
            <div key={plan.id} className="w-full max-w-[300px]">
              <PlanCard
                plan={plan}
                displayName={group.displayName}
                currentData={currentData}
                isLoading={activePlanId === plan.id}
                onSelect={handleSelect}
              />
            </div>
          );
        })}
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
    <div className="flex flex-wrap justify-center gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="w-full max-w-[300px] space-y-4 rounded-2xl border p-6">
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
                               Functions
******************************************************************************/

/** Derive the tier key from a plan slug. Free plans always return 'free'. */
function getTierKey(plan: IPlan): string {
  if (plan.is_free) return 'free';
  // Slug pattern: "{tier}-{interval}" e.g. "basic-monthly", "ai-counsel-annually"
  const parts = plan.slug.split('-');
  // Last segment is the interval — everything before is the tier
  return parts.slice(0, -1).join('-');
}

/** Convert a tier key to a display name. */
function getTierDisplayName(tierKey: string): string {
  if (TIER_DISPLAY_NAMES[tierKey]) return TIER_DISPLAY_NAMES[tierKey];
  return tierKey
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Group plans into tiers, each with their interval variants. */
function groupPlansByTier(plans: IPlan[]): ITierGroup[] {
  const tierMap = new Map<string, ITierGroup>();

  for (const plan of plans) {
    const key = getTierKey(plan);
    if (!tierMap.has(key)) {
      tierMap.set(key, {
        tierKey: key,
        displayName: getTierDisplayName(key),
        plansByInterval: {},
      });
    }
    const group = tierMap.get(key)!;
    if (plan.is_free) {
      group.freePlan = plan;
    } else {
      group.plansByInterval[plan.interval as TInterval] = plan;
    }
  }

  // Free first, then paid tiers in order of appearance
  const groups = Array.from(tierMap.values());
  const freeGroup = groups.find((g) => g.tierKey === 'free');
  const paidGroups = groups.filter((g) => g.tierKey !== 'free');
  return freeGroup ? [freeGroup, ...paidGroups] : paidGroups;
}

/** Get available billing intervals from paid plans, in preferred order. */
function getAvailableIntervals(plans: IPlan[]): TInterval[] {
  const seen = new Set<string>();
  for (const plan of plans) {
    if (!plan.is_free) seen.add(plan.interval);
  }
  return INTERVAL_ORDER.filter((i) => seen.has(i));
}

/** Calculate savings % for annual vs monthly billing. Returns 0 if not calculable. */
function calcSavingsPercent(
  monthlyPlan: IPlan | undefined,
  annualPlan: IPlan | undefined
): number {
  if (!monthlyPlan || !annualPlan) return 0;
  const monthlyYearly = parseFloat(monthlyPlan.amount) * 12;
  const annual = parseFloat(annualPlan.amount);
  if (monthlyYearly <= 0) return 0;
  return Math.round(((monthlyYearly - annual) / monthlyYearly) * 100);
}

/******************************************************************************
                               Export default
******************************************************************************/

export default PricingPage;
