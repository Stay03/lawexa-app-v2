import type { MoneyByCurrency } from '@/types/ambassador';

/**
 * Rendering money that arrives as a currency map of decimal strings.
 *
 * ── THE ONE RULE: FORMAT, NEVER CALCULATE ──────────────────────────────────
 * Every amount is summed exactly on the server and sent as a string. Parsing
 * one into a JavaScript number throws that exactness away and buys nothing,
 * because the only thing this side does with it is print it. So nothing here
 * multiplies, adds, or totals — `totals` is sent for exactly that reason.
 *
 * ── AND NEVER ACROSS CURRENCIES ────────────────────────────────────────────
 * Lawexa is paid in naira and in dollars. Until 2026-08-11 the server added
 * them into one figure — "139,200 naira plus 17 dollars" arrived as 255,221 of
 * nothing — and the reason nobody caught it sooner is that a single number
 * looks like an answer. They are separate now and they stay separate: adding
 * them is meaningless and converting them needs a rate that would be invented.
 */

/** Currency symbols we actually bill in. Anything else prints its ISO code,
 *  which is honest and never wrong — better than guessing a glyph. */
const SYMBOLS: Readonly<Record<string, string>> = {
  NGN: '₦',
  USD: '$',
};

/**
 * One amount, grouped for reading. The decimal string is split on the point and
 * only the WHOLE part is grouped — the fractional part is copied through
 * untouched, so nothing is rounded and nothing is re-encoded.
 */
export function formatAmount(currency: string, amount: string): string {
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const [whole, fraction] = amount.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${symbol}${grouped}${fraction ? `.${fraction}` : ''}`;
}

/**
 * Every currency in the map, in a stable order so a table does not reshuffle
 * between rows. Naira first because it is the common case, then anything else
 * alphabetically.
 *
 * AN EMPTY MAP MEANS NO MONEY AT ALL, and it returns an empty list rather than
 * a zero: `{}` carries no currency, so "₦0.00" would be naming one the server
 * did not.
 */
export function moneyLines(revenue: MoneyByCurrency): string[] {
  const codes = Object.keys(revenue);
  if (codes.length === 0) return [];
  codes.sort((a, b) => (a === 'NGN' ? -1 : b === 'NGN' ? 1 : a.localeCompare(b)));
  return codes.map((code) => formatAmount(code, revenue[code]));
}
