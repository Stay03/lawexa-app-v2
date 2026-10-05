'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { extractApiError } from '@/lib/utils/api-error';
import { formatMoneyMajor } from '@/lib/utils/payment-format';
import type { IMessagePackPricingData } from '@/types/message-pack';
import type { TCurrency } from '@/types/payment';
import { currencyName, currencyOffer } from '@/v2/features/settings/message-packs/currency-offer';
import { usePurchasePacks } from '@/v2/features/settings/message-packs/queries';
import { setCurrency, useCurrency } from '@/v2/runtime/currency';
import { PACK_QUANTITIES, REGISTER_HREF, SIGN_IN_HREF, packLines, packOptionLabel } from './model';
import { SegmentedChoice } from './SegmentedChoice';

/**
 * The Pay as you go tab: v1's pack card (`app/(main)/pricing/page.tsx`), word
 * for word, laid out as one panel. The offer sits on the left (what a pack is,
 * what it costs, v1's four lines); the purchase sits on the right on its own
 * surface (how many packs, the total, Buy).
 *
 * The purchase is the call Settings' Buy panel makes, with the same arguments
 * (`usePurchasePacks`, quantity and currency), and the browser leaves for the
 * provider, which returns to `/payg/callback`. A guest reads the price and is
 * asked to sign in where Buy would be: packs are bought on an account.
 */
export function PayAsYouGoPanel({
  pricing,
  viewer,
}: {
  pricing: IMessagePackPricingData;
  viewer: 'account' | 'guest';
}) {
  const { currency: stored } = useCurrency();
  const { offered, currency } = currencyOffer(pricing, stored);
  const priceRow = pricing.prices.find((row) => row.currency === currency) ?? null;
  if (!priceRow) return null;

  return (
    <section
      aria-labelledby="payg-title"
      className="grid overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 @3xl/pricing:grid-cols-[1.15fr_1fr]"
    >
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-1.5">
          <h2 id="payg-title" className="pricing-heading text-2xl text-foreground">
            Pay As You Go
          </h2>
          <p className="text-sm text-muted-foreground">One-time purchase</p>
        </div>
        <p className="flex items-baseline gap-2">
          <span className="text-base text-muted-foreground">from</span>
          <span className="pricing-figure text-5xl text-foreground">
            {formatMoneyMajor(priceRow.price_major, currency)}
          </span>
        </p>
        <ul className="flex flex-col gap-2.5">
          {packLines(pricing.messages_per_pack).map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-[15px] leading-snug text-foreground">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col justify-center gap-4 border-t border-foreground/10 bg-secondary/60 p-6 sm:p-8 @3xl/pricing:border-t-0 @3xl/pricing:border-l">
        {viewer === 'account' ? (
          <PackPurchase
            pricePerPack={priceRow.price_major}
            messagesPerPack={pricing.messages_per_pack}
            currency={currency}
            offered={offered}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-[15px] leading-snug text-foreground">Sign in to buy message packs.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="h-11 flex-1 md:h-10">
                <Link href={SIGN_IN_HREF}>Sign in</Link>
              </Button>
              <Button asChild variant="outline" className="h-11 flex-1 md:h-10">
                <Link href={REGISTER_HREF}>Create an account</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PackPurchase({
  pricePerPack,
  messagesPerPack,
  currency,
  offered,
}: {
  pricePerPack: number;
  messagesPerPack: number;
  currency: TCurrency;
  offered: readonly TCurrency[];
}) {
  const [quantity, setQuantity] = useState(1);
  const purchase = usePurchasePacks();
  const total = pricePerPack * quantity;
  // Busy from the press until the browser leaves for the checkout.
  const busy = purchase.isPending || purchase.isSuccess;
  const apiError = purchase.error ? extractApiError(purchase.error) : null;

  const buy = () => {
    if (busy) return;
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
    <>
      {offered.length > 1 ? (
        <SegmentedChoice<TCurrency>
          name="pack-currency"
          legend="Currency"
          value={currency}
          options={offered.map((option) => ({
            value: option,
            label: currencyName(option),
            hint: null,
          }))}
          onChange={setCurrency}
        />
      ) : null}
      <Select value={String(quantity)} onValueChange={(value) => setQuantity(Number(value))} disabled={busy}>
        <SelectTrigger aria-label="Number of packs" className="h-11 w-full bg-background md:h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PACK_QUANTITIES.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {packOptionLabel(n, messagesPerPack)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        className="h-12 w-full text-base md:h-11"
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={buy}
      >
        {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
        {`Buy ${formatMoneyMajor(total, currency)}`}
      </Button>
      <p className="text-center text-[13px] leading-snug text-muted-foreground tabular-nums">
        {quantity * messagesPerPack} messages total
      </p>
      {apiError ? (
        <p role="alert" className="text-center text-[13px] leading-snug text-destructive">
          {apiError.status >= 400 && apiError.status < 500 ? apiError.message : "Couldn't start the payment. Try again."}
        </p>
      ) : null}
    </>
  );
}
