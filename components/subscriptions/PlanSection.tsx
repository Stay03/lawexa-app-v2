'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Crown, Sparkles, ArrowUpRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ICurrentSubscriptionData } from '@/types/subscription';
import type { ITrialData } from '@/types/trial';

/******************************************************************************
                               Types
******************************************************************************/

interface IPlanSectionProps {
  data: ICurrentSubscriptionData;
  trialData?: ITrialData | null;
}

/******************************************************************************
                               Constants
******************************************************************************/

const STATUS_STYLES: Record<string, { className: string; label: string }> = {
  active: { className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: 'Active' },
  cancelled: { className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', label: 'Cancelled' },
  past_due: { className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', label: 'Past Due' },
  trialing: { className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', label: 'Trialing' },
  expired: { className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', label: 'Expired' },
};

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Shows the user's current subscription as a flat section.
 */
function PlanSection(props: IPlanSectionProps) {
  const { data, trialData } = props;
  const { subscription, plan, is_free_tier } = data;

  // Free tier — show upgrade prompt
  if (is_free_tier) {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Sparkles className="size-5 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{plan.name}</h3>
              <Badge variant="secondary">Free</Badge>
            </div>
            {plan.description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{plan.description}</p>
            )}
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/pricing">
            Upgrade plan
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </div>
    );
  }

  // Paid subscription
  const status = subscription?.status || 'active';
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.active;

  return (
    <div className="space-y-5">
      {/* Plan header row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Crown className="size-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{plan.name}</h3>
              <Badge className={cn('border-0', statusStyle.className)}>
                {statusStyle.label}
              </Badge>
            </div>
            {plan.description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{plan.description}</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {plan.formatted_amount}
              {!plan.is_free && <span> / {plan.interval_label.toLowerCase()}</span>}
              {subscription?.next_payment_date && status === 'active' && (
                <span>
                  {' · '}Your subscription will auto renew on{' '}
                  {format(new Date(subscription.next_payment_date), 'MMM d, yyyy')}.
                </span>
              )}
              {subscription?.next_payment_date && status === 'trialing' && (
                <span>
                  {' · '}First charge on{' '}
                  {format(new Date(subscription.next_payment_date), 'MMM d, yyyy')}.
                </span>
              )}
            </p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/pricing">Adjust plan</Link>
        </Button>
      </div>

      {/* Cancelled notice */}
      {status === 'cancelled' && subscription?.ends_at && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
          Your subscription is cancelled. Access continues until{' '}
          <span className="font-medium">
            {format(new Date(subscription.ends_at), 'MMM d, yyyy')}
          </span>.
        </div>
      )}

      {/* Past due notice */}
      {status === 'past_due' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-200">
          Your payment is overdue. Please update your payment method to maintain access.
        </div>
      )}

      {/* Trial notice */}
      {status === 'trialing' && trialData?.trial_ends_at && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800 dark:border-blue-800/50 dark:bg-blue-950/30 dark:text-blue-200">
          You&apos;re on a free trial. Your trial ends on{' '}
          <span className="font-medium">
            {format(new Date(trialData.trial_ends_at), 'MMM d, yyyy')}
          </span>
          {trialData.subscription?.days_until_renewal != null && (
            <span> ({trialData.subscription.days_until_renewal} days remaining)</span>
          )}
          . After that, your card will be charged{' '}
          <span className="font-medium">{trialData.plan.formatted_amount}</span>.
        </div>
      )}
    </div>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default PlanSection;
