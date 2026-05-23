'use client';

import { Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatPlanAmount } from '@/lib/utils/payment-format';
import type { IPlan } from '@/types/subscription';

/******************************************************************************
                               Types
******************************************************************************/

interface ITrialStartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: IPlan | null;
  isPending: boolean;
  onConfirm: () => void;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Confirmation dialog before starting a free trial.
 * Trials are Paystack/NGN-only in v1; the caller gates non-NGN plans out.
 */
function TrialStartDialog(props: ITrialStartDialogProps) {
  const { open, onOpenChange, plan, isPending, onConfirm } = props;

  const planName = plan?.name ?? 'this plan';
  const formattedPrice = plan ? formatPlanAmount(plan) : '';
  const interval = plan?.interval_label?.toLowerCase() ?? 'month';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start Free Trial</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                A{' '}
                <span className="font-medium text-foreground">₦100</span>{' '}
                charge will be made to verify your card. This amount will be{' '}
                <span className="font-medium text-foreground">refunded instantly</span>.
              </p>
              <p>
                After your 30-day free trial of{' '}
                <span className="font-medium text-foreground">{planName}</span>,
                you&apos;ll be charged{' '}
                <span className="font-medium text-foreground">
                  {formattedPrice}/{interval}
                </span>.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Continue to Payment'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default TrialStartDialog;
