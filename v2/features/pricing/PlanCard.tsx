'use client';

import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { IPlan } from '@/types/subscription';
import { REGISTER_HREF, actionLabel, limitLines, priceView, type PlanAction, type Tier } from './model';

/**
 * PlanCard — one tier at the chosen period: its name, the plan's own
 * description, the price that is charged, the limits the plan counts, and the
 * one thing the account can do with it.
 *
 * Every word comes from the plan or from `model.ts`; nothing here knows what a
 * tier is called or what it includes. The button's state is `planAction`,
 * v1's decision, and a button that cannot be pressed says why under it.
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
  const limits = limitLines(plan);
  const badge = isCurrent ? 'Your plan' : trialOffer ? 'Free trial' : tier.featured ? 'Popular' : null;
  const raised = !isCurrent && (trialOffer || tier.featured);

  return (
    <Card
      className={cn(
        'h-full gap-5 py-5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
        raised && 'ring-2 ring-primary',
        isCurrent && 'bg-secondary',
      )}
    >
      <CardHeader className="px-5 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg font-semibold tracking-tight">{tier.name}</CardTitle>
          {badge ? (
            <Badge variant={isCurrent ? 'outline' : 'default'} className="shrink-0">
              {badge}
            </Badge>
          ) : null}
        </div>
        {tier.description ? (
          <CardDescription className="text-[13px] leading-snug">{tier.description}</CardDescription>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 px-5 sm:px-5">
        <div key={plan.id} className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">{price.amount}</span>
            <span className="text-sm text-muted-foreground">{price.per}</span>
          </p>
          {trialOffer ? (
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
              Free during the trial, then this price.
            </p>
          ) : price.detail ? (
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground tabular-nums">{price.detail}</p>
          ) : null}
        </div>

        {limits.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {limits.map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm leading-snug text-foreground">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-2 px-5 sm:px-5">
        <PlanButton
          tier={tier}
          plan={plan}
          action={action}
          isCurrent={isCurrent}
          trialOffer={trialOffer}
          viewer={viewer}
          busy={busy}
          locked={locked}
          onChoose={onChoose}
          onTrial={onTrial}
        />
      </CardFooter>
    </Card>
  );
}

function PlanButton({
  tier,
  plan,
  action,
  isCurrent,
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
  trialOffer: boolean;
  viewer: 'account' | 'guest';
  busy: boolean;
  locked: boolean;
  onChoose: (plan: IPlan, action: PlanAction) => void;
  onTrial: (plan: IPlan) => void;
}) {
  const size = 'h-11 w-full text-[15px] md:h-10 md:text-sm';

  // A guest browses on a device session that holds no account, so a plan
  // cannot be bought on it: the button opens registration, which comes back.
  if (viewer === 'guest') {
    return (
      <Button asChild className={size}>
        <Link href={REGISTER_HREF}>Create an account</Link>
      </Button>
    );
  }

  if (trialOffer) {
    return (
      <Button type="button" className={size} disabled={busy || locked} onClick={() => onTrial(plan)}>
        Start free trial
      </Button>
    );
  }

  const label = actionLabel(action, plan, tier.name, isCurrent);

  if (action === 'upgrade' || action === 'subscribe') {
    return (
      <Button
        type="button"
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
