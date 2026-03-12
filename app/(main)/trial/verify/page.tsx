'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

import { PageContainer } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { useVerifyTrial } from '@/lib/hooks/useTrial';

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Verifies a trial tokenization payment after Paystack redirect.
 */
function TrialVerifyPage() {
  return (
    <Suspense fallback={<VerifyingState />}>
      <TrialVerifyContent />
    </Suspense>
  );
}

/**
 * Inner content that reads search params and triggers trial verification.
 */
function TrialVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const verifyTrial = useVerifyTrial();
  const hasVerified = useRef(false);

  // Verify on mount
  useEffect(() => {
    if (!reference || hasVerified.current) return;
    hasVerified.current = true;
    verifyTrial.mutate(reference, {
      onSuccess: (data) => {
        toast.success(data.message || 'Your free trial is now active!');
        router.replace('/settings/billing');
      },
      onError: () => {
        toast.error('Trial verification failed. The ₦100 charge will be refunded.');
      },
    });
  }, [reference, verifyTrial, router]);

  // No reference in URL
  if (!reference) {
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
  if (verifyTrial.isError) {
    return (
      <CallbackLayout
        icon={<XCircle className="size-8 text-destructive" />}
        title="Verification failed"
        description="We couldn't verify your trial payment. The ₦100 tokenization charge will be refunded."
      >
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push('/pricing')}>
            Back to Pricing
          </Button>
          <Button onClick={() => { hasVerified.current = false; verifyTrial.mutate(reference); }}>
            Retry
          </Button>
        </div>
      </CallbackLayout>
    );
  }

  // Success state (brief flash before redirect)
  if (verifyTrial.isSuccess) {
    return (
      <CallbackLayout
        icon={<CheckCircle2 className="size-8 text-green-600" />}
        title="Trial activated!"
        description="Your free trial is now active. Redirecting to billing..."
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
        <h1 className="text-xl font-semibold mb-2">Verifying your trial...</h1>
        <p className="text-sm text-muted-foreground">
          Please wait while we confirm your payment and activate your trial.
        </p>
      </div>
    </PageContainer>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default TrialVerifyPage;
