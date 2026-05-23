'use client';

import { useState } from 'react';
import { Minus, Plus, Loader2, Globe } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import CurrencyPicker from '@/components/payments/CurrencyPicker';
import { usePurchaseMessagePack, useMessagePackPricing } from '@/lib/hooks/useMessagePacks';
import { useUserCurrency } from '@/lib/hooks/useUserCurrency';
import { extractApiError } from '@/lib/utils/api-error';
import { formatMoneyMajor } from '@/lib/utils/payment-format';

/******************************************************************************
                               Constants
******************************************************************************/

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 10;

/******************************************************************************
                               Types
******************************************************************************/

interface IPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Dialog for selecting quantity and initiating a message
 * pack purchase. Pricing is currency-aware and pulled from the backend.
 */
function PurchaseDialog(props: IPurchaseDialogProps) {
  const { open, onOpenChange } = props;
  const [quantity, setQuantity] = useState(1);

  const { currency, manualOverride, isDetecting } = useUserCurrency();
  const pricingQuery = useMessagePackPricing(currency);
  const purchaseMutation = usePurchaseMessagePack();

  const priceRow = pricingQuery.data?.data?.prices.find((p) => p.currency === currency);
  const messagesPerPack = pricingQuery.data?.data?.messages_per_pack ?? 10;
  const totalMessages = quantity * messagesPerPack;
  const totalPrice = priceRow ? priceRow.price_major * quantity : 0;

  /** Decrease quantity. */
  const decrement = () => setQuantity((q) => Math.max(MIN_QUANTITY, q - 1));

  /** Increase quantity. */
  const increment = () => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1));

  /** Handle purchase submission. */
  const handlePurchase = () => {
    purchaseMutation.mutate(
      { quantity, currency },
      {
        onSuccess: (data) => {
          if (data.success && data.data) {
            sessionStorage.setItem('payg_reference', data.data.reference);
            window.location.href = data.data.authorization_url;
          }
        },
        onError: (err) => {
          const apiError = extractApiError(err);
          toast.error(apiError.message);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>Buy Message Packs</DialogTitle>
            <CurrencyPicker
              currency={currency}
              isDetecting={isDetecting}
              manualOverride={manualOverride}
            />
          </div>
          <DialogDescription>
            {priceRow
              ? `Each pack contains ${messagesPerPack} AI messages for ${formatMoneyMajor(priceRow.price_major, currency)}. Messages never expire.`
              : 'Each pack contains AI messages that never expire.'}
          </DialogDescription>
        </DialogHeader>

        {/* Pricing not available — graceful empty state */}
        {pricingQuery.isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : !priceRow ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Globe className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Unavailable in {currency}</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Pay-as-you-go isn&apos;t currently available in {currency}. Switch currency above
              or check back soon.
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Quantity selector */}
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={decrement}
                disabled={quantity <= MIN_QUANTITY}
                className="h-10 w-10 rounded-full"
              >
                <Minus className="size-4" />
              </Button>
              <div className="text-center min-w-[80px]">
                <span className="text-4xl font-bold">{quantity}</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {quantity === 1 ? 'pack' : 'packs'}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={increment}
                disabled={quantity >= MAX_QUANTITY}
                className="h-10 w-10 rounded-full"
              >
                <Plus className="size-4" />
              </Button>
            </div>

            {/* Price summary */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Messages</span>
                <span className="font-medium">{totalMessages} messages</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price</span>
                <span className="font-semibold">{formatMoneyMajor(totalPrice, currency)}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={purchaseMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePurchase}
            disabled={!priceRow || purchaseMutation.isPending}
          >
            {purchaseMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Processing...
              </>
            ) : priceRow ? (
              `Pay ${formatMoneyMajor(totalPrice, currency)}`
            ) : (
              'Pay'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default PurchaseDialog;
