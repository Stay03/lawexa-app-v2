'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { IPlan } from '@/types/subscription';
import { REGISTER_HREF, actionLabel, cardLines, priceView, type PlanAction, type Tier } from './model';

/**
 * PlanCard — one tier at the chosen period: its name, the plan's own
 * description, the price that is charged, v1's benefit lines for the tier,
 * and the one thing the account can do with it.
 *
 * Every word comes from the plan or from `model.ts`; nothing here knows what a
 * tier is called or what it includes. The highlighted lines always show; the
 * rest open under "More features", as on v1's card.
 *
 * ── HIERARCHY ──────────────────────────────────────────────────────────────
 * One card leads: the recommended tier (`RECOMMENDED_TIER_KEY`) carries the
 * gold ring, a faint gold surface and the only filled button; the others use
 * the outline button, so the eye has one place to land. The account's own
 * plan is marked instead of recommended, on the secondary surface. The price
 * is set in the page's serif figure (`pricing.css`), the largest type on the
 * card, with a rule between what a plan costs and what it includes.
 *
 * The price block is keyed by the plan, so switching Monthly and Yearly fades
 * the new price in where the old one stood rather than swapping it in a frame.
 */
export function PlanCard({
  tier,
  plan,
  saving,
  action,
  isCurrent,
  recommended,
  trialOffer,
  viewer,
  busy,
  locked,
  onChoose,
  onTrial,
}: {
  tier: Tier;
  plan: IPlan;
  saving: number;
  action: PlanAction;
  /** The account is on one of this tier's plans (any period). */
  isCurrent: boolean;
  /** The tier the page recommends (`recommendedTierKey`). */
  recommended: boolean;
  trialOffer: boolean;
  viewer: 'account' | 'guest';
  /** This card's own press is on its way to the provider. */
  busy: boolean;
  /** Another card's press is, so this one waits. */
  locked: boolean;
  onChoose: (plan: IPlan, action: PlanAction) => void;
  onTrial: (plan: IPlan) => void;
}) {
  const price = priceView(plan, saving);
  const lines = cardLines(tier, plan);
  const leads = !isCurrent && (recommended || trialOffer);
  const badge = isCurrent ? 'Your plan' : trialOffer ? 'Free trial' : recommended ? 'Recommended' : null;

  return (
    <Card
      className={cn(
        'h-full gap-0 py-0',
        leads && 'bg-primary/[0.045] ring-2 ring-primary dark:bg-primary/[0.07]',
        isCurrent && 'bg-secondary ring-foreground/15',
      )}
    >
      <div className="flex flex-col gap-1.5 px-5 pt-5">
        <div className="flex min-h-6 items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{tier.name}</h2>
          {badge ? (
            <Badge variant={leads ? 'default' : 'outline'} className="shrink-0">
              {badge}
            </Badge>
          ) : null}
        </div>
        {tier.description ? (
          <p className="text-[13px] leading-snug text-muted-foreground @5xl/plans:min-h-[2lh]">{tier.description}</p>
        ) : null}
      </div>

      <div key={plan.id} className="px-5 pt-5 pb-5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="pricing-figure text-[2.5rem] text-foreground">{price.amount}</span>
          <span className="text-sm text-muted-foreground">{price.per}</span>
        </p>
        <p className="mt-2 min-h-[1lh] text-[13px] leading-snug text-muted-foreground tabular-nums">
          {trialOffer ? 'Free during the trial, then this price.' : (price.detail ?? '')}
        </p>
      </div>

      <div className="mx-5 border-t border-foreground/10" />

      <div className="flex flex-1 flex-col gap-3 px-5 py-5">
        {lines.highlighted.length > 0 ? <BenefitList lines={lines.highlighted} /> : null}
        {lines.more.length > 0 ? <MoreBenefits lines={lines.more} /> : null}
      </div>

      <div className="flex flex-col items-stretch gap-2 px-5 pb-5">
        <PlanButton
          tier={tier}
          plan={plan}
          action={action}
          isCurrent={isCurrent}
          leads={leads}
          trialOffer={trialOffer}
          viewer={viewer}
          busy={busy}
          locked={locked}
          onChoose={onChoose}
          onTrial={onTrial}
        />
      </div>
    </Card>
  );
}

function BenefitList({ lines }: { lines: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {lines.map((line) => (
        <li key={line} className="flex items-start gap-2 text-sm leading-snug text-foreground">
          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          {line}
        </li>
      ))}
    </ul>
  );
}

/** The lines v1 kept under "More features", closed until the reader opens them. */
function MoreBenefits({ lines }: { lines: readonly string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 rounded text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <ChevronDown
          aria-hidden
          className={cn('size-4 shrink-0 transition-transform duration-200', open && 'rotate-180')}
        />
        {open ? 'Less' : 'More features'}
      </CollapsibleTrigger>
      <CollapsibleContent className="v2-collapse">
        <div className="pt-2">
          <BenefitList lines={lines} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function PlanButton({
  tier,
  plan,
  action,
  isCurrent,
  leads,
  trialOffer,
  viewer,
  busy,
  locked,
  onChoose,
  onTrial,
}: {
  tier: Tier;
  plan: IPlan;
  action: PlanAction;
  isCurrent: boolean;
  /** The card the page leads with: the only filled button. */
  leads: boolean;
  trialOffer: boolean;
  viewer: 'account' | 'guest';
  busy: boolean;
  locked: boolean;
  onChoose: (plan: IPlan, action: PlanAction) => void;
  onTrial: (plan: IPlan) => void;
}) {
  const variant = leads ? 'default' : 'outline';
  const size = 'h-11 w-full text-[15px] md:h-10 md:text-sm';

  // A guest browses on a device session that holds no account, so a plan
  // cannot be bought on it: the button opens registration, which comes back.
  if (viewer === 'guest') {
    return (
      <Button asChild variant={variant} className={size}>
        <Link href={REGISTER_HREF}>Create an account</Link>
      </Button>
    );
  }

  if (trialOffer) {
    return (
      <Button type="button" variant={variant} className={size} disabled={busy || locked} onClick={() => onTrial(plan)}>
        Start free trial
      </Button>
    );
  }

  const label = actionLabel(action, plan, tier.name, isCurrent);

  if (action === 'upgrade' || action === 'subscribe') {
    return (
      <Button
        type="button"
        variant={variant}
        className={size}
        disabled={busy || locked}
        aria-busy={busy || undefined}
        onClick={() => onChoose(plan, action)}
      >
        {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
        {label}
      </Button>
    );
  }

  return (
    <>
      <Button type="button" variant={action === 'downgrade' ? 'secondary' : 'outline'} className={size} disabled>
        {label}
      </Button>
      {action === 'downgrade' ? (
        <p className="text-center text-[13px] leading-snug text-muted-foreground">
          To move to a cheaper plan, cancel yours in{' '}
          <Link href="/settings/billing" className="font-medium text-foreground underline underline-offset-2">
            Billing
          </Link>{' '}
          and choose this one when it ends.
        </p>
      ) : null}
    </>
  );
}
