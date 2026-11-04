import { Inter, Unbounded } from 'next/font/google';

/**
 * Wrapped's type (Arthur's design system: Unbounded 900, Inter 500 and 700), loaded only
 * by the /wrapped route. The CSS variables feed app/wrapped/wrapped.css; the
 * family names feed the share image's canvas, which draws with the same fonts.
 */
export const wrappedDisplay = Unbounded({ subsets: ['latin'], weight: ['900'], variable: '--font-wrapped-display', display: 'swap' });

export const wrappedBody = Inter({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-wrapped-body', display: 'swap' });

export const wrappedFontFamilies = {
  display: wrappedDisplay.style.fontFamily,
  body: wrappedBody.style.fontFamily,
};
