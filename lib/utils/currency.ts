/**
 * Format a USD amount as either USD or NGN based on settings
 */
export function formatCost(
  usdAmount: number,
  options: {
    showNGN?: boolean;
    exchangeRate?: number;
    decimals?: number;
  } = {}
): string {
  const { showNGN = false, exchangeRate = 1500, decimals = 4 } = options;

  if (showNGN) {
    const ngnAmount = usdAmount * exchangeRate;
    // For NGN, show 2 decimal places with thousands separator
    return `₦${ngnAmount.toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  // USD format with specified decimals
  return `$${Number(usdAmount).toFixed(decimals)}`;
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
