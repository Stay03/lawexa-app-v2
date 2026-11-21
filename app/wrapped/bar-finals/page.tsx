'use client';

import { BarFinalsWrapped } from '@/components/wrapped/BarFinalsWrapped';
import { wrappedFontFamilies } from '../fonts';

/**
 * lawexa.com/wrapped/bar-finals: the Bar Finals edition at its own address,
 * so nobody loses it once /wrapped plays the 2026 edition (Techlead, 21
 * November 2026). The 2026 share slide links here for people with a record.
 */
export default function BarFinalsWrappedPage() {
  return <BarFinalsWrapped fonts={wrappedFontFamilies} />;
}
