/**
 * The space under the card while the box is folded: the box's own bottom
 * padding (ConversationComposer's `pb-3`), so the card sits where the box sits
 * (Stay, 14 November 2026: "so much at the bottom").
 */
export const CARD_GAP_PX = 12;

/** The least height the card keeps when it makes room for the box: its header, a question and a row. */
export const CARD_MIN_HEIGHT_PX = 160;

/**
 * THE CARD'S HEIGHT WHILE THE BOX OPENS UNDER IT (Stay, 14 November 2026:
 * "jumpy and buggy when i go from one option to type my answer"). The dock
 * sits on the bottom of the screen, so the card's top edge moves whenever the
 * dock's height does. Opening the box would push the card up by the box's
 * height; instead the card gives that height back, its options scrolling
 * inside, so card and box together stand exactly where the card stood.
 */
export function heightWithBox(cardHeight: number, boxHeight: number): number {
  return Math.max(CARD_MIN_HEIGHT_PX, Math.round(cardHeight + CARD_GAP_PX - boxHeight));
}
