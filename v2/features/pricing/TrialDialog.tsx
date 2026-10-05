'use client';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DialogClose } from '@/components/ui/dialog';
import { formatPlanAmount } from '@/lib/utils/payment-format';
import type { IPlan } from '@/types/subscription';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { perPeriod, tierName } from './model';

/**
 * TrialDialog — what a free trial costs before Paystack's card check opens.
 *
 * v1's dialog said "₦100" and "30-day". Both are server settings
 * (`trial_tokenization_amount`, `trial_duration_days`, docs/apiDocs/trial-api.md)
 * that `/trial/eligibility` does not return, so a changed setting would make
 * them false with nothing on the page to notice. The dialog says what holds
 * whatever they are set to: a small card check that is refunded, and the
 * plan's price, read from the plan, once the trial ends.
 *
 * The plan stays rendered while the dialog closes, so the sheet leaves with
 * its words still on it.
 */
export function TrialDialog({
  open,
  plan,
  busy,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  plan: IPlan | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      title="Start your free trial"
      size="content"
      footer={
        <div className="flex gap-2.5">
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={busy} className="flex-1 md:w-auto md:flex-none">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={busy || !plan}
            aria-busy={busy || undefined}
            className="flex-1 md:w-auto md:flex-none"
          >
            {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
            Continue to Paystack
          </Button>
        </div>
      }
    >
      {plan ? (
        <div className="flex flex-col gap-3 pb-1 text-[15px] leading-relaxed text-muted-foreground">
          <p>
            Paystack takes a small charge to check your card, and it is refunded once the card is
            confirmed.
          </p>
          <p>
            When the free trial of <span className="font-medium text-foreground">{tierName(plan)}</span> ends,
            the plan costs{' '}
            <span className="font-medium text-foreground tabular-nums">
              {formatPlanAmount(plan)} {perPeriod(plan)}
            </span>
            . You can cancel the trial in Billing before then.
          </p>
        </div>
      ) : null}
    </ResponsiveOverlay>
  );
}
