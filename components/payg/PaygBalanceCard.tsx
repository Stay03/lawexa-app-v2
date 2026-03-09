'use client';

import { useState } from 'react';
import { MessageSquare, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { usePaygBalance } from '@/lib/hooks/useMessagePacks';
import PurchaseDialog from '@/components/payg/PurchaseDialog';

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Shows the user's PAYG message balance with a buy button.
 */
function PaygBalanceCard() {
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const balanceQuery = usePaygBalance();

  // Loading
  if (balanceQuery.isLoading) {
    return (
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
    );
  }

  // Error
  if (balanceQuery.isError) {
    return (
      <ErrorState
        title="Failed to load balance"
        description="We couldn't load your PAYG message balance."
        retry={() => balanceQuery.refetch()}
      />
    );
  }

  const balance = balanceQuery.data?.data?.payg_remaining ?? 0;

  // Return
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <MessageSquare className="size-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">PAYG Messages</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              You have{' '}
              <span className="font-semibold text-foreground">{balance}</span>{' '}
              {balance === 1 ? 'message' : 'messages'} remaining.
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              PAYG messages never expire and are used after your plan messages run out.
            </p>
          </div>
        </div>
        <Button onClick={() => setIsPurchaseOpen(true)}>
          <Plus className="size-4" />
          Buy Messages
        </Button>
      </div>

      <PurchaseDialog
        open={isPurchaseOpen}
        onOpenChange={setIsPurchaseOpen}
      />
    </>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default PaygBalanceCard;
