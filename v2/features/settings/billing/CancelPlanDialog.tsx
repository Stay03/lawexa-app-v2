'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { CancellationReason } from '@/types/feedback';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

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
import { CANCEL_DETAILS_MAX, CANCEL_REASONS, cancelReasonReady, type CancelKind } from './model';
import { useCancelPlan, useSendCancellationFeedback } from './queries';

/**
 * The confirmation before cancelling a plan or a free trial. The last day it
 * names is read from the server's answer (see BillingScreen); the page adds no
 * promise the server has not confirmed.
 *
 * Once a PAID plan's cancel has succeeded, the same dialog asks "Why are you
 * cancelling?" (Arthur, 28 October 2026, "B plus A"): four one-tap reasons, a
 * few optional words (needed for Other), Send or Skip. The cancel is done
 * before the question appears and nothing in it can hold or undo the cancel;
 * closing the dialog is a Skip. A trial's cancel asks nothing.
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
  // The paid plan is cancelled: the dialog now asks why.
  const [asking, setAsking] = useState(false);
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
    setAsking(false);
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
        {asking ? (
          <CancelReasonStep onDone={close} />
        ) : (
          <>
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
                  if (isTrial) close();
                  else setAsking(true);
                },
              });
            }}
          >
            {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
            {isTrial ? 'Cancel trial' : 'Cancel plan'}
          </AlertDialogAction>
        </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** What the server's answers mean here: saved, or already given (409), or no cancelled plan to answer for. */
const THANKS = 'Thanks for telling us why you cancelled.';

/**
 * "Why are you cancelling?" One tap picks a reason; the words are optional
 * except for Other; Send saves it, Skip leaves. A 409 (already told us for
 * this plan) and a 422 that there is no cancelled plan both end the step: the
 * reader has nothing left to do. A missing or over-long answer says so in
 * place; any other failure says "Couldn't send that" and keeps what they wrote.
 */
function CancelReasonStep({ onDone }: { onDone: () => void }) {
  const [reason, setReason] = useState<CancellationReason | null>(null);
  const [details, setDetails] = useState('');
  const send = useSendCancellationFeedback();
  const sending = send.isPending;
  const apiError = send.error ? extractApiError(send.error) : null;
  const fieldError = apiError?.status === 422 && apiError.errors
    ? Object.values(apiError.errors).flat()[0] ?? apiError.message
    : null;
  const error = fieldError ?? (apiError ? 'Couldn’t send that. Try again.' : null);
  const needsWords = reason === 'other';
  const left = CANCEL_DETAILS_MAX - details.trim().length;

  const submit = () => {
    if (!reason || !cancelReasonReady(reason, details) || sending) return;
    send.mutate(
      { reason, details: details.trim() || undefined },
      {
        onSuccess: (response) => {
          toast.success(response.message || THANKS);
          onDone();
        },
        onError: (failure) => {
          const { status, errors } = extractApiError(failure);
          // Already told us, or nothing to tell us about: the step is done.
          if (status === 409 || (status === 422 && !errors)) onDone();
        },
      },
    );
  };

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Why are you cancelling?</AlertDialogTitle>
        <AlertDialogDescription>Your plan is cancelled. This is optional and helps us improve Lawexa.</AlertDialogDescription>
      </AlertDialogHeader>

      <div role="group" aria-label="Reasons" className="grid gap-2 sm:grid-cols-2">
        {CANCEL_REASONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={reason === key}
            disabled={sending}
            onClick={() => setReason(key)}
            className={cn(
              'v2-interactive flex min-h-11 items-center rounded-xl border px-3.5 text-left text-sm font-medium transition-colors disabled:opacity-50',
              reason === key
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border hover:bg-secondary',
              FOCUS_RING,
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cancel-details" className="text-sm text-muted-foreground">
          {needsWords ? 'Tell us a little more' : 'Anything else? (optional)'}
        </label>
        <Textarea
          id="cancel-details"
          rows={3}
          maxLength={CANCEL_DETAILS_MAX}
          value={details}
          disabled={sending}
          onChange={(event) => setDetails(event.target.value)}
          aria-invalid={error ? true : undefined}
          className="min-h-20 resize-none text-base sm:text-sm"
        />
        {left < 200 ? (
          <p className="text-right text-xs text-muted-foreground tabular-nums">{left} characters left</p>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          {error}
        </p>
      ) : null}

      <AlertDialogFooter>
        <Button type="button" variant="outline" disabled={sending} onClick={onDone}>
          Skip
        </Button>
        <Button
          type="button"
          disabled={sending || !cancelReasonReady(reason, details)}
          aria-busy={sending || undefined}
          onClick={submit}
        >
          {sending ? <Loader2 aria-hidden className="animate-spin" /> : null}
          Send
        </Button>
      </AlertDialogFooter>
    </>
  );
}
