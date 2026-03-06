'use client';

import { format } from 'date-fns';
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
import type { ISubscription } from '@/types/subscription';

/******************************************************************************
                               Types
******************************************************************************/

interface ICancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: ISubscription | null;
  isPending: boolean;
  onConfirm: () => void;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Confirmation dialog for cancelling a subscription.
 */
function CancelDialog(props: ICancelDialogProps) {
  const { open, onOpenChange, subscription, isPending, onConfirm } = props;
  const endsAt = subscription?.next_payment_date
    ? format(new Date(subscription.next_payment_date), 'MMMM d, yyyy')
    : 'the end of your billing period';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to cancel your <span className="font-medium text-foreground">{subscription?.plan.name}</span> plan?
            You&apos;ll continue to have access until{' '}
            <span className="font-medium text-foreground">{endsAt}</span>.
            After that, you&apos;ll be switched to the free plan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep Plan</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              'Cancel Subscription'
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

export default CancelDialog;
