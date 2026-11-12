/**
 * Fitting a line into a box on the share image: the widest font size, from
 * `max` down to `min`, at which the words wrap into `maxLines` lines no wider
 * than `width`. Pure (the canvas's measureText is passed in), so the rule is
 * tested with a fake measure.
 */

export type Measure = (text: string, size: number) => number;

/** Greedy word wrap; a single word wider than the box stays on its own line. */
export function wrapWords(text: string, size: number, width: number, measure: Measure): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const tryLine = line ? `${line} ${word}` : word;
    if (!line || measure(tryLine, size) <= width) {
      line = tryLine;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export interface FittedText {
  size: number;
  lines: string[];
}

export function fitText(
  text: string,
  box: { width: number; maxLines: number; max: number; min: number; step?: number },
  measure: Measure,
): FittedText {
  const step = box.step ?? 4;
  for (let size = box.max; size >= box.min; size -= step) {
    const lines = wrapWords(text, size, box.width, measure);
    if (lines.length <= box.maxLines && lines.every((line) => measure(line, size) <= box.width)) return { size, lines };
  }
  return { size: box.min, lines: wrapWords(text, box.min, box.width, measure) };
}
