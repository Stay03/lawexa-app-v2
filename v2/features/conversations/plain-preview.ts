/**
 * A message preview as one plain line: no tags, no heading, quote or list
 * marks at a line start, no bold, underscore or code marks, one space between
 * words. An answer's preview is its markdown's first characters, so a Space's
 * chat row printed "**" and "##" (Tester, 20 October 2026, finding 29); a
 * reply quote already cleaned it this way.
 */
export function plainPreview(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/(\*\*|__|`)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
