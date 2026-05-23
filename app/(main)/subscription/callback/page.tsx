'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

import { PageContainer } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { useVerifyPayment } from '@/lib/hooks/useSubscriptions';
import { extractPaymentRef } from '@/lib/utils/payment-callback';

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Verifies a Paystack payment after redirect.
 */
function SubscriptionCallbackPage() {
  return (
    <Suspense fallback={<VerifyingState />}>
      <CallbackContent />
    </Suspense>
  );
}

/**
 * Inner content that reads search params and triggers verification.
 */
function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Backend dispatches on the query-param NAME — Paystack via ?reference= /
  // ?trxref=, Flutterwave via ?tx_ref=. Extracting into a discriminated union
  // preserves which provider routed the redirect.
  const paymentRef = useMemo(
    () => extractPaymentRef(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );
  const verifyPayment = useVerifyPayment();
  const hasVerified = useRef(false);

  // Verify on mount
  useEffect(() => {
    if (!paymentRef || hasVerified.current) return;
    hasVerified.current = true;
    verifyPayment.mutate(paymentRef, {
      onSuccess: (data) => {
        toast.success(data.message || 'Subscription activated successfully!');
        router.replace('/settings/billing');
      },
      onError: () => {
        toast.error('Payment verification failed. Please contact support if you were charged.');
      },
    });
  }, [paymentRef, verifyPayment, router]);

  // No reference in URL
  if (!paymentRef) {
    return (
      <CallbackLayout
        icon={<XCircle className="size-8 text-destructive" />}
        title="Missing payment reference"
        description="No payment reference was found. Please try again from the pricing page."
      >
        <Button onClick={() => router.push('/pricing')}>Go to Pricing</Button>
      </CallbackLayout>
    );
  }

  // Error state
  if (verifyPayment.isError) {
    return (
      <CallbackLayout
        icon={<XCircle className="size-8 text-destructive" />}
        title="Verification failed"
        description="We couldn't verify your payment. If you were charged, please contact support."
      >
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push('/pricing')}>
            Back to Pricing
          </Button>
          <Button onClick={() => { hasVerified.current = false; verifyPayment.mutate(paymentRef); }}>
            Retry
          </Button>
        </div>
      </CallbackLayout>
    );
  }

  // Success state (brief flash before redirect)
  if (verifyPayment.isSuccess) {
    return (
      <CallbackLayout
        icon={<CheckCircle2 className="size-8 text-green-600" />}
        title="Payment verified!"
        description="Your subscription is now active. Redirecting..."
      />
    );
  }

  // Loading state
  return <VerifyingState />;
}

/**
 * Shared layout wrapper for callback states.
 */
function CallbackLayout(props: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  const { icon, title, description, children } = props;
  return (
    <PageContainer variant="detail">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 rounded-full bg-muted p-4">{icon}</div>
        <h1 className="text-xl font-semibold mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground max-w-md mb-6">{description}</p>
        {children}
      </div>
    </PageContainer>
  );
}

/**
 * Loading/verifying state.
 */
function VerifyingState() {
  return (
    <PageContainer variant="detail">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
        <h1 className="text-xl font-semibold mb-2">Verifying your payment...</h1>
        <p className="text-sm text-muted-foreground">
          Please wait while we confirm your transaction.
        </p>
      </div>
    </PageContainer>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default SubscriptionCallbackPage;
