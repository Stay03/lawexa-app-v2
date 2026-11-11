import { Inter, Unbounded } from 'next/font/google';

/**
 * The share poster's type (Arthur's Wrapped design system: Unbounded 900,
 * Inter 500 and 700). The /wrapped route uses the CSS variables for its story
 * screens (app/wrapped/wrapped.css); the poster's canvas draws with the
 * family names, for Wrapped and for the live quiz's result card alike
 * (`lib/wrapped/share-image.ts`, `drawPoster`). A screen that draws a poster
 * imports this module, which brings the faces with it.
 */
export const wrappedDisplay = Unbounded({ subsets: ['latin'], weight: ['900'], variable: '--font-wrapped-display', display: 'swap' });

export const wrappedBody = Inter({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-wrapped-body', display: 'swap' });

export const wrappedFontFamilies = {
  display: wrappedDisplay.style.fontFamily,
  body: wrappedBody.style.fontFamily,
};
