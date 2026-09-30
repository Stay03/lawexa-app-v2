'use client';

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ReceiptText, RotateCw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { subscriptionsApi } from '@/lib/api/subscriptions';
import { trialApi } from '@/lib/api/trial';
import { extractApiError } from '@/lib/utils/api-error';
import { extractPaymentRef, refValue } from '@/lib/utils/payment-callback';
import type { PaymentVerifyRef } from '@/types/payment';
import { billingQueries } from '@/v2/features/settings/billing/queries';
import { SettingsState } from '@/v2/features/settings/SettingsState';
import { PRICING_COLUMN } from './states';

type Kind = 'subscribe' | 'upgrade' | 'trial';

const DONE: Record<Kind, string> = {
  subscribe: 'Your plan is active.',
  upgrade: 'Your plan is upgraded.',
  trial: 'Your free trial has started.',
};

/**
 * Where the payment provider sends a v2 buyer back after taking a plan:
 * `/subscription/callback` (a new plan), `/subscription/upgrade/callback` (an
 * upgrade) and `/trial/verify` (a free trial). The addresses are v1's own, set
 * by `lib/api` as the callback, so v2 claims them exactly and a v1 buyer keeps
 * v1's page (the same arrangement as `/payg/callback`).
 *
 * It verifies the reference once, then replaces itself with Billing so Back
 * does not verify again. A failure keeps the buyer here with the reason, the
 * reference, a retry and the way back: a charged card with no plan must never
 * be silent.
 */
export function PlanPaymentCallback({ kind }: { kind: Kind }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const ref = useMemo(
    () => extractPaymentRef(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const verify = useMutation({
    mutationFn: async (paymentRef: PaymentVerifyRef): Promise<{ message?: string }> => {
      if (kind === 'trial') return trialApi.verifyTrial(refValue(paymentRef));
      if (kind === 'upgrade') return subscriptionsApi.verifyUpgrade(paymentRef);
      return subscriptionsApi.verifyPayment(paymentRef);
    },
    meta: { silentError: true },
  });
  const started = useRef(false);

  // Verify once on arrival. This starts a request and sets no React state.
  useEffect(() => {
    if (!ref || started.current) return;
    started.current = true;
    verify.mutate(ref, {
      onSuccess: (response) => {
        void queryClient.invalidateQueries({ queryKey: billingQueries.all });
        toast.success(response.message || DONE[kind]);
        router.replace('/settings/billing');
      },
    });
  }, [ref, verify, queryClient, router, kind]);

  if (!ref) {
    return (
      <div className={PRICING_COLUMN}>
        <SettingsState
          icon={ReceiptText}
          title="Nothing to confirm"
          description="This page confirms a payment when the payment provider sends you back. There is no payment reference in this address."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/pricing">Back to plans</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (verify.isError) {
    const apiError = extractApiError(verify.error);
    const reason = apiError.status >= 400 && apiError.status < 500 && apiError.message ? `${apiError.message} ` : '';
    return (
      <div className={PRICING_COLUMN}>
        <SettingsState
          icon={TriangleAlert}
          tone="alarm"
          title="We couldn't confirm this payment"
          description={`${reason}If you were charged, contact support with the reference below.`}
          action={
            <div className="flex flex-col items-center gap-3">
              <p className="rounded-lg bg-secondary px-3 py-1.5 font-mono text-xs text-muted-foreground select-all">
                {refValue(ref)}
              </p>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/settings/billing">Go to billing</Link>
                </Button>
                <Button size="sm" onClick={() => verify.mutate(ref)}>
                  <RotateCw aria-hidden className="size-4" />
                  Try again
                </Button>
              </div>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className={PRICING_COLUMN}>
      <div
        role="status"
        className="flex flex-col items-center gap-3 px-6 py-16 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
      >
        <Loader2 aria-hidden className="size-8 animate-spin text-muted-foreground" />
        <p className="text-base font-semibold text-foreground">Confirming your payment</p>
        <p className="text-sm text-muted-foreground">This takes a few seconds. Please keep this page open.</p>
      </div>
    </div>
  );
}
