'use client';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
import { extractApiError } from '@/lib/utils/api-error';
import type { CancelKind } from './model';
import { useCancelPlan } from './queries';

/**
 * The confirmation before cancelling a plan or a free trial. The last day it
 * names is read from the server's answer (see BillingScreen); the page adds no
 * promise the server has not confirmed.
 */
export function CancelPlanDialog({
  kind,
  planName,
  lastDay,
  onClose,
}: {
  /** `null` while closed. */
  kind: CancelKind;
  planName: string;
  /** The date the plan or trial stays active until, already formatted, or null. */
  lastDay: string | null;
  onClose: () => void;
}) {
  const cancel = useCancelPlan();
  const busy = cancel.isPending;
  const apiError = cancel.error ? extractApiError(cancel.error) : null;
  const errorMessage = apiError
    ? apiError.status >= 400 && apiError.status < 500
      ? apiError.message
      : "Couldn't cancel. Try again."
    : null;

  // Wording checked against the backend on 28 September 2026 (77e42c2e):
  // cancelling keeps access until the last day, then the free plan's limits
  // apply; a trial ends on its date and does not renew. "You will not be
  // charged" is NOT promised: a failed call to the payment provider is only
  // logged, and the cancel still completes.
  const isTrial = kind === 'trial';
  const title = isTrial ? 'Cancel your free trial?' : `Cancel ${planName}?`;
  const description = isTrial
    ? lastDay
      ? `Your trial ends on ${lastDay} and will not renew.`
      : 'Your trial will not renew.'
    : lastDay
      ? `Your plan will not renew. You keep ${planName} until ${lastDay}; after that, the free plan's limits apply.`
      : "Your plan will not renew. After it ends, the free plan's limits apply.";

  const close = () => {
    cancel.reset();
    onClose();
  };

  return (
    <AlertDialog
      open={kind !== null}
      onOpenChange={(next) => {
        if (!next && !busy) close();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {errorMessage ? (
          <p
            role="alert"
            className="text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            {errorMessage}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{isTrial ? 'Keep trial' : 'Keep plan'}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={(event) => {
              event.preventDefault();
              if (!kind || busy) return;
              cancel.mutate(kind, {
                onSuccess: (response) => {
                  toast.success(response.message || (isTrial ? 'Trial cancelled' : 'Plan cancelled'));
                  close();
                },
              });
            }}
          >
            {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
            {isTrial ? 'Cancel trial' : 'Cancel plan'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
