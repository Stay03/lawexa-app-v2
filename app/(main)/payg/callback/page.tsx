'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

import { PageContainer } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { useVerifyMessagePack } from '@/lib/hooks/useMessagePacks';

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Verifies a PAYG message pack Paystack payment after redirect.
 */
function PaygCallbackPage() {
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
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const verifyMutation = useVerifyMessagePack();
  const hasVerified = useRef(false);

  // Verify on mount
  useEffect(() => {
    if (!reference || hasVerified.current) return;
    hasVerified.current = true;
    verifyMutation.mutate(reference, {
      onSuccess: (data) => {
        toast.success(data.message || 'Message pack purchased successfully!');
        router.replace('/settings/message-packs');
      },
      onError: () => {
        toast.error('Payment verification failed. Please contact support if you were charged.');
      },
    });
  }, [reference, verifyMutation, router]);

  // No reference in URL
  if (!reference) {
    return (
      <CallbackLayout
        icon={<XCircle className="size-8 text-destructive" />}
        title="Missing payment reference"
        description="No payment reference was found. Please try again from the message packs page."
      >
        <Button onClick={() => router.push('/settings/message-packs')}>
          Go to Message Packs
        </Button>
      </CallbackLayout>
    );
  }

  // Error state
  if (verifyMutation.isError) {
    return (
      <CallbackLayout
        icon={<XCircle className="size-8 text-destructive" />}
        title="Verification failed"
        description="We couldn't verify your payment. If you were charged, please contact support."
      >
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push('/settings/message-packs')}>
            Back to Message Packs
          </Button>
          <Button onClick={() => { hasVerified.current = false; verifyMutation.mutate(reference); }}>
            Retry
          </Button>
        </div>
      </CallbackLayout>
    );
  }

  // Success state (brief flash before redirect)
  if (verifyMutation.isSuccess) {
    return (
      <CallbackLayout
        icon={<CheckCircle2 className="size-8 text-green-600" />}
        title="Payment verified!"
        description="Your messages have been credited. Redirecting..."
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

export default PaygCallbackPage;
