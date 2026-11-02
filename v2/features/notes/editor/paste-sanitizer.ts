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
 * ── ONE STYLE IS READ FIRST: GOOGLE DOCS' NOT-BOLD WRAPPER ──────────────────
 * Google Docs wraps its whole clipboard in `<b style="font-weight:normal"
 * id="docs-internal-guid-…">`. Tiptap's Bold mark skips a `<b>` whose weight
 * is normal, so once the style was stripped the wrapper read as bold and every
 * pasted cell turned bold (Tester and Arthur, 20 October 2026). A `<b>` whose
 * own style says `font-weight: normal` (or 400) is dropped before the style
 * strip runs. Its `</b>` is left behind with no `<b>` open, and the HTML parser
 * ignores a stray end tag.
 *
 * ── ALIGNMENT IS THE ONE PRESENTATION KEPT (Stay, 2 November 2026) ─────────
 * A centred line in a pasted Word or Google document stays centred: the editor
 * keeps alignment on paragraphs and headings (`TextAlign`), as `text-align`.
 * Before the strip, each `<p>` and `<h1>`–`<h6>` keeps its alignment, read from
 * its `text-align` style or, when it has none, from the old `align="…"`
 * attribute Word and LibreOffice still write (Tester's paste, 259cd69c: a
 * centred "Signed:" line came in left-aligned). A paragraph or heading with
 * none of its own takes the alignment of the `div`, list item or table cell
 * it sits in. Center, right and justify are kept (left is the editor's own
 * default, so it is written as none), and the element
 * comes out with that one style and nothing else. Words directly in an aligned
 * `div`, item or cell, with no paragraph around them, are not kept aligned:
 * the editor keeps alignment on paragraphs and headings alone.
 *
 * PURE and string-only (no DOM), so it runs identically in a test.
 */

/** `style="…"` / `style='…'` on any element. */
const STYLE_ATTRIBUTE = /\sstyle\s*=\s*("[^"]*"|'[^']*')/gi;

/** A `<b>` whose own style says it is not bold: Google Docs' clipboard wrapper. */
const NOT_BOLD_OPEN = /<b\b(?=[^>]*\sstyle\s*=\s*["'][^"']*font-weight\s*:\s*(?:normal|400)\b)[^>]*>/gi;

/** The pre-CSS presentation attributes Word and old CMS exports still emit. */
const PRESENTATION_ATTRIBUTES = /\s(?:color|bgcolor|face|background)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

/** `<font …>` / `</font>` — unwrapped, keeping the text between them. */
const FONT_TAGS = /<\/?font\b[^>]*>/gi;

/** Any opening or closing tag, with its attributes. */
const ANY_TAG = /<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi;
const ALIGNABLE = /^(?:p|h[1-6])$/;
/** The elements whose alignment the paragraphs and headings inside them take. */
const CONTAINERS = /^(?:div|li|td|th)$/;
/** The lists and table parts that end the items and cells inside them. */
const STRUCTURE = /^(?:ul|ol|table|thead|tbody|tfoot|tr)$/;
/** What a new item, cell or row closes when its own end tag was left out: the one before it, up to its parent. */
const IMPLIED_END: Record<string, { ends: ReadonlySet<string>; parents: ReadonlySet<string> }> = {
  li: { ends: new Set(['li']), parents: new Set(['ul', 'ol']) },
  td: { ends: new Set(['td', 'th']), parents: new Set(['tr', 'table']) },
  th: { ends: new Set(['td', 'th']), parents: new Set(['tr', 'table']) },
  tr: { ends: new Set(['tr', 'td', 'th']), parents: new Set(['thead', 'tbody', 'tfoot', 'table']) },
};
const STYLE_VALUE = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const TEXT_ALIGN = /(?:^|;)\s*text-align\s*:\s*([a-z-]+)\s*(?:!important\s*)?(?=;|$)/gi;
const ALIGN_ATTRIBUTE = /\salign\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
const ALIGNMENTS: ReadonlySet<string> = new Set(['left', 'center', 'right', 'justify']);

/** A known alignment, in lower case, or `null`. */
function alignment(value: string | undefined): string | null {
  const word = value?.trim().toLowerCase();
  return word && ALIGNMENTS.has(word) ? word : null;
}

/** An element's own alignment: its last `text-align` declaration, as CSS reads it, else its `align`. */
function ownAlignment(attributes: string): string | null {
  const style = STYLE_VALUE.exec(attributes);
  const declarations = [...(style?.[1] ?? style?.[2] ?? '').matchAll(TEXT_ALIGN)];
  const attribute = ALIGN_ATTRIBUTE.exec(attributes);
  return alignment(declarations.at(-1)?.[1]) ?? alignment(attribute?.[1] ?? attribute?.[2] ?? attribute?.[3]);
}

/**
 * Each paragraph's and heading's alignment, set aside before the strip under
 * `carrier`: its own, else that of the nearest aligned `div`, list item or
 * cell it is still inside. An item, cell or row also ends at the next one or
 * at its list's or table's end, as HTML ends them; a self-closed container
 * holds nothing.
 */
function keepAlignment(html: string, carrier: string): string {
  const around: { name: string; align: string | null }[] = [];
  const closeLast = (names: ReadonlySet<string>, stopAt: ReadonlySet<string> = new Set()) => {
    for (let at = around.length - 1; at >= 0; at--) {
      if (stopAt.has(around[at].name)) return;
      if (names.has(around[at].name)) {
        around.length = at;
        return;
      }
    }
  };
  return html.replace(ANY_TAG, (tag, closing: string, rawName: string, attributes: string) => {
    const name = rawName.toLowerCase();
    if (CONTAINERS.test(name) || STRUCTURE.test(name)) {
      if (closing) {
        closeLast(new Set([name]));
      } else if (!attributes.trimEnd().endsWith('/')) {
        const implied = IMPLIED_END[name];
        if (implied) closeLast(implied.ends, implied.parents);
        around.push({ name, align: CONTAINERS.test(name) ? ownAlignment(attributes) : null });
      }
      return tag;
    }
    if (closing || !ALIGNABLE.test(name)) return tag;
    const align = ownAlignment(attributes) ?? around.findLast((entry) => entry.align)?.align ?? null;
    const rest = attributes.replace(ALIGN_ATTRIBUTE, '');
    // Left is the editor's own default, so it is written as no alignment (and stops one from around it).
    if (align && align !== 'left') return `<${rawName}${rest} ${carrier}="${align}">`;
    return rest !== attributes ? `<${rawName}${rest}>` : tag;
  });
}

export function stripPastedPresentation(html: string): string {
  // A new name on every paste, so nothing in the clipboard can pose as a kept alignment.
  const carrier = `data-v2-align-${Math.random().toString(36).slice(2)}`;
  const kept = new RegExp(`\\s${carrier}="(center|right|justify)"`, 'g');
  return keepAlignment(html, carrier)
    .replace(NOT_BOLD_OPEN, '')
    .replace(FONT_TAGS, '')
    .replace(STYLE_ATTRIBUTE, '')
    .replace(PRESENTATION_ATTRIBUTES, '')
    .replace(kept, (_carrier, align: string) => ` style="text-align: ${align}"`);
}
