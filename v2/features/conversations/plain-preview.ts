/**
 * A message preview as one plain line: no tags, no heading, quote or list
 * marks at a line start, no bold, underscore or code marks, one space between
 * words. An answer's preview is its markdown's first characters, so a Space's
 * chat row printed "**" and "##" (Tester, 20 October 2026, finding 29); a
 * reply quote already cleaned it this way. Single-mark emphasis ("*Assumed
 * framework*") and a link's address go too: an agent's reply preview printed
 * them (sub-agents E2E pictures, 12 November 2026). A mark inside a word
 * (snake_case, 2*3) stays.
 */
export function plainPreview(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|`)/g, '')
    .replace(/(^|[\s(])[*_](?=\S)/g, '$1')
    .replace(/(?<=\S)[*_](?=$|[\s.,;:!?)])/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
