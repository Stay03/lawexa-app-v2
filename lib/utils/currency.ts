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
  return `$${usdAmount.toFixed(decimals)}`;
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
