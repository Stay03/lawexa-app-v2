'use client';

import { useAdminSettings } from '@/lib/hooks/useAdmin';

/**
 * The rate used to show dollar AI costs in naira, and where it came from.
 *
 * ── ONE RATE, FROM SETTINGS ───────────────────────────────────────────────
 * Stay, 19 November 2026: one naira-to-dollar rate, set in admin settings
 * (`usd_to_ngn_display_rate`), used everywhere. The per-admin override this
 * hook once preferred is gone, so every admin screen shows the same figure.
 *
 * ── WHY THE SOURCE IS RETURNED AND NOT JUST THE NUMBER ────────────────────
 * The setting is the answer; the fallback is a guess made only while the
 * setting has not arrived or cannot be read. A screen showing ₦780,000 of
 * spend should be able to say which one produced it.
 */
export interface ExchangeRateInfo {
  /** The rate to multiply dollars by. Always a usable positive number. */
  rate: number;
  source: 'server' | 'fallback';
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
  const query = useAdminSettings({ group: 'pricing' });

  const found = query.data?.data?.find((s) => s.key === RATE_SETTING_KEY);
  const parsed = toPositiveNumber(found?.value);

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
