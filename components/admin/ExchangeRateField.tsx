'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { useExchangeRate } from '@/lib/hooks/useExchangeRate';

/**
 * The USD to NGN rate control, shared by both places that offer one.
 *
 * ── IT HAS TO SAY WHOSE NUMBER IT IS ──────────────────────────────────────
 * This box used to show a number with no provenance. It was 1,500 for everyone
 * because 1,500 was written into the source, and an admin typing 1,700 into it
 * changed their own browser and nothing else — but the box looked exactly the
 * same either way. Someone reading ₦780,000 of spend had no way to tell whether
 * that came from the rate finance set or from a number a colleague typed once.
 *
 * So the field now states which of the two is in force, and offers the way back
 * when it is the override. The setting is the shared answer; the override is a
 * private what-if.
 */
export function ExchangeRateField({ id = 'exchange-rate' }: { id?: string }) {
  const setManualRate = useCurrencyStore((s) => s.setManualRate);
  const clearManualRate = useCurrencyStore((s) => s.clearManualRate);
  const { rate, source, serverRate, isLoading } = useExchangeRate();

  /* Null means "show whatever is in force". Once the admin types, this holds
     what they typed, INCLUDING while it is briefly empty or invalid — a
     controlled input that refuses an empty string cannot be cleared to be
     retyped. Nothing is committed to the store until it parses. */
  const [draft, setDraft] = useState<string | null>(null);

  if (isLoading && source === 'fallback') {
    return (
      <div className="space-y-2">
        <Label className="text-sm">USD to NGN rate</Label>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-3 w-40" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm">
        USD to NGN rate
      </Label>
      <Input
        id={id}
        type="number"
        min={1}
        step={1}
        value={draft ?? String(rate)}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          const parsed = Number(next);
          if (Number.isFinite(parsed) && parsed > 0) setManualRate(parsed);
        }}
        className="h-9"
      />

      {source === 'manual' ? (
        <div className="space-y-1.5">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Your override, on this device only.
            {serverRate !== null
              ? ` Settings say ₦${serverRate.toLocaleString()}.`
              : ''}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              clearManualRate();
              setDraft(null);
            }}
          >
            Use the settings rate
          </Button>
        </div>
      ) : source === 'server' ? (
        <p className="text-xs text-muted-foreground">
          From settings. $1 = ₦{rate.toLocaleString()}.
        </p>
      ) : (
        /* The setting could not be read. Saying so beats printing a number as
           though somebody chose it. */
        <p className="text-xs text-muted-foreground">
          Settings could not be read, showing ₦{rate.toLocaleString()}.
        </p>
      )}
    </div>
  );
}
