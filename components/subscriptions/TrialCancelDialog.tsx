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
import type { ITrialData } from '@/types/trial';

/******************************************************************************
                               Types
******************************************************************************/

interface ITrialCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trial: ITrialData | null;
  isPending: boolean;
  onConfirm: () => void;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Confirmation dialog for cancelling a free trial.
 */
function TrialCancelDialog(props: ITrialCancelDialogProps) {
  const { open, onOpenChange, trial, isPending, onConfirm } = props;
  const endsAt = trial?.trial_ends_at
    ? format(new Date(trial.trial_ends_at), 'MMMM d, yyyy')
    : 'the end of your trial period';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Free Trial</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to cancel your{' '}
            <span className="font-medium text-foreground">{trial?.plan.name}</span>{' '}
            trial? You&apos;ll continue to have access until{' '}
            <span className="font-medium text-foreground">{endsAt}</span>.
            After that, you&apos;ll be switched to the free plan. No charges will be made.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep Trial</AlertDialogCancel>
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
              'Cancel Trial'
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

export default TrialCancelDialog;
