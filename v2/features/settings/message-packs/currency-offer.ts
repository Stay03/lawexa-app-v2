import type { IMessagePackPricingData } from '@/types/message-pack';
import type { TCurrency } from '@/types/payment';

/**
 * Which currencies a buyer may pay in, and which one to price in.
 *
 * The server decides what each buyer is offered: from 28 September 2026 a
 * buyer in Nigeria is offered Naira only and a buyer elsewhere US dollars
 * only (Arthur's and Stay's call, 132aa0cd and c779ef2e). So the screen
 * shows only the currencies `/message-packs/pricing` returns, and prices in
 * the reader's stored choice only while that choice is on offer. A reader
 * whose stored choice is not offered sees the offered currency; nothing is
 * written, so the stored choice is still theirs if it is offered again (a
 * trip abroad and back, a fixed geo lookup).
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
