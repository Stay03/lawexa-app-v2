'use client';

import { useState, useMemo } from 'react';
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
import {
  formatPlanAmount,
  formatPlanMonthlyFromAnnual,
  calculateAnnualSavingsPct,
} from '@/lib/utils/payment-format';
import type { IPlan, ICurrentSubscriptionData } from '@/types/subscription';
import TrialStartDialog from './TrialStartDialog';

/******************************************************************************
                               Types
******************************************************************************/

type TInterval = 'daily' | 'monthly' | 'annually';
type TPlanAction = 'current' | 'subscribe' | 'upgrade' | 'downgrade' | 'cross-currency' | 'unavailable';

interface IPlanCardProps {
  plan: IPlan;
  currentData: ICurrentSubscriptionData | null;
  displayName?: string;
  /** All interval variants for this tier (used for in-card interval toggle). */
  allIntervalPlans?: Partial<Record<TInterval, IPlan>>;
  /** Available intervals to show in the toggle. */
  availableIntervals?: TInterval[];
  isLoading?: boolean;
  loadingPlanId?: number | null;
  onSelect: (plan: IPlan, action: TPlanAction) => void;
  /** Whether this plan is eligible for a free trial. */
  trialEligible?: boolean;
  /** Plan ID currently being processed for trial start (for loading state). */
  trialLoadingPlanId?: number | null;
  /** Callback when user clicks "Start Free Trial". */
  onStartTrial?: (plan: IPlan) => void;
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
  // Cross-currency switches require cancellation first (backend rejects with 422).
  'cross-currency': { label: 'Cancel current plan to switch', variant: 'outline', disabled: true },
  unavailable: { label: 'Not Available', variant: 'ghost', disabled: true },
};

const INTERVAL_LABELS: Record<TInterval, string> = {
  daily: 'Daily',
  monthly: 'Monthly',
  annually: 'Annually',
};

const TIER_FEATURES: Record<string, { highlighted: string[]; more: string[] }> = {
  basic: {
    highlighted: [
      '50 AI Messages',
      'Unlimited Library Access',
      'Chat with Document (10MB limit)',
      'Chat with Statute',
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
      'Unlimited AI Messages',
      'Unlimited Library Access',
      '50 Deep Legal Research',
      'Chat with Document (25MB limit)',
      'Chat with Statute',
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
      'Unlimited Library Access',
      'Chat with Document (No size limit)',
      'Chat with Statute',
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
  const {
    plan,
    currentData,
    displayName,
    allIntervalPlans,
    availableIntervals = [],
    isLoading = false,
    loadingPlanId,
    onSelect,
    trialEligible = false,
    trialLoadingPlanId,
    onStartTrial,
  } = props;

  const isFeatured = plan.is_featured;
  const isFree = plan.is_free;

  // In-card interval state (default to monthly, fallback to first available)
  const [selectedInterval, setSelectedInterval] = useState<TInterval>(
    availableIntervals.includes('monthly') ? 'monthly' : availableIntervals[0] ?? 'monthly'
  );

  // Resolve which plan to display based on selected interval
  const activePlan = isFree ? plan : (allIntervalPlans?.[selectedInterval] ?? plan);
  const action = getPlanAction(activePlan, currentData);
  const isCurrent = action === 'current';

  // Trial mode — transforms the entire card when trial is available
  const isTrialMode =
    trialEligible && action === 'subscribe' && !!onStartTrial && activePlan.trial_eligible;
  const isTrialLoading = trialLoadingPlanId === activePlan.id;
  const [isTrialDialogOpen, setIsTrialDialogOpen] = useState(false);

  // Calculate annual savings using minor units (currency-agnostic)
  const annualSavings = useMemo(() => {
    const monthly = allIntervalPlans?.monthly;
    const annual = allIntervalPlans?.annually;
    if (!monthly || !annual) return 0;
    return calculateAnnualSavingsPct(monthly.amount_minor, annual.amount_minor);
  }, [allIntervalPlans]);

  // Resolve features by tier
  const tierKey = getTierKeyFromSlug(plan);
  const tierFeatures = TIER_FEATURES[tierKey];
  const highlightedFeatures = tierFeatures?.highlighted ?? plan.features;
  const moreFeatures = tierFeatures?.more ?? [];

  // Show interval toggle only for paid plans with multiple intervals
  const showIntervalToggle = !isFree && availableIntervals.length > 1;

  return (
    <Card
      className={cn(
        'relative flex h-full flex-col overflow-visible transition-shadow hover:shadow-md',
        isTrialMode ? 'ring-2 ring-primary' : isFeatured && 'ring-2 ring-primary',
        isCurrent && 'bg-muted/30'
      )}
    >
      {/* Badge — trial mode shows "FIRST TIME OFFER", otherwise "Popular" */}
      {isTrialMode ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="gap-1">
            <Sparkles className="size-3" />
            First Time Offer
          </Badge>
        </div>
      ) : isFeatured ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="gap-1">
            <Sparkles className="size-3" />
            Popular
          </Badge>
        </div>
      ) : null}

      <CardHeader className={cn((isFeatured || isTrialMode) && 'pt-4')}>
        <CardTitle className="text-lg">{displayName ?? plan.name}</CardTitle>
        {plan.description && (
          <p className="min-h-[40px] text-sm text-muted-foreground">{plan.description}</p>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-6">
        {/* Interval toggle inside card */}
        {showIntervalToggle && (
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {availableIntervals.map((interval) => (
              <button
                key={interval}
                onClick={() => setSelectedInterval(interval)}
                className={cn(
                  'flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  selectedInterval === interval
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="flex items-center justify-center gap-1">
                  {INTERVAL_LABELS[interval]}
                  {interval === 'annually' && annualSavings > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-[9px] px-1 py-0 font-semibold text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/50"
                    >
                      Save {annualSavings}%
                    </Badge>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Price */}
        <div>
          {isTrialMode ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">₦0</span>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 font-semibold text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/50"
                >
                  Save {formatPlanAmount(activePlan)}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Then {formatPlanAmount(activePlan)}/{activePlan.interval_label.toLowerCase()} after trial
              </div>
            </>
          ) : activePlan.is_free ? (
            <>
              <div className="text-3xl font-bold">Free</div>
              <div className="text-sm text-muted-foreground">forever</div>
            </>
          ) : selectedInterval === 'annually' ? (
            <>
              <div className="text-3xl font-bold">
                {formatPlanMonthlyFromAnnual(activePlan)}
              </div>
              <div className="text-sm text-muted-foreground">/ month</div>
              <div className="text-xs text-muted-foreground">billed annually</div>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold">{formatPlanAmount(activePlan)}</div>
              <div className="text-sm text-muted-foreground">
                / {activePlan.interval_label.toLowerCase()}
              </div>
            </>
          )}
        </div>

        {/* Highlighted features */}
        {highlightedFeatures.length > 0 && (
          <HighlightedFeatures features={highlightedFeatures} />
        )}

        {/* CTA — trial mode shows single trial button, otherwise normal action */}
        {isTrialMode ? (
          <>
            <Button
              className="w-full"
              disabled={isTrialLoading}
              onClick={() => setIsTrialDialogOpen(true)}
            >
              Claim Bonus
            </Button>
            <TrialStartDialog
              open={isTrialDialogOpen}
              onOpenChange={setIsTrialDialogOpen}
              plan={activePlan}
              isPending={isTrialLoading}
              onConfirm={() => onStartTrial!(activePlan)}
            />
          </>
        ) : (
          <PlanButton
            action={action}
            isLoading={loadingPlanId === activePlan.id}
            onClick={() => onSelect(activePlan, action)}
          />
        )}

        {/* Inline note for cross-currency cases — explains why the CTA is disabled. */}
        {action === 'cross-currency' && currentData?.subscription && (
          <p className="text-xs text-muted-foreground text-center">
            Your current plan is billed in {currentData.subscription.currency}. Cancel it first
            to switch to a {activePlan.currency} plan.
          </p>
        )}

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

/** Derive the tier key from a plan slug (e.g. "basic-monthly" → "basic"). */
function getTierKeyFromSlug(plan: IPlan): string {
  if (plan.is_free) return 'free';
  // Prefer slug_base (currency-agnostic) over slug, then strip the interval suffix.
  const base = plan.slug_base ?? plan.slug;
  const parts = base.split('-');
  return parts.slice(0, -1).join('-');
}

/**
 * Determine what action the user can take on a plan. Comparisons use
 * `amount_minor` (integer minor units) — never the float decimal — so currency
 * units mix safely after a switch. Cross-currency targets short-circuit to a
 * dedicated action that explains the cancel-first requirement.
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
  // Cross-currency target — backend rejects upgrade attempts across currencies.
  if (currentPlan.currency !== plan.currency) return 'cross-currency';
  // Same currency — compare on minor units.
  if (plan.amount_minor > currentPlan.amount_minor) return 'upgrade';
  if (plan.amount_minor < currentPlan.amount_minor) return 'downgrade';
  return 'subscribe';
}

/******************************************************************************
                               Export default
******************************************************************************/

export default PlanCard;
export type { TPlanAction };
