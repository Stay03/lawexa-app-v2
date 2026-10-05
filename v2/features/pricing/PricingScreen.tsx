'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Crown, Globe, MessageSquarePlus, RotateCw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import { formatMoneyMajor } from '@/lib/utils/payment-format';
import type { IMessagePackPricingData } from '@/types/message-pack';
import type { TCurrency } from '@/types/payment';
import type { IPlan } from '@/types/subscription';
import { billingQueries } from '@/v2/features/settings/billing/queries';
import {
  currencyName,
  currencyOffer,
  offerFrom,
} from '@/v2/features/settings/message-packs/currency-offer';
import { BuyPanel } from '@/v2/features/settings/message-packs/BuyPanel';
import { messagePacksQueries } from '@/v2/features/settings/message-packs/queries';
import { SettingsFormGroup } from '@/v2/features/settings/SettingsForm';
import { SettingsState } from '@/v2/features/settings/SettingsState';
import { setCurrency, useCurrency } from '@/v2/runtime/currency';
import { useV2Session } from '@/v2/runtime/session-context';
import {
  PERIOD_LABEL,
  REGISTER_HREF,
  SIGN_IN_HREF,
  accountNotices,
  buildTiers,
  currenciesOnSale,
  defaultPeriod,
  isCurrentTier,
  periodsOnSale,
  planAction,
  planFor,
  savingHint,
  tierSaving,
  type Period,
  type PlanAction,
} from './model';
import { PlanCard } from './PlanCard';
import { pricingQueries, useCheckout, useStartTrial } from './queries';
import { PRICING_COLUMN, PricingFallback } from './states';
import { TrialDialog } from './TrialDialog';

/**
 * PricingScreen — v2 `/pricing`, which v1's `/upgrade` also lands on: the
 * plans this account is offered, one card per tier, a period switch, the
 * currency switch when there is a choice, message packs, and the way to ask
 * about a firm's plan.
 *
 * ── THE MONEY FLOW IS v1's ─────────────────────────────────────────────────
 * A card starts the same call v1 started with the same arguments
 * (`queries.ts`): a new plan or an upgrade goes to the address the server
 * returns, an upgrade the credit already covers is confirmed and opens
 * Billing, and a trial opens Paystack's card check. The provider returns the
 * buyer to the callbacks v2 already claims. Only the page around it changed.
 *
 * ── WHAT IT DOES NOT SAY ───────────────────────────────────────────────────
 * No feature list. v1's came from a table in the component and promised what
 * the plans did not give; a card here says the plan's description, its price
 * and the limits the plan counts (`model.ts` has the reasoning). v1's
 * Enterprise tab listed four promises nobody had made in writing; the email
 * address it pointed at stays, the promises do not.
 *
 * ── WHO SEES WHAT ──────────────────────────────────────────────────────────
 * Signed out: `/subscriptions/plans` answers 401 without a session, and v1's
 * client then sent the reader to sign-in mid-render. Here the screen asks
 * nothing and offers both doors instead, each returning here. A guest has a
 * device session and sees the plans, but buys on an account, so every card
 * offers registration. An account sees its own plan marked and the buttons
 * v1's rules allow.
 */
export function PricingScreen() {
  const { signedIn, role } = useV2Session();
  if (!signedIn) return <SignedOut />;
  return <Plans viewer={role === 'guest' ? 'guest' : 'account'} offersDaily={role === 'superadmin'} />;
}

function Plans({ viewer, offersDaily }: { viewer: 'account' | 'guest'; offersDaily: boolean }) {
  const router = useRouter();
  const isAccount = viewer === 'account';
  const plans = useQuery(pricingQueries.plans());
  const current = useQuery({ ...billingQueries.current(), enabled: isAccount });
  const packs = useQuery({ ...messagePacksQueries.pricing(), enabled: isAccount });
  const { currency: storedCurrency } = useCurrency();
  const { offered, currency } = offerFrom(plans.data ? currenciesOnSale(plans.data) : [], storedCurrency);
  // Trials are Paystack's, so v1 only ever offered them in Naira.
  const asksTrial = isAccount && plans.isSuccess && currency === 'NGN';
  const eligibility = useQuery(pricingQueries.trialEligibility(asksTrial));
  const checkout = useCheckout();
  const trial = useStartTrial();
  const [chosenPeriod, setChosenPeriod] = useState<Period | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
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

  if (
    plans.isPending ||
    (isAccount && (current.isPending || packs.isPending)) ||
    (asksTrial && eligibility.isPending)
  ) {
    return <PricingFallback />;
  }

  if (plans.isError || current.isError) {
    const retrying = plans.isFetching || current.isFetching;
    return (
      <div className={PRICING_COLUMN}>
        <Heading />
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
      </div>
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
    <div className={PRICING_COLUMN}>
      <Heading />

      {periods.length > 1 || offered.length > 1 ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
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
        <div className="mb-5 flex flex-col gap-2">
          {notices.map((notice) => (
            <p
              key={notice}
              className="rounded-2xl bg-secondary px-4 py-3 text-[13px] leading-snug text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
            >
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
        <ul className="grid gap-4 sm:grid-cols-2">
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

      {isAccount ? <PacksRow pricing={packs.data ?? null} onBuy={() => setBuyOpen(true)} /> : null}

      <div className="mt-6 flex flex-col gap-1.5 px-1 text-[13px] leading-snug text-muted-foreground">
        <p>Prices exclude taxes and bank charges.</p>
        <p>
          For a plan for your firm or team, email{' '}
          <a
            href="mailto:enterprise@lawexa.com"
            className="font-medium text-foreground underline underline-offset-2"
          >
            enterprise@lawexa.com
          </a>
          .
        </p>
      </div>

      {isAccount ? <BuyPanel open={buyOpen} onOpenChange={setBuyOpen} pricing={packs.data ?? null} /> : null}
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
    </div>
  );
}

/**
 * Message packs, one row: what a pack holds and costs, read from
 * `/message-packs/pricing`, and the same Buy panel Settings uses, so a pack
 * bought here returns through `/payg/callback` like one bought there. The
 * sentence is the one the backend checked for the Message packs screen
 * (28 September 2026): plan messages first, bought messages never expire.
 * No price for the buyer's currency means no row.
 */
function PacksRow({
  pricing,
  onBuy,
}: {
  pricing: IMessagePackPricingData | null;
  onBuy: () => void;
}) {
  const { currency: stored } = useCurrency();
  const { currency } = currencyOffer(pricing, stored);
  const priceRow = pricing?.prices.find((row) => row.currency === currency) ?? null;
  if (!pricing || !priceRow) return null;
  return (
    <div className="mt-8">
      <SettingsFormGroup id="pricing-packs" label="Message packs">
        <li className="flex min-h-14 items-center gap-3.5 px-4 py-2.5">
          <MessageSquarePlus aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] leading-snug font-medium text-foreground tabular-nums">
              {pricing.messages_per_pack} AI messages for {formatMoneyMajor(priceRow.price_major, currency)}
            </span>
            <span className="text-[13px] leading-snug text-muted-foreground">
              Used after your plan&apos;s messages. Messages you buy never expire.
            </span>
          </span>
          <Button size="sm" onClick={onBuy} className="shrink-0">
            Buy
          </Button>
        </li>
      </SettingsFormGroup>
    </div>
  );
}

/**
 * A two- or three-way choice drawn as one pill: real radio inputs, visually
 * hidden, so the group gets arrow keys, one tab stop and its name announced
 * from the browser (the reasoning in `SettingsForm`'s choice group). The chosen
 * segment is lifted on to the page colour and the change moves over 150ms.
 */
function SegmentedChoice<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
}: {
  name: string;
  legend: string;
  value: T;
  options: { value: T; label: string; hint: string | null }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div className="inline-flex max-w-full items-center rounded-full bg-muted p-1">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                'v2-interactive relative flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-medium md:min-h-9',
                'transition-colors duration-150 motion-reduce:transition-none',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                selected
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
              {option.hint ? (
                <span className="text-xs font-normal text-muted-foreground">{option.hint}</span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Heading() {
  return (
    <h1 className="sr-only md:not-sr-only md:mb-5 md:text-2xl md:font-semibold md:tracking-tight md:text-foreground">
      Plans
    </h1>
  );
}

function SignedOut() {
  return (
    <div className={PRICING_COLUMN}>
      <Heading />
      <SettingsState
        icon={Crown}
        title="Sign in to see plans"
        description="The plans and prices on offer depend on your account, so they show once you sign in."
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
    </div>
  );
}
