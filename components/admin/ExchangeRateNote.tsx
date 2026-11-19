'use client';

import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { useExchangeRate } from '@/lib/hooks/useExchangeRate';

/**
 * The naira rate in force, read only.
 *
 * ── ONE RATE, SET IN ONE PLACE ──────────────────────────────────────────────
 * Stay, 19 November 2026 (thread "Plus fair use, cost alert, cost per reply"):
 * one naira-to-dollar rate, set in admin settings, used everywhere. Each admin
 * could once type their own rate here for this browser; that is gone, so every
 * naira figure on every admin screen is the same rate, the one in Billing
 * settings. This line says what that rate is and where to change it.
 */
export function ExchangeRateNote() {
  const { rate, source, isLoading } = useExchangeRate();

  if (isLoading) return <Skeleton className="h-4 w-40" />;

  if (source === 'fallback') {
    // The setting could not be read. Saying so beats printing a number as
    // though somebody chose it.
    return (
      <p className="text-xs text-muted-foreground">
        Settings could not be read, showing ₦{rate.toLocaleString()} to the dollar.
      </p>
    );
  }

  return (
    <p className="text-xs text-muted-foreground">
      $1 = ₦{rate.toLocaleString()}, set in{' '}
      <Link href="/admin/billing/settings" className="text-foreground underline underline-offset-2">
        Billing settings
      </Link>
      .
    </p>
  );
}
