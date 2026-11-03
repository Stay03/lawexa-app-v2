/**
 * pdf-passages — the passages a host asks the PDF reader to show, in order,
 * and stepping between them (a Radar report's file named for several
 * passages; Arthur, 3 November 2026, option 2). The reader opens on the
 * first; the dialog's bar steps to the next or the one before, and says which
 * it is on ("Passage 2 of 3"). Pure, so a test pins it.
 */

export interface PdfPassage {
  /** The page it is on, 1-based. */
  page: number;
  /** The words to mark there; `null` opens the page unmarked. */
  quote: string | null;
}

/** The passage to show after a step, held to the list's two ends. */
export function stepPassage(index: number, count: number, delta: -1 | 1): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, index + delta));
}

/** Which passage is shown, for the bar: "Passage 2 of 3". */
export function passageLabel(index: number, count: number): string {
  return `Passage ${index + 1} of ${count}`;
}
