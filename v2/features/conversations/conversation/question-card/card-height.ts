/**
 * The space under the card while the box is folded: the box's own bottom
 * padding (ConversationComposer's `pb-3`), so the card sits where the box sits
 * (Stay, 14 November 2026: "so much at the bottom").
 */
export const CARD_GAP_PX = 12;

/**
 * THE CARD STAYS STILL WHEN THE BOX OPENS UNDER IT (Stay, 14 November 2026:
 * "jumpy and buggy when i go from one option to type my answer"; Fable's
 * review of abe2948c). The dock sits on the bottom of the screen, so the
 * card's top edge moves whenever the dock's height does. When "Type my own
 * answer" opens the box, the stack (card and box) keeps the height it had,
 * and the card, flex-1 and min-h-0, gives the box whatever it takes: on
 * opening, and as the reader's words grow or shrink it, with nothing measured
 * but the stack itself.
 *
 * The lock is a number of pixels, so it belongs to one width of window: a
 * turn of the phone drops it (the card is a different shape now). A change of
 * height alone, a phone's keyboard opening, keeps it: the dock rides up with
 * the keyboard and the card does not move inside it.
 */
export function lockSurvivesResize(
  before: { width: number; height: number },
  after: { width: number; height: number },
): boolean {
  return Math.round(before.width) === Math.round(after.width);
}
