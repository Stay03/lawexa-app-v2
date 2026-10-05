'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Crown, Globe, MessageSquarePlus, RotateCw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import type { TCurrency } from '@/types/payment';
import type { IPlan } from '@/types/subscription';
import { billingQueries } from '@/v2/features/settings/billing/queries';
import { currencyName, offerFrom } from '@/v2/features/settings/message-packs/currency-offer';
import { messagePacksQueries } from '@/v2/features/settings/message-packs/queries';
import { SettingsState } from '@/v2/features/settings/SettingsState';
import { setCurrency, useCurrency } from '@/v2/runtime/currency';
import { replaceUrlParams } from '@/v2/runtime/url-params';
import { useV2Session } from '@/v2/runtime/session-context';
import { TabRow } from '@/v2/shell/TabRow';
import { EnterprisePanel } from './EnterprisePanel';
import {
  PERIOD_LABEL,
  PRICING_TABS,
  REGISTER_HREF,
  SIGN_IN_HREF,
  accountNotices,
  buildTiers,
  currenciesOnSale,
  defaultPeriod,
  isCurrentTier,
  parsePricingTab,
  periodsOnSale,
  planAction,
  planFor,
  pricingTabParam,
  recommendedTierKey,
  savingHint,
  tierSaving,
  type Period,
  type PlanAction,
  type PricingTab,
} from './model';
import { PayAsYouGoPanel } from './PayAsYouGoPanel';
import { PlanCard } from './PlanCard';
import { pricingQueries, useCheckout, useStartTrial } from './queries';
import { SegmentedChoice } from './SegmentedChoice';
import { PRICING_COLUMN, PacksFallback, PlansFallback, PricingFallback } from './states';
import { TrialDialog } from './TrialDialog';
import './pricing.css';

/**
 * PricingScreen — v2 `/pricing`, which v1's `/upgrade` also lands on. One
 * page titled Pricing with v1's three tabs: Plans (one card per tier, the
 * period switch, the currency switch when there is a choice), Pay as you go
 * (message packs) and Enterprise (how an organisation asks for a plan).
 *
 * ── THE TAB IS THE URL ─────────────────────────────────────────────────────
 * `?tab=plans|payg|enterprise`, the values v1 used, so a v1 link opens the
 * same tab here. Plans is the bare URL; anything unknown reads as Plans
 * (`parsePricingTab`). The tab is written with `replaceUrlParams`, the v2
 * write path that keeps the switch on the client.
 *
 * ── THE MONEY FLOW IS v1's ─────────────────────────────────────────────────
 * A plan card starts the same call v1 started with the same arguments
 * (`queries.ts`): a new plan or an upgrade goes to the address the server
 * returns, an upgrade the credit already covers is confirmed and opens
 * Billing, and a trial opens Paystack's card check. A pack is bought with the
 * call Settings' Buy panel makes (`usePurchasePacks`). The provider returns
 * the buyer to the callbacks v2 already claims.
 *
 * ── WHAT THE PAGE SAYS ─────────────────────────────────────────────────────
 * A plan card lists v1's benefit lines for its tier, word for word, from the
 * table v1 and v2 share (`lib/constants/plan-features.ts`); one tier is
 * recommended (`RECOMMENDED_TIER_KEY`). The Pay as you go and Enterprise tabs
 * carry v1's words for those tabs (`model.ts`).
 *
 * ── WHO SEES WHAT ──────────────────────────────────────────────────────────
 * Signed out: `/subscriptions/plans` and `/message-packs/pricing` answer 401
 * without a session, so Plans and Pay as you go offer sign-in and
 * registration, each returning here; Enterprise needs no session and shows in
 * full. A guest has a device session and sees the plans and the pack price,
 * but buys on an account, so a card offers registration and the pack panel
 * offers sign-in where Buy would be. An account sees its own plan marked and
 * the buttons v1's rules allow.
 */
export function PricingScreen() {
  return (
    <Suspense fallback={<PricingFallback />}>
      <PricingPage />
    </Suspense>
  );
}

const PANEL_ID = 'pricing-panel';

function PricingPage() {
  const { signedIn, role } = useV2Session();
  const searchParams = useSearchParams();
  const tab = parsePricingTab(searchParams.get('tab'));
  const viewer = !signedIn ? null : role === 'guest' ? 'guest' : 'account';

  return (
    <div className={cn(PRICING_COLUMN, 'v2-pricing @container/pricing')}>
      <h1 className="pricing-title text-foreground">Pricing</h1>

      <PricingTabs value={tab} onChange={(next) => replaceUrlParams({ tab: pricingTabParam(next) })} />

      <div
        key={tab}
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={`${PANEL_ID}-tab-${tab}`}
        className="pt-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      >
        {tab === 'plans' ? (
          viewer ? (
            <Plans viewer={viewer} offersDaily={role === 'superadmin'} />
          ) : (
            <SignedOut
              title="Sign in to see plans"
              description="The plans and prices on offer depend on your account, so they show once you sign in."
            />
          )
        ) : null}
        {tab === 'payg' ? (
          viewer ? (
            <Packs viewer={viewer} />
          ) : (
            <SignedOut
              title="Sign in to buy message packs"
              description="Message packs are bought on an account, and their price shows once you sign in."
            />
          )
        ) : null}
        {tab === 'enterprise' ? <EnterprisePanel /> : null}
      </div>
    </div>
  );
}

/**
 * The page's sections as text tabs on a rule: section navigation, drawn
 * differently from the pill switches inside a section (period, currency) so
 * the two levels never read as the same control. The shared `TabRow` owns the
 * keyboard and aria contract.
 */
function PricingTabs({ value, onChange }: { value: PricingTab; onChange: (next: PricingTab) => void }) {
  return (
    <TabRow
      tabs={PRICING_TABS}
      value={value}
      onChange={onChange}
      ariaLabel="Pricing"
      panelId={PANEL_ID}
      className="mt-5 flex max-w-full gap-6 overflow-x-auto overscroll-x-contain border-b border-foreground/10 sm:gap-8"
      tabClassName={(selected) =>
        cn(
          'v2-interactive relative -mb-px min-h-11 shrink-0 border-b-2 px-0.5 text-[15px] font-medium transition-colors duration-150 motion-reduce:transition-none',
          selected
            ? 'border-primary text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground',
        )
      }
    >
      {(item) => item.label}
    </TabRow>
  );
}

function Plans({ viewer, offersDaily }: { viewer: 'account' | 'guest'; offersDaily: boolean }) {
  const router = useRouter();
  const isAccount = viewer === 'account';
  const plans = useQuery(pricingQueries.plans());
  const current = useQuery({ ...billingQueries.current(), enabled: isAccount });
  const { currency: storedCurrency } = useCurrency();
  const { offered, currency } = offerFrom(plans.data ? currenciesOnSale(plans.data) : [], storedCurrency);
  // Trials are Paystack's, so v1 only ever offered them in Naira.
  const asksTrial = isAccount && plans.isSuccess && currency === 'NGN';
  const eligibility = useQuery(pricingQueries.trialEligibility(asksTrial));
  const checkout = useCheckout();
  const trial = useStartTrial();
  const [chosenPeriod, setChosenPeriod] = useState<Period | null>(null);
  const [trialDialogOpen, setTrialDialogOpen] = useState(false);
  const [trialPlan, setTrialPlan] = useState<IPlan | null>(null);

  // Busy from the press until the browser leaves for the provider.
  const checkoutLeaving = checkout.isPending || (checkout.isSuccess && checkout.data.kind === 'checkout');
  const trialLeaving = trial.isPending || (trial.isSuccess && trial.data !== null);
  const busyPlanId = checkoutLeaving
    ? (checkout.variables?.plan.id ?? null)
    : trialLeaving
      ? (trial.variables?.id ?? null)
      : null;

  if (plans.isPending || (isAccount && current.isPending) || (asksTrial && eligibility.isPending)) {
    return <PlansFallback />;
  }

  if (plans.isError || current.isError) {
    const retrying = plans.isFetching || current.isFetching;
    return (
      <SettingsState
        icon={TriangleAlert}
        tone="alarm"
        title="The plans did not load"
        description="Check your connection and try again."
        action={
          <Button
            size="sm"
            variant="outline"
            disabled={retrying}
            onClick={() => {
              void plans.refetch();
              if (isAccount) void current.refetch();
            }}
          >
            <RotateCw aria-hidden className={cn('size-4', retrying && 'animate-spin')} />
            Try again
          </Button>
        }
      />
    );
  }

  const account = isAccount ? (current.data ?? null) : null;
  const tiers = buildTiers(plans.data, currency);
  const periods = periodsOnSale(tiers, offersDaily);
  const period = chosenPeriod && periods.includes(chosenPeriod) ? chosenPeriod : defaultPeriod(periods);
  const cards = tiers.flatMap((tier) => {
    const plan = planFor(tier, period, periods);
    return plan ? [{ tier, plan }] : [];
  });
  const notices = accountNotices(account, currency);
  const trialOffered = asksTrial && !!eligibility.data?.trial_enabled && !!eligibility.data.user_eligible;
  const yearlyHint = savingHint(tiers);
  const recommended = recommendedTierKey(tiers);

  const choose = (plan: IPlan, action: PlanAction) => {
    if (busyPlanId !== null) return;
    checkout.mutate(
      { plan, upgrade: action === 'upgrade' },
      {
        onSuccess: (outcome) => {
          if (outcome.kind === 'checkout') {
            window.location.assign(outcome.url);
          } else if (outcome.kind === 'upgraded') {
            toast.success(outcome.message || 'Your plan is upgraded.');
            router.push('/settings/billing');
          } else {
            toast.error("The payment page didn't open. Try again.");
          }
        },
        onError: (error) => {
          toast.error(extractApiError(error).message);
        },
      },
    );
  };

  const confirmTrial = () => {
    if (!trialPlan || busyPlanId !== null) return;
    trial.mutate(trialPlan, {
      onSuccess: (url) => {
        if (url) window.location.assign(url);
        else toast.error("The card check didn't open. Try again.");
      },
      onError: (error) => {
        toast.error(extractApiError(error).message);
      },
    });
  };

  return (
    <>
      {periods.length > 1 || offered.length > 1 ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {periods.length > 1 && period ? (
            <SegmentedChoice
              name="pricing-period"
              legend="Billing period"
              value={period}
              options={periods.map((option) => ({
                value: option,
                label: PERIOD_LABEL[option],
                hint: option === 'annually' ? yearlyHint : null,
              }))}
              onChange={setChosenPeriod}
            />
          ) : null}
          {offered.length > 1 ? (
            <SegmentedChoice<TCurrency>
              name="pricing-currency"
              legend="Currency"
              value={currency}
              options={offered.map((option) => ({ value: option, label: currencyName(option), hint: null }))}
              onChange={setCurrency}
            />
          ) : null}
        </div>
      ) : null}

      {notices.length > 0 ? (
        <div className="mb-6 flex flex-col gap-2">
          {notices.map((notice) => (
            <p key={notice} className="rounded-2xl bg-secondary px-4 py-3 text-[13px] leading-snug text-foreground">
              {notice}
            </p>
          ))}
        </div>
      ) : null}

      {cards.length === 0 ? (
        <SettingsState
          icon={Globe}
          title={`No plans in ${currencyName(currency)} right now`}
          description="There are no plans on sale to this account at the moment. Check again later."
        />
      ) : (
        <ul className="@container/plans grid gap-4 @xl/pricing:grid-cols-2 @5xl/pricing:grid-cols-4">
          {cards.map(({ tier, plan }) => {
            const action = planAction(plan, account);
            return (
              <li key={tier.key}>
                <PlanCard
                  tier={tier}
                  plan={plan}
                  saving={tierSaving(tier)}
                  action={action}
                  isCurrent={isCurrentTier(tier, account)}
                  recommended={tier.key === recommended}
                  trialOffer={trialOffered && action === 'subscribe' && plan.trial_eligible}
                  viewer={viewer}
                  busy={busyPlanId === plan.id}
                  locked={busyPlanId !== null && busyPlanId !== plan.id}
                  onChoose={choose}
                  onTrial={(next) => {
                    setTrialPlan(next);
                    setTrialDialogOpen(true);
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}

      <PriceNote />

      <TrialDialog
        open={trialDialogOpen}
        plan={trialPlan}
        busy={trialLeaving}
        onOpenChange={(next) => {
          setTrialDialogOpen(next);
          if (!next) trial.reset();
        }}
        onConfirm={confirmTrial}
      />
    </>
  );
}

/** The Pay as you go tab: the pack price from `/message-packs/pricing`. */
function Packs({ viewer }: { viewer: 'account' | 'guest' }) {
  const packs = useQuery(messagePacksQueries.pricing());
  if (packs.isPending) return <PacksFallback />;
  const pricing = packs.data ?? null;
  if (packs.isError || !pricing || pricing.prices.length === 0) {
    return (
      <SettingsState
        icon={MessageSquarePlus}
        tone={packs.isError ? 'alarm' : 'quiet'}
        title={packs.isError ? 'The pack price did not load' : 'No message packs on sale right now'}
        description={packs.isError ? 'Check your connection and try again.' : 'Check again later.'}
        action={
          packs.isError ? (
            <Button size="sm" variant="outline" disabled={packs.isFetching} onClick={() => void packs.refetch()}>
              <RotateCw aria-hidden className={cn('size-4', packs.isFetching && 'animate-spin')} />
              Try again
            </Button>
          ) : undefined
        }
      />
    );
  }
  return (
    <>
      <PayAsYouGoPanel pricing={pricing} viewer={viewer} />
      <PriceNote />
    </>
  );
}

function PriceNote() {
  return (
    <p className="mt-6 px-1 text-[13px] leading-snug text-muted-foreground">Prices exclude taxes and bank charges.</p>
  );
}

function SignedOut({ title, description }: { title: string; description: string }) {
  return (
    <SettingsState
      icon={Crown}
      title={title}
      description={description}
      action={
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={SIGN_IN_HREF}>Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={REGISTER_HREF}>Create an account</Link>
          </Button>
        </div>
      }
    />
  );
}
