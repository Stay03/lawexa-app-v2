'use client';

import { useState } from 'react';
import { Check, ChevronDown, Sparkles, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { IPlan, ICurrentSubscriptionData } from '@/types/subscription';

/******************************************************************************
                               Types
******************************************************************************/

type TPlanAction = 'current' | 'subscribe' | 'upgrade' | 'downgrade' | 'unavailable';

interface IPlanCardProps {
  plan: IPlan;
  currentData: ICurrentSubscriptionData | null;
  displayName?: string;
  interval?: string;
  isLoading?: boolean;
  onSelect: (plan: IPlan, action: TPlanAction) => void;
}

/******************************************************************************
                               Constants
******************************************************************************/

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

const TIER_FEATURES: Record<string, { highlighted: string[]; more: string[] }> = {
  basic: {
    highlighted: [
      'Chat with Document (10MB limit)',
      '50 AI Messages per month',
      'AI Tutor',
      'Natural Language Search',
    ],
    more: [
      'Access to Case, Statute & Notes Library',
      'Foreign & Local Cases',
      'Multi-Jurisdiction Access',
      'Study Mode',
      'Flashcards',
      'Quizzes',
      'Connect to a Lawyer',
    ],
  },
  pro: {
    highlighted: [
      'Chat with Document (25MB limit)',
      '150 AI Messages per month',
      'AI Tutor',
      'Natural Language Search',
    ],
    more: [
      'Access to Case, Statute & Notes Library',
      'Foreign & Local Cases',
      'Multi-Jurisdiction Access',
      'Study Mode',
      'Flashcards',
      'Quizzes',
      'Connect to a Lawyer',
    ],
  },
  'ai-counsel': {
    highlighted: [
      'Unlimited AI Messages',
      'Chat with Document (No size limit)',
      'Legal Drafting',
      'Deep Legal Research',
      'Deep Contract Review',
    ],
    more: [
      'Access to Case, Statute & Notes Library',
      'Foreign & Local Cases',
      'Multi-Jurisdiction Access',
      'Natural Language Search',
      'AI Tutor',
      'Study Mode',
      'Flashcards',
      'Quizzes',
      'Connect to a Lawyer',
      'Twitter Bot for legal updates',
    ],
  },
};

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Renders a single plan card for the pricing grid.
 */
function PlanCard(props: IPlanCardProps) {
  const { plan, currentData, displayName, interval, isLoading = false, onSelect } = props;
  const action = getPlanAction(plan, currentData);
  const isCurrent = action === 'current';
  const isFeatured = plan.is_featured;

  // Resolve features: use explicit tier features if available, else fall back to API
  const tierKey = getTierKeyFromSlug(plan);
  const tierFeatures = TIER_FEATURES[tierKey];
  const highlightedFeatures = tierFeatures?.highlighted ?? plan.features;
  const moreFeatures = tierFeatures?.more ?? [];

  return (
    <Card
      className={cn(
        'relative flex h-full flex-col transition-shadow hover:shadow-md',
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
        <CardTitle className="text-lg">{displayName ?? plan.name}</CardTitle>
        {plan.description && (
          <p className="text-sm text-muted-foreground">{plan.description}</p>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-6">
        {/* Price */}
        <div>
          {plan.is_free ? (
            <>
              <div className="text-3xl font-bold">Free</div>
              <div className="text-sm text-muted-foreground">forever</div>
            </>
          ) : interval === 'annually' ? (
            <>
              <div className="text-3xl font-bold">
                {formatNaira(formatMonthlyFromAnnual(plan.amount))}
              </div>
              <div className="text-sm text-muted-foreground">/ month</div>
              <div className="text-xs text-muted-foreground">billed annually</div>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold">{formatNaira(plan.formatted_amount)}</div>
              <div className="text-sm text-muted-foreground">
                / {plan.interval_label.toLowerCase()}
              </div>
            </>
          )}
        </div>

        {/* Highlighted features */}
        {highlightedFeatures.length > 0 && (
          <HighlightedFeatures features={highlightedFeatures} />
        )}

        {/* CTA button */}
        <PlanButton
          action={action}
          isLoading={isLoading}
          onClick={() => onSelect(plan, action)}
        />

        {/* Collapsible additional features */}
        {moreFeatures.length > 0 && (
          <CollapsibleFeatures features={moreFeatures} />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Always-visible highlighted features list.
 */
function HighlightedFeatures({ features }: { features: string[] }) {
  return (
    <ul className="space-y-2.5">
      {features.map((feature) => (
        <li key={feature} className="flex items-start gap-2 text-sm">
          <Check className="size-4 shrink-0 text-primary mt-0.5" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Collapsible section for additional features.
 */
function CollapsibleFeatures({ features }: { features: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ChevronDown
          className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')}
        />
        {open ? 'Less' : 'More features'}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-2.5 space-y-2.5">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <Check className="size-4 shrink-0 text-primary mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
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

/** Replace "NGN " prefix with "₦" for display. */
function formatNaira(formatted: string): string {
  return formatted.replace(/^NGN\s*/, '₦');
}

/** Convert annual amount to a formatted monthly equivalent string. */
function formatMonthlyFromAnnual(amount: string): string {
  const monthly = parseFloat(amount) / 12;
  return `NGN ${monthly.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Derive the tier key from a plan slug (e.g. "basic-monthly" → "basic"). */
function getTierKeyFromSlug(plan: IPlan): string {
  if (plan.is_free) return 'free';
  const parts = plan.slug.split('-');
  return parts.slice(0, -1).join('-');
}

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
