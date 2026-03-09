'use client';

import { useState } from 'react';
import { Minus, Plus, Loader2 } from 'lucide-react';
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
import { usePurchaseMessagePack } from '@/lib/hooks/useMessagePacks';
import { extractApiError } from '@/lib/utils/api-error';

/******************************************************************************
                               Constants
******************************************************************************/

const PRICE_PER_PACK = 2000;
const MESSAGES_PER_PACK = 10;
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
 * Default component. Dialog for selecting quantity and initiating a message pack purchase.
 */
function PurchaseDialog(props: IPurchaseDialogProps) {
  const { open, onOpenChange } = props;
  const [quantity, setQuantity] = useState(1);
  const purchaseMutation = usePurchaseMessagePack();

  const totalPrice = quantity * PRICE_PER_PACK;
  const totalMessages = quantity * MESSAGES_PER_PACK;

  /** Decrease quantity. */
  const decrement = () => setQuantity((q) => Math.max(MIN_QUANTITY, q - 1));

  /** Increase quantity. */
  const increment = () => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1));

  /** Handle purchase submission. */
  const handlePurchase = () => {
    purchaseMutation.mutate(quantity, {
      onSuccess: (data) => {
        if (data.success && data.data) {
          // Store reference for verification after redirect
          sessionStorage.setItem('payg_reference', data.data.reference);
          // Redirect to Paystack checkout
          window.location.href = data.data.authorization_url;
        }
      },
      onError: (err) => {
        const apiError = extractApiError(err);
        toast.error(apiError.message);
      },
    });
  };

  // Return
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Buy Message Packs</DialogTitle>
          <DialogDescription>
            Each pack contains {MESSAGES_PER_PACK} AI messages for ₦{PRICE_PER_PACK.toLocaleString()}.
            Messages never expire.
          </DialogDescription>
        </DialogHeader>

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
              <span className="font-semibold">₦{totalPrice.toLocaleString()}</span>
            </div>
          </div>
        </div>

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
            disabled={purchaseMutation.isPending}
          >
            {purchaseMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Pay ₦${totalPrice.toLocaleString()}`
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
