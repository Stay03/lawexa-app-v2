/**
 * Where the two buttons under a statute selection sit: the researchers' "Print
 * note" at the selection's end, and the reader's "Annotate" either there or,
 * when both show, one gap to its left. Both buttons read their widths from
 * here, and "Annotate" is placed from "Print note", so the gap holds wherever
 * the selection ends (283a18fb widened "Print note" to 136 px while
 * "Annotate" still made room for 124, and the pills touched on lawexa.com).
 */

export const SELECTION_BUTTON_MARGIN = 12;
export const NOTE_BUTTON_WIDTH = 136;
export const ANNOTATE_BUTTON_WIDTH = 124;
/** The space between "Annotate" and "Print note" when both show. */
export const SELECTION_BUTTON_GAP = 8;

/**
 * The left edge of "Print note": under the selection's end, inside the screen.
 * With "Annotate" beside it, it keeps room for that button on its left too.
 */
export function noteButtonLeft(selectionRight: number, viewportWidth: number, besideAnnotate: boolean): number {
  const room = besideAnnotate ? ANNOTATE_BUTTON_WIDTH + SELECTION_BUTTON_GAP : 0;
  return Math.min(
    Math.max(SELECTION_BUTTON_MARGIN + room, selectionRight - NOTE_BUTTON_WIDTH),
    viewportWidth - NOTE_BUTTON_WIDTH - SELECTION_BUTTON_MARGIN,
  );
}

/** The left edge of "Annotate": where "Print note" would be alone, or one gap to its left. */
export function annotateButtonLeft(selectionRight: number, viewportWidth: number, besideNote: boolean): number {
  if (besideNote) {
    return noteButtonLeft(selectionRight, viewportWidth, true) - SELECTION_BUTTON_GAP - ANNOTATE_BUTTON_WIDTH;
  }
  return Math.min(
    Math.max(SELECTION_BUTTON_MARGIN, selectionRight - ANNOTATE_BUTTON_WIDTH),
    viewportWidth - ANNOTATE_BUTTON_WIDTH - SELECTION_BUTTON_MARGIN,
  );
}
