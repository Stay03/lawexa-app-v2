'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, Check, Globe, Loader2, Mail } from 'lucide-react';

import { PageContainer } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorState } from '@/components/common/ErrorState';
import CurrencyPicker from '@/components/payments/CurrencyPicker';
import PlanCard from '@/components/subscriptions/PlanCard';
import type { TPlanAction } from '@/components/subscriptions/PlanCard';
import { usePurchaseMessagePack, useMessagePackPricing } from '@/lib/hooks/useMessagePacks';
import {
  usePlans,
  useCurrentSubscription,
  useSubscribeFree,
  useInitializePayment,
  useInitializeUpgrade,
} from '@/lib/hooks/useSubscriptions';
import { useTrialEligibility, useStartTrial } from '@/lib/hooks/useTrial';
import { useUserCurrency } from '@/lib/hooks/useUserCurrency';
import { useAuthStore } from '@/lib/stores/authStore';
import { extractApiError } from '@/lib/utils/api-error';
import { formatMoneyMajor } from '@/lib/utils/payment-format';
import type { TCurrency } from '@/types/payment';
import type { IPlan, IUpgradeInitData, ICurrentSubscriptionData } from '@/types/subscription';

/******************************************************************************
                               Types
******************************************************************************/

type TInterval = 'daily' | 'monthly' | 'annually';
type TTab = 'plans' | 'payg' | 'enterprise';

interface ITierGroup {
  tierKey: string;
  displayName: string;
  plansByInterval: Partial<Record<TInterval, IPlan>>;
}

/******************************************************************************
                               Constants
******************************************************************************/

const INTERVAL_ORDER: TInterval[] = ['daily', 'monthly', 'annually'];

const TIER_ORDER = ['basic', 'pro', 'plus', 'ai-counsel'];

const TIER_DISPLAY_NAMES: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  'ai-counsel': 'AI Counsel',
};

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Pricing page with category tabs, currency picker, and a
 * tiered plan grid filtered to the user's selected currency.
 */
function PricingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TTab) || 'plans';
  const [activeTab, setActiveTab] = useState<TTab>(initialTab);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [trialPlanId, setTrialPlanId] = useState<number | null>(null);
  const userRole = useAuthStore((s) => s.user?.role);

  // Currency selection (triggers geo detection on first visit)
  const { currency, manualOverride, isDetecting } = useUserCurrency();

  // Data
  const plansQuery = usePlans();
  const currentQuery = useCurrentSubscription();
  const eligibilityQuery = useTrialEligibility();
  // Mutations
  const subscribeFree = useSubscribeFree();
  const initPayment = useInitializePayment();
  const initUpgrade = useInitializeUpgrade();
  const startTrial = useStartTrial();

  const isLoading = plansQuery.isLoading || currentQuery.isLoading;
  const isError = plansQuery.isError || currentQuery.isError;
  const allPlans = plansQuery.data?.data ?? [];
  const currentData = currentQuery.data?.data ?? null;

  /* WHICH CURRENCIES ARE ACTUALLY ON SALE, from what the server sent us.
     The server now decides which plans a visitor sees, and the international
     ones are priced in naira — so a visitor abroad can be sent nine plans and
     not one of them in dollars. Meanwhile geo suggests USD for that same
     visitor, the filter below removes every plan, and the page shows nothing
     to buy. Measured live: 9 plans served, 0 in USD, currency defaulted to USD.
     Derived, never hardcoded, so this holds whatever the server decides next. */
  const sellable = useMemo(() => allPlans.filter((p) => !p.is_free), [allPlans]);
  const availableCurrencies = useMemo(
    () => [...new Set(sellable.map((p) => p.currency))],
    [sellable],
  );
  /* If the chosen currency has nothing behind it, show one that does rather
     than an empty page. Derived, not stored: the reader's own preference is
     left untouched, so it takes effect again the day that currency returns. */
  const effectiveCurrency =
    availableCurrencies.length > 0 && !availableCurrencies.includes(currency)
      ? availableCurrencies[0]
      : currency;

  // Filter plans to the active currency
  const plans = useMemo(
    () => allPlans.filter((p) => p.is_free || p.currency === effectiveCurrency),
    [allPlans, effectiveCurrency]
  );

  // Trial eligibility — only meaningful for NGN (Paystack); USD trials deferred.
  const isTrialAvailable = !!(
    currency === 'NGN' &&
    eligibilityQuery.data?.data?.trial_enabled &&
    eligibilityQuery.data?.data?.user_eligible
  );

  // Derived
  const availableIntervals = useMemo(() => {
    const intervals = getAvailableIntervals(plans);
    if (userRole !== 'superadmin') return intervals.filter((i) => i !== 'daily');
    return intervals;
  }, [plans, userRole]);
  const tierGroups = useMemo(() => groupPlansByTier(plans), [plans]);

  /** Handle plan selection based on the resolved action. */
  const handleSelect = useCallback(
    async (plan: IPlan, action: TPlanAction) => {
      if (action === 'current' || action === 'unavailable') return;
      if (action === 'downgrade') {
        toast.info(
          'To switch to a lower plan, cancel your current subscription first. Once your billing period ends, you can subscribe to the new plan.'
        );
        return;
      }
      if (action === 'cross-currency') {
        toast.info(
          'Cancel your current plan to switch billing currency. Access continues until your current period ends.'
        );
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
          const result = await initUpgrade.mutateAsync({ planId: plan.id, currency: plan.currency });
          const data = result.data;
          if (data && 'authorization_url' in data) {
            // Payment required — redirect to provider checkout
            window.location.href = (data as IUpgradeInitData).authorization_url;
          } else {
            // Proration covered the cost — upgrade complete
            toast.success(result.message || 'Plan upgraded successfully!');
            router.push('/settings/billing');
          }
        } else {
          // New subscription (from free tier or no subscription)
          const result = await initPayment.mutateAsync({ planId: plan.id, currency: plan.currency });
          if (result.data?.authorization_url) {
            window.location.href = result.data.authorization_url;
          }
        }
      } catch (err) {
        const apiError = extractApiError(err);
        toast.error(apiError.message);
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

      {/* Tabs + currency picker row */}
      <div className="flex flex-wrap items-center justify-center gap-3">
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
        {activeTab !== 'enterprise' && (
          <CurrencyPicker
            currency={effectiveCurrency}
            available={availableCurrencies}
            isDetecting={isDetecting}
            manualOverride={manualOverride}
          />
        )}
      </div>

      {/* Tab content */}
      {activeTab === 'plans' && (
        <PersonalTabContent
          currentData={currentData}
          tierGroups={tierGroups}
          availableIntervals={availableIntervals}
          activePlanId={activePlanId}
          onSelect={handleSelect}
          trialAvailable={isTrialAvailable}
          trialPlanId={trialPlanId}
          onStartTrial={handleStartTrial}
          currency={currency}
        />
      )}

      {activeTab === 'payg' && <PackTabContent currency={effectiveCurrency} />}

      {activeTab === 'enterprise' && <EnterpriseTabContent />}
    </PageContainer>
  );
}

/**
 * Personal tab — plan cards with in-card interval toggles.
 */
function PersonalTabContent(props: {
  currentData: ICurrentSubscriptionData | null;
  tierGroups: ITierGroup[];
  availableIntervals: TInterval[];
  activePlanId: number | null;
  onSelect: (plan: IPlan, action: TPlanAction) => void;
  trialAvailable: boolean;
  trialPlanId: number | null;
  onStartTrial: (plan: IPlan) => void;
  currency: TCurrency;
}) {
  const {
    currentData, tierGroups, availableIntervals,
    activePlanId, onSelect, trialAvailable, trialPlanId, onStartTrial, currency,
  } = props;

  // Cross-currency notice — surface when the user is currently paying in
  // another currency than the one they're browsing.
  const showCrossCurrencyNotice =
    currentData?.subscription &&
    !currentData.is_free_tier &&
    currentData.subscription.currency !== currency &&
    currentData.subscription.has_access;

  // No plans for this currency (e.g., FW kill switch on while USD selected)
  if (tierGroups.length === 0) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Globe className="size-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">No {currency} plans available</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Plans in {currency} aren&apos;t available right now. Try switching currency above
            or check back soon.
          </p>
        </CardContent>
      </Card>
    );
  }

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

      {/* Cross-currency notice */}
      {showCrossCurrencyNotice && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800/50 dark:bg-blue-950/30 dark:text-blue-200">
          You&apos;re currently billed in {currentData!.subscription!.currency}. To switch to
          {' '}{currency} pricing, cancel your current plan first — access continues until your
          period ends.
        </div>
      )}

      {/* Plan grid */}
      <div className="flex flex-wrap justify-center gap-6">
        {tierGroups.map((group) => {
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
 * Pack tab — PAYG message pack purchase card. Pricing pulled from backend per
 * currency; the frontend never hardcodes pack prices.
 */
function PackTabContent({ currency }: { currency: TCurrency }) {
  const MAX_QUANTITY = 10;
  const [quantity, setQuantity] = useState(1);
  const pricingQuery = useMessagePackPricing(currency);
  const purchaseMutation = usePurchaseMessagePack();

  /* Same rule as the plans grid above: follow what is actually priced. Packs
     are naira on both sides of the border now, so a visitor whose currency
     resolves to USD would otherwise be told packs are unavailable when they
     are simply not sold in dollars. Fall back to a currency that has a price
     rather than showing a dead end. */
  const priceRows = pricingQuery.data?.data?.prices ?? [];
  const priceRow =
    priceRows.find((p) => p.currency === currency) ?? priceRows[0] ?? undefined;
  const messagesPerPack = pricingQuery.data?.data?.messages_per_pack ?? 10;
  const totalMessages = quantity * messagesPerPack;

  const handlePurchase = () => {
    purchaseMutation.mutate(
      { quantity, currency },
      {
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
      }
    );
  };

  // Pricing not yet loaded
  if (pricingQuery.isLoading) {
    return (
      <div className="flex justify-center">
        <div className="min-w-[240px] max-w-[380px] w-full space-y-4 rounded-2xl border p-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-9 w-full rounded-full" />
        </div>
      </div>
    );
  }

  // Pricing missing for currency (e.g., USD pricing not seeded yet)
  if (!priceRow) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Globe className="size-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Pay-as-you-go in {currency} unavailable</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Try switching currency above or check back soon.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalPrice = priceRow.price_major * quantity;

  return (
    <div className="flex justify-center">
      <div className="min-w-[240px] max-w-[380px]">
        <Card className="flex h-full flex-col">
          <CardHeader>
            <CardTitle className="text-lg">Pay As You Go</CardTitle>
            <p className="text-sm text-muted-foreground">One-time purchase</p>
          </CardHeader>

          <CardContent className="flex-1 space-y-6">
            {/* Price */}
            <div>
              <div className="text-3xl font-bold">
                from {formatMoneyMajor(priceRow.price_major, currency)}
              </div>
            </div>

            {/* Features */}
            <ul className="space-y-2.5">
              {[
                `${messagesPerPack} AI messages per pack`,
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
                    {n} {n === 1 ? 'pack' : 'packs'} — {n * messagesPerPack} messages
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
                `Buy ${formatMoneyMajor(totalPrice, currency)}`
              )}
            </Button>
            {totalMessages > 0 && (
              <p className="text-center text-xs text-muted-foreground">
                {totalMessages} messages total
              </p>
            )}
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

/**
 * Derive the tier key from a plan. Uses `slug_base` (currency-agnostic) so the
 * NGN and USD variants of the same logical plan share a key.
 */
function getTierKey(plan: IPlan): string {
  /**
   * Remove the INTERVAL segment, wherever it sits — not the last one.
   *
   * This took the last segment on the assumption that a slug reads
   * "{tier}-{interval}". That held while every slug was "pro-monthly". It
   * broke the night the international plans arrived: `slug_base` strips only a
   * trailing `-usd`, so "basic-monthly-international" kept its last segment as
   * "international". Stripping it left "basic-monthly", its annual twin became
   * "basic-annually", and the two never grouped — eight cards for four
   * products, each with a term switch that could not work, live to every
   * visitor abroad.
   *
   * The plan tells us its own interval, so nothing here has to guess which
   * segment that is. Position is an assumption; `plan.interval` is a fact.
   */
  const base = plan.slug_base ?? plan.slug;
  const interval = String(plan.interval ?? '').toLowerCase();
  const parts = base.split('-').filter((part) => part.length > 0);
  const withoutInterval = interval
    ? parts.filter((part) => part.toLowerCase() !== interval)
    : parts.slice(0, -1);
  /* Guard: if removing the interval removed everything — an unexpected slug —
     fall back to the old behaviour rather than returning an empty key that
     would collapse every plan into one card. */
  return withoutInterval.length > 0
    ? withoutInterval.join('-')
    : parts.slice(0, -1).join('-');
}

/**
 * The tier a key refers to, with the audience taken off.
 *
 * "International" says who a plan is FOR, not what it is. A visitor abroad is
 * shown only international plans, so the word distinguishes nothing on their
 * screen. It must come off in ONE place, because two things depend on it: the
 * label a card shows, and where that card sits in the row. Strip it for the
 * label alone and TIER_ORDER stops recognising the key, every foreign tier
 * scores -1, and four correctly grouped cards appear in arbitrary order.
 */
function baseTierKey(tierKey: string): string {
  const stripped = tierKey
    .split('-')
    .filter((part) => part.toLowerCase() !== 'international')
    .join('-');
  return stripped || tierKey;
}

/** Convert a tier key to a display name. */
function getTierDisplayName(tierKey: string): string {
  if (TIER_DISPLAY_NAMES[tierKey]) return TIER_DISPLAY_NAMES[tierKey];
  const base = baseTierKey(tierKey);
  if (TIER_DISPLAY_NAMES[base]) return TIER_DISPLAY_NAMES[base];
  return base
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Group plans into tiers, each with their interval variants. */
function groupPlansByTier(plans: IPlan[]): ITierGroup[] {
  const tierMap = new Map<string, ITierGroup>();

  for (const plan of plans) {
    if (plan.is_free) continue;
    const key = getTierKey(plan);
    if (!tierMap.has(key)) {
      tierMap.set(key, {
        tierKey: key,
        displayName: getTierDisplayName(key),
        plansByInterval: {},
      });
    }
    const group = tierMap.get(key)!;
    group.plansByInterval[plan.interval as TInterval] = plan;
  }

  return Array.from(tierMap.values()).sort((a, b) => {
    /* Ordered on the BASE key, so an international tier sits where its local
       twin would. Ordering on the raw key scores every foreign tier -1. */
    const ai = TIER_ORDER.indexOf(baseTierKey(a.tierKey));
    const bi = TIER_ORDER.indexOf(baseTierKey(b.tierKey));
    return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
  });
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

export default function PricingPageWrapper() {
  return (
    <Suspense fallback={
      <PageContainer className="max-w-6xl">
        <PricingHeader />
        <PricingGridSkeleton />
      </PageContainer>
    }>
      <PricingPage />
    </Suspense>
  );
}
