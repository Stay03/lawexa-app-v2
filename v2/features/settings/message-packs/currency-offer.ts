import type { IMessagePackPricingData } from '@/types/message-pack';
import type { TCurrency } from '@/types/payment';

/**
 * Which currencies a buyer may pay in, and which one to price in.
 *
 * The server decides what each buyer is offered: from 28 September 2026 a
 * buyer outside Nigeria is offered US dollars only (Arthur's call,
 * 132aa0cd). So the screen shows only the currencies `/message-packs/pricing`
 * returns, and prices in the reader's stored choice only while that choice
 * is on offer. A reader who once picked Naira and is now offered dollars
 * alone sees dollars; nothing is written, so their stored choice is still
 * theirs if they are later offered Naira again (a trip home, a fixed geo
 * lookup).
 */

/** The order the switch lists them in. */
const DISPLAY_ORDER: readonly TCurrency[] = ['NGN', 'USD'];

export interface CurrencyOffer {
  /** What the buyer may pay in, in display order. Empty until pricing loads. */
  readonly offered: readonly TCurrency[];
  /** What the screen prices and charges in. */
  readonly currency: TCurrency;
}

export function currencyOffer(
  pricing: IMessagePackPricingData | null | undefined,
  stored: TCurrency,
): CurrencyOffer {
  if (!pricing) return { offered: [], currency: stored };
  const offered = DISPLAY_ORDER.filter((option) => pricing.prices.some((row) => row.currency === option));
  const currency = offered.includes(stored) ? stored : (offered[0] ?? stored);
  return { offered, currency };
}
