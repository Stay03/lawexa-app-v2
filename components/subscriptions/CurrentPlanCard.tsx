'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import {
  CalendarDays,
  CreditCard,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ICurrentSubscriptionData } from '@/types/subscription';

/******************************************************************************
                               Types
******************************************************************************/

interface ICurrentPlanCardProps {
  data: ICurrentSubscriptionData;
  onCancel: () => void;
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
 * Default component. Shows the user's current subscription status.
 */
function CurrentPlanCard(props: ICurrentPlanCardProps) {
  const { data, onCancel } = props;
  const { subscription, plan, is_free_tier } = data;

  // Free tier — show upgrade prompt
  if (is_free_tier) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Current Plan</CardTitle>
            <Badge variant="secondary">Free</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-lg font-semibold">{plan.name}</p>
            {plan.description && (
              <p className="text-sm text-muted-foreground">{plan.description}</p>
            )}
          </div>
          <Button asChild>
            <Link href="/pricing">
              <Sparkles className="size-4" />
              Upgrade Plan
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Paid subscription
  const status = subscription?.status || 'active';
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.active;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Current Plan</CardTitle>
          <Badge className={cn('border-0', statusStyle.className)}>
            {statusStyle.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Plan name and price */}
        <div>
          <p className="text-lg font-semibold">{plan.name}</p>
          <p className="text-sm text-muted-foreground">
            {plan.formatted_amount}
            {!plan.is_free && <span> / {plan.interval_label.toLowerCase()}</span>}
          </p>
        </div>

        {/* Billing details */}
        <div className="space-y-2.5">
          {subscription?.start_date && (
            <DetailRow
              icon={<CalendarDays className="size-4" />}
              label="Started"
              value={format(new Date(subscription.start_date), 'MMM d, yyyy')}
            />
          )}
          {subscription?.next_payment_date && status === 'active' && (
            <DetailRow
              icon={<CreditCard className="size-4" />}
              label="Next billing"
              value={format(new Date(subscription.next_payment_date), 'MMM d, yyyy')}
            />
          )}
          {subscription?.days_until_renewal != null && status === 'active' && (
            <DetailRow
              icon={<CalendarDays className="size-4" />}
              label="Renews in"
              value={`${subscription.days_until_renewal} days`}
            />
          )}
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

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button variant="outline" asChild>
            <Link href="/pricing">
              <ArrowUpRight className="size-4" />
              Change Plan
            </Link>
          </Button>
          {status === 'active' && (
            <Button variant="ghost" className="text-destructive" onClick={onCancel}>
              Cancel Subscription
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * A single detail row with icon, label, and value.
 */
function DetailRow(props: { icon: React.ReactNode; label: string; value: string }) {
  const { icon, label, value } = props;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default CurrentPlanCard;
