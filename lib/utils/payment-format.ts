import type { TCurrency } from '@/types/payment';
import type { IPlan } from '@/types/subscription';

/******************************************************************************
                               Constants
******************************************************************************/

const CURRENCY_MINOR_UNIT_DIVISOR: Record<TCurrency, number> = {
  NGN: 100, // kobo per naira
  USD: 100, // cents per dollar
};

const CURRENCY_LOCALE: Record<TCurrency, string> = {
  NGN: 'en-NG',
  USD: 'en-US',
};

/******************************************************************************
                               Functions
******************************************************************************/

/**
 * Format a minor-unit integer amount as a localized currency string.
 *
 * Whole amounts render without trailing zeros (₦2,000 not ₦2,000.00);
 * fractional amounts keep two decimals ($1.50).
 */
export function formatMoneyMinor(minor: number, currency: TCurrency): string {
  const divisor = CURRENCY_MINOR_UNIT_DIVISOR[currency];
  const major = minor / divisor;
  const isWhole = Number.isInteger(major);
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}

/**
 * Format a major-unit amount as a localized currency string. Used when the
 * caller already holds majors (e.g., the pricing endpoint's `price_major`).
 */
export function formatMoneyMajor(major: number, currency: TCurrency): string {
  const isWhole = Number.isInteger(major);
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}

/**
 * Format a plan's price using its currency. `amount_minor` is the source of
 * truth per backend.
 */
export function formatPlanAmount(plan: IPlan): string {
  return formatMoneyMinor(plan.amount_minor, plan.currency);
}

/**
 * For annual plans, render the monthly equivalent in the plan's currency.
 */
export function formatPlanMonthlyFromAnnual(plan: IPlan): string {
  const monthlyMinor = Math.round(plan.amount_minor / 12);
  return formatMoneyMinor(monthlyMinor, plan.currency);
}

/**
 * Annual savings vs the equivalent monthly plan, as a percentage.
 * Currency-agnostic — works as long as both plans share a currency.
 */
export function calculateAnnualSavingsPct(monthlyMinor: number, annualMinor: number): number {
  const yearAtMonthly = monthlyMinor * 12;
  if (yearAtMonthly <= 0) return 0;
  return Math.round(((yearAtMonthly - annualMinor) / yearAtMonthly) * 100);
}

/**
 * Compact user-facing symbol for a currency. For the picker trigger / labels.
 */
export function currencySymbol(currency: TCurrency): string {
  switch (currency) {
    case 'NGN':
      return '₦';
    case 'USD':
      return '$';
  }
}
