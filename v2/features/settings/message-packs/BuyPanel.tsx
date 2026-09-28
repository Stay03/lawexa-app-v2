'use client';

import { useState } from 'react';
import { Loader2, Minus, Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DialogClose } from '@/components/ui/dialog';
import { extractApiError } from '@/lib/utils/api-error';
import { formatMoneyMajor } from '@/lib/utils/payment-format';
import type { IMessagePackPricingData } from '@/types/message-pack';
import type { TCurrency } from '@/types/payment';
import { setCurrency, useCurrency } from '@/v2/runtime/currency';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { currencyOffer } from './currency-offer';
import { usePurchasePacks } from './queries';

const MIN_PACKS = 1;
/** v1's limit, kept: the purchase endpoint was written against it. */
const MAX_PACKS = 10;

/**
 * BuyPanel — how many packs, in which currency, and Pay.
 *
 * Every number on it comes from `GET /message-packs/pricing` (pack size and
 * the price per currency); the only arithmetic is quantity times price. Pay
 * starts a payment session and sends the browser to the provider's checkout
 * (Paystack for NGN, Flutterwave for USD, chosen by the backend); the provider
 * returns it to `/payg/callback`, which verifies and comes back here.
 *
 * The currency switch is a deliberate choice, so it is stored as one
 * (`v2/runtime/currency.ts`, shared with v1). It lists only the currencies
 * the pricing offers this buyer (dollars only outside Nigeria), and when only
 * one is offered there is no switch at all, just the currency named.
 */
export function BuyPanel({
  open,
  onOpenChange,
  pricing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pricing: IMessagePackPricingData | null;
}) {
  const { currency: stored } = useCurrency();
  const { offered, currency } = currencyOffer(pricing, stored);
  const [quantity, setQuantity] = useState(MIN_PACKS);
  const purchase = usePurchasePacks();

  const perPack = pricing?.messages_per_pack ?? null;
  const priceRow = pricing?.prices.find((row) => row.currency === currency) ?? null;
  const total = priceRow ? priceRow.price_major * quantity : null;
  // Busy from the press until the browser leaves for the checkout.
  const busy = purchase.isPending || purchase.isSuccess;

  const apiError = purchase.error ? extractApiError(purchase.error) : null;
  const errorMessage = apiError
    ? apiError.status >= 400 && apiError.status < 500
      ? apiError.message
      : "Couldn't start the payment. Try again."
    : null;

  const handleOpenChange = (next: boolean) => {
    if (busy) return;
    if (!next) {
      setQuantity(MIN_PACKS);
      purchase.reset();
    }
    onOpenChange(next);
  };

  const pay = () => {
    if (busy || !priceRow) return;
    purchase.mutate(
      { quantity, currency },
      {
        onSuccess: (response) => {
          const url = response.data?.authorization_url;
          if (url) window.location.assign(url);
        },
      },
    );
  };

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={handleOpenChange}
      title="Buy message packs"
      description={
        perPack ? `Each pack adds ${perPack} AI messages to your balance.` : undefined
      }
      size="content"
      footer={
        <div className="flex gap-2.5">
          <DialogClose asChild>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              className="flex-1 md:w-auto md:flex-none"
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={pay}
            disabled={busy || total === null}
            aria-busy={busy || undefined}
            className="flex-1 md:w-auto md:flex-none"
          >
            {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
            {total === null ? 'Pay' : `Pay ${formatMoneyMajor(total, currency)}`}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 pb-1">
        {/* Quantity */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[15px] leading-snug font-medium text-foreground">
              {quantity} {quantity === 1 ? 'pack' : 'packs'}
            </p>
            {perPack ? (
              <p className="text-[13px] leading-snug text-muted-foreground">
                {quantity * perPack} messages
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="One pack fewer"
              disabled={busy || quantity <= MIN_PACKS}
              onClick={() => setQuantity((q) => Math.max(MIN_PACKS, q - 1))}
            >
              <Minus aria-hidden />
            </Button>
            <span aria-live="polite" className="w-8 text-center text-lg font-semibold tabular-nums">
              {quantity}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="One pack more"
              disabled={busy || quantity >= MAX_PACKS}
              onClick={() => setQuantity((q) => Math.min(MAX_PACKS, q + 1))}
            >
              <Plus aria-hidden />
            </Button>
          </div>
        </div>

        {/* Currency: a switch only when there is a choice to make. */}
        {offered.length > 1 ? (
          <div role="radiogroup" aria-label="Currency" className="grid grid-cols-2 gap-2">
            {offered.map((option) => {
              const row = pricing?.prices.find((p) => p.currency === option) ?? null;
              const selected = option === currency;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={busy}
                  onClick={() => setCurrency(option)}
                  className={cn(
                    'v2-interactive flex flex-col items-start rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-150 motion-reduce:transition-none',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-foreground/[0.04]',
                  )}
                >
                  <span className="text-[15px] leading-snug font-medium text-foreground">
                    {currencyName(option)}
                  </span>
                  {row ? (
                    <span className="text-[13px] leading-snug text-muted-foreground tabular-nums">
                      {formatMoneyMajor(row.price_major, option)} per pack
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : priceRow ? (
          <p className="text-[13px] leading-snug text-muted-foreground">
            Priced in {currencyName(currency)}: {formatMoneyMajor(priceRow.price_major, currency)} per pack.
          </p>
        ) : null}

        {errorMessage ? (
          <p
            role="alert"
            className="text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            {errorMessage}
          </p>
        ) : null}
      </div>
    </ResponsiveOverlay>
  );
}

function currencyName(currency: TCurrency): string {
  return currency === 'NGN' ? 'Naira' : 'US dollars';
}
