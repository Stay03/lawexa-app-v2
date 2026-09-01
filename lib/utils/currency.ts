/**
 * Format a USD amount as either USD or NGN.
 *
 * `options` is REQUIRED, and so is the rate inside it. Both used to be
 * optional, defaulting to no conversion at a rate of 1500 — a number written
 * into this file once and then left behind while the real rate moved. A caller
 * that forgot to pass a rate got a confident wrong figure instead of an error.
 *
 * The rate is a server setting now (`usd_to_ngn_display_rate`). Read it with
 * `useExchangeRate` and pass it in.
 */
export function formatCost(
  usdAmount: string | number,
  options: {
    showNGN?: boolean;
    /* REQUIRED when showNGN can be true. It used to default to 1500, which
       meant a caller that forgot it silently converted at a rate from months
       ago instead of failing. The rate is a server setting now; read it with
       useExchangeRate and pass it. */
    exchangeRate: number;
    decimals?: number;
  },
): string {
  const { showNGN = false, exchangeRate, decimals = 4 } = options;
  const numeric = typeof usdAmount === 'string' ? Number(usdAmount) : usdAmount;

  if (showNGN) {
    const ngnAmount = numeric * exchangeRate;
    // For NGN, show 2 decimal places with thousands separator
    return `₦${ngnAmount.toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  // USD format with specified decimals
  return `$${numeric.toFixed(decimals)}`;
}

/**
 * Get currency symbol based on showNGN setting
 */
export function getCurrencySymbol(showNGN: boolean): string {
  return showNGN ? '₦' : '$';
}

/**
 * Get currency label for display
 */
export function getCurrencyLabel(showNGN: boolean): string {
  return showNGN ? 'NGN' : 'USD';
}

/**
 * Format a Naira amount for display.
 * Values are already in NGN — no conversion needed.
 */
export function formatNaira(
  amount: number,
  options?: { decimals?: number; compact?: boolean }
): string {
  const { decimals = 0, compact = false } = options ?? {};
  if (compact && amount >= 1_000_000) {
    return `₦${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (compact && amount >= 1_000) {
    return `₦${(amount / 1_000).toFixed(1)}K`;
  }
  return `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Format a large number compactly (e.g., 1234 → "1.2K", 1234567 → "1.2M").
 */
export function formatCompact(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}
