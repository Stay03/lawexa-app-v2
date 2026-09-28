/**
 * The printed lines of one AKN text node — pure.
 *
 * Statute text reaches us with two kinds of line break, and they mean
 * opposite things:
 *
 *   - a break followed by spaces or tabs, or at the very end of the text, is
 *     the exporter's own indentation ("…Area Council\n                    election ;").
 *     It is not in the print and reads as one space, which is what HTML's
 *     normal whitespace handling already made of it;
 *   - any other break is a line of the printed page: the Electoral Act 2026's
 *     forms ("HOLDEN AT……\nPetition No……\nBetween") and the PIA 2021's
 *     Fourth Schedule formula. HTML collapsed those into spaces too, so each
 *     form ran as one paragraph (live, 28 Sep 2026).
 *
 * Measured across five Acts before this was written: the second kind occurred
 * only in the Electoral Act 2026's schedules; the first in the Electoral Act
 * 2022's sections and the Companies Code 1963's schedules. So the rule goes by
 * the shape of each break, not by where the text sits — a "schedules only"
 * rule would have split the Companies Code's indentation into lines.
 *
 * Returns one element when the text has no printed line breaks, which is the
 * case for almost every text node.
 */
export function printedLines(text: string): string[] {
  if (!text.includes('\n') && !text.includes('\r')) return [text];
  const flattened = text
    .replace(/\r\n?/g, '\n')
    // Indentation: a break followed by spaces, another break, or the end.
    .replace(/\n[ \t]*(?=\n|$)|\n[ \t]+/g, ' ');
  return flattened.split('\n');
}
