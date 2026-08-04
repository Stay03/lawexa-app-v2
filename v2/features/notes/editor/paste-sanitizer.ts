/**
 * paste-sanitizer — strip presentation off pasted HTML before ProseMirror sees it.
 *
 * ── THE SCHEMA IS THE REAL GUARANTEE ────────────────────────────────────────
 * The v2 note schema has no colour, highlight, font or text-style mark. There is
 * nowhere for `style="color:#fff"` to LAND, so a paste from Word or a coloured
 * Google Doc already arrives as plain, readable text. That is the fix for the
 * owner's invisible-text bug, and it is structural: the editor cannot produce
 * coloured notes because the document model cannot hold colour.
 *
 * This function is the second line, and it is worth its fifteen lines for one
 * reason: it removes the attributes BEFORE the parser runs, so the day someone
 * adds an extension that does understand `style`, a decade of pasted Word
 * formatting does not suddenly become visible again. Defence in depth, stated
 * honestly — not the mechanism the promise rests on.
 *
 * ── AND IT IS A BLUNT INSTRUMENT, ON PURPOSE ────────────────────────────────
 * These are regexes over a string, not a DOM walk, so they cannot tell an
 * ATTRIBUTE from the same characters sitting in prose: pasting a sentence that
 * happens to contain ` color="red"` loses that fragment. That trade is
 * deliberate — a DOM-based pass would mean parsing hostile clipboard HTML twice
 * on every paste, and the loss is a rare typographical oddity in a legal note
 * against a class of invisible-text bugs. It is also why this is explicitly NOT
 * the guarantee: the SCHEMA is, and the schema is exact.
 *
 * PURE and string-only (no DOM), so it runs identically in a test.
 */

/** `style="…"` / `style='…'` on any element. */
const STYLE_ATTRIBUTE = /\sstyle\s*=\s*("[^"]*"|'[^']*')/gi;

/** The pre-CSS presentation attributes Word and old CMS exports still emit. */
const PRESENTATION_ATTRIBUTES = /\s(?:color|bgcolor|face|background)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

/** `<font …>` / `</font>` — unwrapped, keeping the text between them. */
const FONT_TAGS = /<\/?font\b[^>]*>/gi;

export function stripPastedPresentation(html: string): string {
  return html
    .replace(FONT_TAGS, '')
    .replace(STYLE_ATTRIBUTE, '')
    .replace(PRESENTATION_ATTRIBUTES, '');
}
