/**
 * font-values — the fonts and sizes a note may carry, and nothing else
 * (Stay, 23 October 2026: "Font size and type for now"; the contract agreed
 * with backend the same day, which its HTML cleaner and the Word and PDF
 * downloads keep to the letter).
 *
 * In a note's HTML they are one span inside one block:
 *
 *   <span data-font="Times New Roman" data-size="12">text</span>
 *
 * never an inline `style`, never a colour. No `data-font` means the house font
 * (Fraunces, the reader's), no `data-size` the default size. Any value outside
 * these lists is dropped where HTML is read, so a pasted or old span cannot
 * bring a font in.
 */

/** Word's own names, so the downloads use the value as it is. */
export const NOTE_FONTS = ['Times New Roman', 'Arial', 'Georgia'] as const;
export type NoteFont = (typeof NOTE_FONTS)[number];

/** Whole points. */
export const NOTE_SIZES = [10, 11, 12, 14, 16, 18, 20, 24] as const;
export type NoteSize = (typeof NOTE_SIZES)[number];

/** The value as an allowed font, or `null`. */
export function noteFont(value: unknown): NoteFont | null {
  return typeof value === 'string' && (NOTE_FONTS as readonly string[]).includes(value) ? (value as NoteFont) : null;
}

/** The value (a number, or a string of digits as HTML carries it) as an allowed size, or `null`. */
export function noteSize(value: unknown): NoteSize | null {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof number === 'number' && (NOTE_SIZES as readonly number[]).includes(number) ? (number as NoteSize) : null;
}

/** The menu's label for the house font, which carries no attribute. */
export const HOUSE_FONT_LABEL = 'Default';
