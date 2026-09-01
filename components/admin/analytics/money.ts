import {
  currencySymbol,
  formatAmount as formatOne,
  moneyLines,
} from '@/components/admin/ambassadors/money';

/**
 * Rendering analytics money while the server is mid-change.
 *
 * ── WHY THIS ACCEPTS TWO SHAPES ────────────────────────────────────────────
 * The analytics endpoints are moving from one blended number to a map of
 * currency to decimal string. Those two deploys cannot be simultaneous, so
 * between them one side is newer than the other. If this side only understood
 * the new shape, every money card would break the moment the server shipped
 * first; if it only understood the old one, they would break when it did.
 *
 * So it reads either, and the window closes to nothing. Ship this FIRST, let
 * the server follow whenever it likes, and no card is ever wrong in between.
 *
 * ── THE OLD BRANCH IS A LIE WE ARE STILL TELLING, ON PURPOSE ───────────────
 * A bare number is naira and dollars added together with a ₦ printed on it —
 * that is the bug being fixed. Rendering it as today keeps the screen exactly
 * as wrong as it already is rather than making it differently wrong, and it
 * stops being reachable the moment the server sends maps.
 * DELETE THE NUMBER BRANCH once every analytics endpoint sends a map.
 */

/** What the server sends today, and what it will send after the change. */
export type AnalyticsMoney = number | string | Record<string, string> | null | undefined;

function isCurrencyMap(value: AnalyticsMoney): value is Record<string, string> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Every figure to print, one per currency — in the new shape — or the single
 * legacy figure in the old one.
 *
 * AN EMPTY RESULT MEANS "NOTHING TO DRAW", NEVER "ZERO".
 * An empty map is a period in which no money arrived in any currency; the
 * server sends `{}` rather than a zero because zero would be naming a currency
 * it did not. A caller must render nothing — a dash, a blank — and never
 * "₦0.00", which would claim we sold nothing in naira specifically.
 */
export function analyticsMoneyLines(value: AnalyticsMoney): string[] {
  if (value === null || value === undefined) return [];
  if (isCurrencyMap(value)) return moneyLines(value);

  /* Legacy single number. Grouped and given a naira sign, exactly as the screen
     does today — see the note above on why this stays wrong rather than
     becoming differently wrong. */
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return [];
  return [`₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`];
}

/**
 * True when the server has moved this field to the new shape. Lets a component
 * show a per-currency layout without guessing, and without the legacy path
 * having to pretend it has currencies.
 */
export function isPerCurrency(value: AnalyticsMoney): boolean {
  return isCurrencyMap(value);
}

/**
 * A change percentage, which follows its money and therefore also arrives
 * either as one number or as one per currency.
 *
 * `null` inside the map is meaningful and is NOT zero: it means there was no
 * previous figure to compare against, so there is no change to state. A caller
 * renders nothing for it rather than "0%", which would assert the figure held
 * steady when in fact it is the first one we have.
 */
export function analyticsChange(
  value: number | Record<string, number | null> | null | undefined,
  currency?: string,
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (!currency) return null;
  const found = value[currency];
  return typeof found === 'number' ? found : null;
}

/**
 * The currencies present, in the order they should be drawn — naira first,
 * then anything else alphabetically, matching `moneyLines`.
 *
 * Returns an empty list for the legacy single-number shape, because there are
 * no currencies to name: the caller then draws its one figure and its one
 * change, as it does today.
 */
export function currenciesOf(value: AnalyticsMoney): string[] {
  if (!isCurrencyMap(value)) return [];
  const codes = Object.keys(value);
  codes.sort((a, b) => (a === 'NGN' ? -1 : b === 'NGN' ? 1 : a.localeCompare(b)));
  return codes;
}

/**
 * One printable amount for one currency.
 *
 * A "0.00" HERE IS A REAL ZERO AND MUST BE DRAWN. The currency key exists, so
 * the question arose and the answer was nothing — a day on which that currency
 * took no money. That is different from the currency being absent entirely,
 * which is the case `currenciesOf` already excludes by never listing it.
 */
export function amountFor(value: AnalyticsMoney, currency: string): string | null {
  if (!isCurrencyMap(value)) return null;
  const raw = value[currency];
  if (raw === undefined || raw === null) return null;
  return formatOne(currency, raw);
}

/******************************************************************************
                    Series and lists that arrive per currency
******************************************************************************/

/** One currency's worth of anything. `currency` is null on the legacy shape. */
export interface CurrencyGroup<T> {
  currency: string | null;
  items: T[];
}

/**
 * A flat list, or a map of currency to list, reduced to the same thing.
 *
 * ── WHY EVERY PER-CURRENCY THING GETS ITS OWN CHART, TABLE OR AXIS ────────
 * The tempting alternative is one chart with two series. It is wrong for the
 * same reason the blended total was wrong: a naira axis makes a $20 bar a flat
 * line against the floor, and putting them side by side asserts they can be
 * compared when converting between them needs a rate nobody stored. Separate
 * scales say the true thing — these are two businesses measured in two units.
 *
 * AN EMPTY LIST FOR A NAMED CURRENCY IS DROPPED. The server can name a currency
 * whose period was quiet; an axis and a title over nothing reads as a broken
 * screen rather than a quiet month.
 */
export function seriesByCurrency<T>(
  data: T[] | Record<string, T[]> | null | undefined,
): CurrencyGroup<T>[] {
  if (data === null || data === undefined) return [];
  if (Array.isArray(data)) return data.length ? [{ currency: null, items: data }] : [];
  if (typeof data !== 'object') return [];

  return Object.keys(data)
    .sort((a, b) => (a === 'NGN' ? -1 : b === 'NGN' ? 1 : a.localeCompare(b)))
    .map((currency) => ({ currency, items: data[currency] ?? [] }))
    .filter((group) => group.items.length > 0);
}

/**
 * A short amount for a chart axis, in the currency the axis belongs to.
 *
 * Mirrors `formatNaira(_, { compact: true })` so the naira axes keep the shape
 * they have today, and gives every other currency the same treatment instead of
 * a naira sign over dollars.
 */
export function compactMoney(currency: string, amount: number): string {
  const symbol = currencySymbol(currency);
  if (!Number.isFinite(amount)) return `${symbol}0`;
  if (Math.abs(amount) >= 1_000_000) return `${symbol}${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `${symbol}${(amount / 1_000).toFixed(1)}K`;
  return `${symbol}${amount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

/** A full amount for a tooltip, where there is room for every digit. */
export function fullMoney(currency: string, amount: number): string {
  if (!Number.isFinite(amount)) return formatOne(currency, "0.00");
  return formatOne(currency, amount.toFixed(2));
}
