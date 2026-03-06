'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

import { PageContainer } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { useVerifyUpgrade } from '@/lib/hooks/useSubscriptions';

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Verifies a Paystack upgrade payment after redirect.
 */
function UpgradeCallbackPage() {
  return (
    <Suspense fallback={<VerifyingState />}>
      <UpgradeCallbackContent />
    </Suspense>
  );
}

/**
 * Inner content that reads search params and triggers upgrade verification.
 */
function UpgradeCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const verifyUpgrade = useVerifyUpgrade();
  const hasVerified = useRef(false);

  // Verify on mount
  useEffect(() => {
    if (!reference || hasVerified.current) return;
    hasVerified.current = true;
    verifyUpgrade.mutate(reference, {
      onSuccess: (data) => {
        toast.success(data.message || 'Plan upgraded successfully!');
        router.replace('/settings/billing');
      },
      onError: () => {
        toast.error('Upgrade verification failed. Please contact support if you were charged.');
      },
    });
  }, [reference, verifyUpgrade, router]);

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
  if (verifyUpgrade.isError) {
    return (
      <CallbackLayout
        icon={<XCircle className="size-8 text-destructive" />}
        title="Verification failed"
        description="We couldn't verify your upgrade payment. If you were charged, please contact support."
      >
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push('/pricing')}>
            Back to Pricing
          </Button>
          <Button onClick={() => { hasVerified.current = false; verifyUpgrade.mutate(reference); }}>
            Retry
          </Button>
        </div>
      </CallbackLayout>
    );
  }

  // Success state (brief flash before redirect)
  if (verifyUpgrade.isSuccess) {
    return (
      <CallbackLayout
        icon={<CheckCircle2 className="size-8 text-green-600" />}
        title="Upgrade verified!"
        description="Your plan has been upgraded. Redirecting..."
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
        <h1 className="text-xl font-semibold mb-2">Verifying your upgrade...</h1>
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

export default UpgradeCallbackPage;
