'use client';

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, ReceiptText, RotateCw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import { extractPaymentRef, refValue } from '@/lib/utils/payment-callback';
import { SETTINGS_COLUMN } from '../SettingsList';
import { SettingsState } from '../SettingsState';
import { messagePacksQueries, useVerifyPurchase } from './queries';

/**
 * PaymentCallback — where the payment provider sends a v2 buyer back
 * (`/payg/callback?reference=…`, `?trxref=…` or `?tx_ref=…`).
 *
 * It verifies the reference once, then replaces itself with the Message packs
 * screen so Back does not re-verify. v1 has its own page at this address for
 * v1 buyers; this one exists because v1's sends the buyer on to v1's settings
 * with a client-side move, which would take a v2 buyer out of v2.
 *
 * A failure keeps the buyer here with the reason, a retry, and the way back,
 * because a charged card with no pack is the one outcome that must not be
 * silent.
 */
export function PaymentCallback() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const reference = useMemo(() => {
    const ref = extractPaymentRef(new URLSearchParams(searchParams.toString()));
    return ref ? refValue(ref) : null;
  }, [searchParams]);
  const verify = useVerifyPurchase();
  const started = useRef(false);

  // Verify once on arrival. This starts a request; it sets no React state, so
  // the React Compiler rule against setState in an effect does not apply.
  useEffect(() => {
    if (!reference || started.current) return;
    started.current = true;
    verify.mutate(reference, {
      onSuccess: (response) => {
        void queryClient.invalidateQueries({ queryKey: messagePacksQueries.all });
        toast.success(response.message || 'Message packs added');
        router.replace('/settings/message-packs');
      },
    });
  }, [reference, verify, queryClient, router]);

  if (!reference) {
    return (
      <div className={SETTINGS_COLUMN}>
        <SettingsState
          icon={ReceiptText}
          title="Nothing to confirm"
          description="This page confirms a payment when the payment provider sends you back. There is no payment reference in this address."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/settings/message-packs">Back to message packs</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (verify.isError) {
    const apiError = extractApiError(verify.error);
    const reason =
      apiError.status >= 400 && apiError.status < 500 && apiError.message
        ? `${apiError.message} `
        : '';
    return (
      <div className={SETTINGS_COLUMN}>
        <SettingsState
          icon={TriangleAlert}
          tone="alarm"
          title="We couldn't confirm this payment"
          description={`${reason}If you were charged, contact support with the reference below.`}
          action={
            <div className="flex flex-col items-center gap-3">
              <p className="rounded-lg bg-secondary px-3 py-1.5 font-mono text-xs text-muted-foreground select-all">
                {reference}
              </p>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/settings/message-packs">Back to message packs</Link>
                </Button>
                <Button size="sm" onClick={() => verify.mutate(reference)}>
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
    <div className={SETTINGS_COLUMN}>
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
