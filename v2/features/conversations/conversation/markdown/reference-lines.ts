/**
 * An answer's reference list, with the case name as the link instead of a raw
 * web address (long-list #10, 26 September 2026).
 *
 * The AI writes its references as one line each:
 *
 *   [1] Umoetuk v UBN PLC (2002) 3 NWLR (Pt. 755) 647 - https://lawexa.com/cases/umoetuk-v-ubn-plc
 *
 * The address is the widest thing in the answer and ran off a phone screen. A
 * line of exactly that shape, pointing at lawexa.com, becomes
 *
 *   [1] [Umoetuk v UBN PLC (2002) 3 NWLR (Pt. 755) 647](https://lawexa.com/cases/umoetuk-v-ubn-plc)
 *
 * so the name is the link (and a case link gets its preview, CaseMentionLink).
 * Any other line, and any address that is not Lawexa's, is left as written.
 */
const REFERENCE_LINE = /^(\s*\[\d+\]\s+)(.+?)\s+[-–—]\s+(https?:\/\/(?:www\.)?lawexa\.com\/[^\s)]+)\s*$/;

export function linkReferenceLines(text: string): string {
  if (!text.includes('lawexa.com/')) return text;
  return text
    .split('\n')
    .map((line) => {
      const match = REFERENCE_LINE.exec(line);
      if (!match) return line;
      const [, prefix, label, url] = match;
      // Square brackets inside the label would end the link text early.
      const safeLabel = label.replace(/([[\]])/g, '\$1');
      return `${prefix}[${safeLabel}](${url})`;
    })
    .join('\n');
}
