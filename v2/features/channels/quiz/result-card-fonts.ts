import { DISPLAY_FAMILY, TEXT_FAMILY } from './result-card-layout';

/**
 * The result card's two typefaces, at the cut Arthur's files use: Bricolage
 * Grotesque ExtraBold and DM Sans Medium and Bold, both at their 14 pt
 * optical size (the widths of every letter in his PDF match these and no
 * other size). Canvas text cannot choose an optical size, so the files are
 * Google Fonts' fixed instances, served from `public/fonts/live-quiz-card`
 * (SIL Open Font License, beside them) rather than fetched from Google.
 *
 * They are registered under the card's own family names only when a card is
 * drawn, so no other screen loads them, and a face loads only for the
 * characters the card uses (the unicode ranges).
 */

const BASE = '/fonts/live-quiz-card';

const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT =
  'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF';
const VIETNAMESE =
  'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB';

/** Every face the card uses: family, file, weight (a range for DM Sans's one weight-variable file) and characters. */
export const CARD_FONT_FACES: readonly { family: string; file: string; weight: string; unicodeRange: string }[] = [
  { family: DISPLAY_FAMILY, file: 'bricolage-grotesque-14pt-800-latin.woff2', weight: '800', unicodeRange: LATIN },
  { family: DISPLAY_FAMILY, file: 'bricolage-grotesque-14pt-800-latin-ext.woff2', weight: '800', unicodeRange: LATIN_EXT },
  // Yoruba and Igbo dotted letters (ẹ, ọ, ị, ụ) sit in this range.
  { family: DISPLAY_FAMILY, file: 'bricolage-grotesque-14pt-800-vietnamese.woff2', weight: '800', unicodeRange: VIETNAMESE },
  { family: TEXT_FAMILY, file: 'dm-sans-14pt-latin.woff2', weight: '500 700', unicodeRange: LATIN },
  { family: TEXT_FAMILY, file: 'dm-sans-14pt-latin-ext.woff2', weight: '500 700', unicodeRange: LATIN_EXT },
];

let registered = false;

/**
 * Registers the card's faces once, then waits for the ones the given text
 * needs. Settled, not all: a face that fails leaves the browser's fallback,
 * and the card is still drawn.
 */
export async function loadCardFonts(text: string): Promise<void> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return;
  if (!registered) {
    for (const face of CARD_FONT_FACES) {
      document.fonts.add(new FontFace(face.family, `url(${BASE}/${face.file}) format('woff2')`, { weight: face.weight, unicodeRange: face.unicodeRange, display: 'block' }));
    }
    registered = true;
  }
  await Promise.allSettled([
    document.fonts.load(`800 100px "${DISPLAY_FAMILY}"`, text),
    document.fonts.load(`500 100px "${TEXT_FAMILY}"`, text),
    document.fonts.load(`700 100px "${TEXT_FAMILY}"`, text),
  ]);
}
