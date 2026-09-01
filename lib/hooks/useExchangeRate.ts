'use client';

import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { useAdminSettings } from '@/lib/hooks/useAdmin';

/**
 * The rate used to show dollar AI costs in naira, and where it came from.
 *
 * ── WHY THE SOURCE IS RETURNED AND NOT JUST THE NUMBER ────────────────────
 * Three things can supply this number and they carry different authority. The
 * server setting is the real answer. A manual override is one person exploring
 * a what-if in one browser. The fallback is us guessing because the setting has
 * not arrived yet. A screen showing ₦780,000 of spend should be able to say
 * which of those three produced it, because the difference between "the rate
 * finance set" and "a number I typed on Tuesday" is the difference between a
 * figure you can forward and one you cannot.
 */
export interface ExchangeRateInfo {
  /** The rate to multiply dollars by. Always a usable positive number. */
  rate: number;
  source: 'server' | 'manual' | 'fallback';
  /** What the server says, when it has said anything. */
  serverRate: number | null;
  /** True while the setting is still being fetched. */
  isLoading: boolean;
}

/**
 * Used only until the setting arrives, and only so a cost never renders as
 * NaN or zero mid-load. It is the number this app hardcoded for months, so
 * falling back to it cannot be worse than what these screens did before — but
 * it IS a guess, which is why `source` says so rather than claiming 'server'.
 */
const FALLBACK_RATE = 1500;

const RATE_SETTING_KEY = 'usd_to_ngn_display_rate';

export function useExchangeRate(): ExchangeRateInfo {
  /* Primitive selector on purpose: returning a fresh object from a zustand
     selector re-renders forever through useSyncExternalStore. */
  const manualRate = useCurrencyStore((s) => s.manualRate);

  const query = useAdminSettings({ group: 'pricing' });

  const found = query.data?.data?.find((s) => s.key === RATE_SETTING_KEY);
  const parsed = toPositiveNumber(found?.value);

  if (manualRate !== null && manualRate > 0) {
    return {
      rate: manualRate,
      source: 'manual',
      serverRate: parsed,
      isLoading: query.isPending,
    };
  }

  if (parsed !== null) {
    return {
      rate: parsed,
      source: 'server',
      serverRate: parsed,
      isLoading: false,
    };
  }

  return {
    rate: FALLBACK_RATE,
    source: 'fallback',
    serverRate: null,
    isLoading: query.isPending,
  };
}

/**
 * Settings values are loosely typed, and this one has arrived as a number and
 * could arrive as a string. Anything that is not a usable positive rate returns
 * null so the caller falls through, rather than producing a zero that would
 * silently render every cost as ₦0.00.
 */
function toPositiveNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}
