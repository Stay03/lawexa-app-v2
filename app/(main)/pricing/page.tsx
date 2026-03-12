'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, Check, Loader2, Mail } from 'lucide-react';

import { PageContainer } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/common/ErrorState';
import PlanCard from '@/components/subscriptions/PlanCard';
import type { TPlanAction } from '@/components/subscriptions/PlanCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePurchaseMessagePack } from '@/lib/hooks/useMessagePacks';
import { extractApiError } from '@/lib/utils/api-error';
import type { IPlan, IUpgradeInitData, ICurrentSubscriptionData } from '@/types/subscription';
import {
  usePlans,
  useCurrentSubscription,
  useSubscribeFree,
  useInitializePayment,
  useInitializeUpgrade,
} from '@/lib/hooks/useSubscriptions';
import { useTrialEligibility, useStartTrial } from '@/lib/hooks/useTrial';

/******************************************************************************
                               Types
******************************************************************************/

type TInterval = 'daily' | 'monthly' | 'annually';
type TTab = 'plans' | 'payg' | 'enterprise';

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

const TIER_ORDER = ['basic', 'pro', 'ai-counsel'];

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
 * Default component. Pricing page with category tabs and tiered plan grid.
 */
function PricingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TTab>('plans');
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [trialPlanId, setTrialPlanId] = useState<number | null>(null);

  // Data
  const plansQuery = usePlans();
  const currentQuery = useCurrentSubscription();
  const eligibilityQuery = useTrialEligibility();
  // Mutations
  const subscribeFree = useSubscribeFree();
  const initPayment = useInitializePayment();
  const initUpgrade = useInitializeUpgrade();
  const startTrial = useStartTrial();

  // Trial eligibility (graceful — does not block page render)
  const isTrialAvailable = !!(
    eligibilityQuery.data?.data?.trial_enabled &&
    eligibilityQuery.data?.data?.user_eligible
  );

  const isLoading = plansQuery.isLoading || currentQuery.isLoading;
  const isError = plansQuery.isError || currentQuery.isError;
  const plans = plansQuery.data?.data ?? [];
  const currentData = currentQuery.data?.data ?? null;

  // Derived data
  const availableIntervals = useMemo(() => getAvailableIntervals(plans), [plans]);
  const tierGroups = useMemo(() => groupPlansByTier(plans), [plans]);
  const paidTierGroups = tierGroups.filter((g) => g.tierKey !== 'free');

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

  /** Handle "Start Free Trial" click on a plan card. */
  const handleStartTrial = useCallback(
    async (plan: IPlan) => {
      setTrialPlanId(plan.id);
      try {
        const result = await startTrial.mutateAsync(plan.id);
        if (result.data?.authorization_url) {
          window.location.href = result.data.authorization_url;
        }
      } catch (err) {
        const apiError = extractApiError(err);
        toast.error(apiError.message);
      } finally {
        setTrialPlanId(null);
      }
    },
    [startTrial]
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

      {/* Main category tabs */}
      <div className="flex justify-center">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TTab)}
        >
          <TabsList>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="payg">Pay as you go</TabsTrigger>
            <TabsTrigger value="enterprise">Enterprise</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab content */}
      {activeTab === 'plans' && (
        <PersonalTabContent
          currentData={currentData}
          paidTierGroups={paidTierGroups}
          availableIntervals={availableIntervals}
          activePlanId={activePlanId}
          onSelect={handleSelect}
          trialAvailable={isTrialAvailable}
          trialPlanId={trialPlanId}
          onStartTrial={handleStartTrial}
        />
      )}

      {activeTab === 'payg' && <PackTabContent />}

      {activeTab === 'enterprise' && <EnterpriseTabContent />}
    </PageContainer>
  );
}

/**
 * Personal tab — plan cards with in-card interval toggles.
 */
function PersonalTabContent(props: {
  currentData: ICurrentSubscriptionData | null;
  paidTierGroups: ITierGroup[];
  availableIntervals: TInterval[];
  activePlanId: number | null;
  onSelect: (plan: IPlan, action: TPlanAction) => void;
  trialAvailable: boolean;
  trialPlanId: number | null;
  onStartTrial: (plan: IPlan) => void;
}) {
  const {
    currentData, paidTierGroups, availableIntervals,
    activePlanId, onSelect, trialAvailable, trialPlanId, onStartTrial,
  } = props;

  return (
    <div className="space-y-6">
      {/* Cancelled subscription notice */}
      {currentData?.subscription?.status === 'cancelled' && currentData.subscription.has_access && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
          Your current plan is cancelled. Access continues until{' '}
          {new Date(currentData.subscription.ends_at!).toLocaleDateString()}.
          You can subscribe to a new plan after that date.
        </div>
      )}

      {/* Plan grid */}
      <div className="flex flex-wrap justify-center gap-6">
        {paidTierGroups.map((group) => {
          // Use the first available plan as the base plan for the card
          const basePlan = group.plansByInterval.monthly
            ?? group.plansByInterval[availableIntervals[0]]
            ?? Object.values(group.plansByInterval)[0];
          if (!basePlan) return null;
          return (
            <div key={group.tierKey} className="flex-1 min-w-[240px] max-w-[340px]">
              <PlanCard
                plan={basePlan}
                displayName={group.displayName}
                allIntervalPlans={group.plansByInterval}
                availableIntervals={availableIntervals}
                currentData={currentData}
                loadingPlanId={activePlanId}
                onSelect={onSelect}
                trialEligible={trialAvailable}
                trialLoadingPlanId={trialPlanId}
                onStartTrial={onStartTrial}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Pack tab — PAYG message pack purchase card.
 */
function PackTabContent() {
  const PRICE_PER_PACK = 2000;
  const MESSAGES_PER_PACK = 10;
  const MAX_QUANTITY = 10;

  const [quantity, setQuantity] = useState(1);
  const purchaseMutation = usePurchaseMessagePack();

  const totalPrice = quantity * PRICE_PER_PACK;
  const totalMessages = quantity * MESSAGES_PER_PACK;

  const handlePurchase = () => {
    purchaseMutation.mutate(quantity, {
      onSuccess: (data) => {
        if (data.success && data.data) {
          sessionStorage.setItem('payg_reference', data.data.reference);
          window.location.href = data.data.authorization_url;
        }
      },
      onError: (err) => {
        const apiError = extractApiError(err);
        toast.error(apiError.message);
      },
    });
  };

  return (
    <div className="flex justify-center">
      <div className="min-w-[240px] max-w-[340px]">
        <Card className="flex h-full flex-col">
          <CardHeader>
            <CardTitle className="text-lg">Pay As You Go</CardTitle>
            <p className="text-sm text-muted-foreground">One-time purchase</p>
          </CardHeader>

          <CardContent className="flex-1 space-y-6">
            {/* Price */}
            <div>
              <div className="text-3xl font-bold">
                from ₦{PRICE_PER_PACK.toLocaleString()}
              </div>
            </div>

            {/* Features */}
            <ul className="space-y-2.5">
              {[
                `${MESSAGES_PER_PACK} AI messages per pack`,
                'Messages never expire',
                'Used after plan messages run out',
                'Buy more anytime',
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="size-4 shrink-0 text-primary mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {/* Quantity selector */}
            <Select
              value={String(quantity)}
              onValueChange={(v) => setQuantity(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: MAX_QUANTITY }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} {n === 1 ? 'pack' : 'packs'} — {n * MESSAGES_PER_PACK} messages
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Buy button */}
            <Button
              className="w-full"
              disabled={purchaseMutation.isPending}
              onClick={handlePurchase}
            >
              {purchaseMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Buy - ₦${totalPrice.toLocaleString()}`
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Enterprise tab — contact for custom plans.
 */
function EnterpriseTabContent() {
  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="size-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Enterprise</CardTitle>
          <p className="text-sm text-muted-foreground">
            Custom plans tailored to your organization&apos;s needs.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">-</span>
              <span>Custom user seats and message limits</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">-</span>
              <span>Dedicated support and onboarding</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">-</span>
              <span>Priority access to new features</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">-</span>
              <span>Custom integrations and API access</span>
            </li>
          </ul>
          <Button className="w-full" asChild>
            <a href="mailto:enterprise@lawexa.com">
              <Mail className="size-4" />
              Contact Sales
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
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
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex-1 min-w-[240px] max-w-[340px] space-y-4 rounded-2xl border p-6">
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

  // Free first, then paid tiers in explicit order
  const groups = Array.from(tierMap.values());
  const freeGroup = groups.find((g) => g.tierKey === 'free');
  const paidGroups = groups
    .filter((g) => g.tierKey !== 'free')
    .sort((a, b) => {
      const ai = TIER_ORDER.indexOf(a.tierKey);
      const bi = TIER_ORDER.indexOf(b.tierKey);
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
    });
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

/******************************************************************************
                               Export default
******************************************************************************/

export default PricingPage;
