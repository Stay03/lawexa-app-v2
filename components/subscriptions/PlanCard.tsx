'use client';

import { Check, Sparkles, Loader2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { IPlan, ICurrentSubscriptionData } from '@/types/subscription';

/******************************************************************************
                               Types
******************************************************************************/

type TPlanAction = 'current' | 'subscribe' | 'upgrade' | 'downgrade' | 'unavailable';

interface IPlanCardProps {
  plan: IPlan;
  currentData: ICurrentSubscriptionData | null;
  isLoading?: boolean;
  onSelect: (plan: IPlan, action: TPlanAction) => void;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Renders a single plan card for the pricing grid.
 */
function PlanCard(props: IPlanCardProps) {
  const { plan, currentData, isLoading = false, onSelect } = props;
  const action = getPlanAction(plan, currentData);
  const isCurrent = action === 'current';
  const isFeatured = plan.is_featured;

  return (
    <Card
      className={cn(
        'relative flex flex-col transition-shadow hover:shadow-md',
        isFeatured && 'ring-2 ring-primary',
        isCurrent && 'bg-muted/30'
      )}
    >
      {/* Featured badge */}
      {isFeatured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="gap-1">
            <Sparkles className="size-3" />
            Popular
          </Badge>
        </div>
      )}

      <CardHeader className={cn(isFeatured && 'pt-4')}>
        <CardTitle className="text-lg">{plan.name}</CardTitle>
        {plan.description && (
          <p className="text-sm text-muted-foreground">{plan.description}</p>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-6">
        {/* Price */}
        <div>
          {plan.is_free ? (
            <>
              <span className="text-3xl font-bold">Free</span>
              <span className="text-sm text-muted-foreground ml-1">forever</span>
            </>
          ) : (
            <>
              <span className="text-3xl font-bold">{plan.formatted_amount}</span>
              <span className="text-sm text-muted-foreground ml-1">
                / {plan.interval_label.toLowerCase()}
              </span>
            </>
          )}
        </div>

        {/* Features */}
        {plan.features.length > 0 && (
          <ul className="space-y-2.5">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <Check className="size-4 shrink-0 text-primary mt-0.5" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Limits */}
        <LimitBadges plan={plan} />
      </CardContent>

      <CardFooter>
        <PlanButton
          action={action}
          isLoading={isLoading}
          onClick={() => onSelect(plan, action)}
        />
      </CardFooter>
    </Card>
  );
}

/**
 * Displays plan limits as subtle badges.
 */
function LimitBadges({ plan }: { plan: IPlan }) {
  const limitLabels = plan.limits
    .map((limit) => {
      const label = LIMIT_TYPE_LABELS[limit.type] || limit.type;
      if (limit.is_unlimited) return `Unlimited ${label}`;
      if (limit.value === 0) return null;
      const period = limit.period === 'lifetime' ? '' : '/mo';
      return `${limit.value} ${label}${period}`;
    })
    .filter(Boolean);

  if (limitLabels.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {limitLabels.map((label) => (
        <Badge key={label} variant="secondary" className="text-xs font-normal">
          {label}
        </Badge>
      ))}
    </div>
  );
}

/**
 * CTA button for a plan card.
 */
function PlanButton(props: {
  action: TPlanAction;
  isLoading: boolean;
  onClick: () => void;
}) {
  const { action, isLoading, onClick } = props;
  const config = BUTTON_CONFIG[action];

  return (
    <Button
      variant={config.variant}
      className="w-full"
      disabled={config.disabled || isLoading}
      onClick={onClick}
    >
      {isLoading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Processing...
        </>
      ) : (
        config.label
      )}
    </Button>
  );
}

/******************************************************************************
                               Functions
******************************************************************************/

const LIMIT_TYPE_LABELS: Record<string, string> = {
  ai_messages: 'AI messages',
  bookmarks: 'bookmarks',
  note_creations: 'notes',
};

const BUTTON_CONFIG: Record<
  TPlanAction,
  { label: string; variant: 'default' | 'outline' | 'secondary' | 'ghost'; disabled: boolean }
> = {
  current: { label: 'Current Plan', variant: 'outline', disabled: true },
  subscribe: { label: 'Get Started', variant: 'default', disabled: false },
  upgrade: { label: 'Upgrade', variant: 'default', disabled: false },
  downgrade: { label: 'Downgrade', variant: 'secondary', disabled: true },
  unavailable: { label: 'Not Available', variant: 'ghost', disabled: true },
};

/**
 * Determine what action the user can take on a plan.
 */
function getPlanAction(plan: IPlan, currentData: ICurrentSubscriptionData | null): TPlanAction {
  if (!currentData) return 'subscribe';
  const currentPlan = currentData.plan;
  // Same plan
  if (currentPlan.id === plan.id) return 'current';
  // User on free tier
  if (currentData.is_free_tier) {
    return plan.is_free ? 'current' : 'subscribe';
  }
  // User on paid plan
  if (plan.is_free) return 'unavailable';
  const currentAmount = parseFloat(currentPlan.amount);
  const targetAmount = parseFloat(plan.amount);
  if (targetAmount > currentAmount) return 'upgrade';
  if (targetAmount < currentAmount) return 'downgrade';
  return 'subscribe';
}

/******************************************************************************
                               Export default
******************************************************************************/

export default PlanCard;
export type { TPlanAction };
