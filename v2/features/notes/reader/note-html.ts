import { htmlToPlainText } from '../note-text';

/**
 * note-html — stored note HTML → a SANITISED, SERIALISABLE NODE TREE.
 *
 * This module is the heart of the notes reader, and it is deliberately pure:
 * no React, no hooks, no imports beyond one text helper. It takes the HTML a
 * note author stored and returns a plain data structure that `NoteContent`
 * turns into React elements. Nothing it returns can express an attribute the
 * allowlist below does not name, so the renderer has no way to emit one.
 *
 * ── WHAT IT REPLACES, AND WHY THAT MATTERS ──────────────────────────────────
 * v1's `components/notes/NoteContent.tsx` did this:
 *
 *     <div className="note-prose" dangerouslySetInnerHTML={{ __html: content }} />
 *
 * — the stored HTML of ANY user's note, handed to the browser as markup, with
 * every author-supplied `style`, `class`, `id` and event attribute intact. Two
 * consequences, one visible and one not:
 *
 *   1. THE INVISIBLE-TEXT BUG (the owner's report). Notes pasted in from
 *      outside the app carry inline colours — `style="color:#ffffff"` written
 *      against a white page elsewhere — and in Lawexa's dark theme those
 *      paragraphs rendered as text you could select but not see. The fix is
 *      HERE, not in the backend and not in a stylesheet override: the parse
 *      DROPS every presentational attribute, so an author colour has no path
 *      to the DOM at all and the reading surface's own typography always wins.
 *   2. STORED XSS. Any registered account can author a note, and a published
 *      note is read by strangers. `dangerouslySetInnerHTML` on that content is
 *      the textbook shape.
 *
 * ── HOW IT IS SAFE (the three properties) ───────────────────────────────────
 *
 *   (a) WE PARSE, WE DO NOT PATTERN-MATCH. `DOMParser.parseFromString(html,
 *       'text/html')` builds an INERT document: it is not connected to a
 *       browsing context, so scripts never execute, `src`/`href` resources are
 *       never fetched, and no `onerror` ever fires. It is the browser's own
 *       HTML5 parser, which means the tree we inspect is exactly the tree a
 *       browser would build — every mangled-tag, entity and encoding trick a
 *       regex sanitiser misses has already been resolved into plain nodes
 *       before the first decision is made.
 *
 *   (b) ALLOWLIST, NOT DENYLIST, ON BOTH AXES. Every element gets exactly one
 *       of three dispositions ({@link RENDER_AS}, {@link DROP_SUBTREE}, and
 *       "everything else"), and attributes are dropped WHOLESALE except the
 *       three the model actually carries (`href`, `src`, `alt`), each of which
 *       is re-validated here. There is no "strip the dangerous ones" step to
 *       fall behind a new attack; an attribute survives only by being named.
 *
 *   (c) THE OUTPUT CANNOT CARRY MARKUP. A {@link NoteNode} holds text, a tag
 *       from a closed union, and validated URLs. The renderer builds React
 *       elements from it, so escaping is structural rather than remembered,
 *       and the degrade is ONE-WAY: nothing that arrives as text can ever be
 *       promoted back to markup.
 *
 * ── UNKNOWN MARKUP DEGRADES TO TEXT ─────────────────────────────────────────
 * An element that is neither rendered nor dropped is UNWRAPPED: it disappears
 * and its children take its place. That is what makes a `<div>`, a `<font>`, a
 * pasted `<table>` or a custom element render as the reading it contains
 * rather than as either a broken box or nothing at all. Only the genuinely
 * dangerous or genuinely non-textual elements ({@link DROP_SUBTREE}) take
 * their contents with them.
 *
 * ── NO NEW DEPENDENCY ───────────────────────────────────────────────────────
 * `DOMParser` is a platform API and the walk is ~120 lines, so nothing is
 * installed for this. The usual alternatives were considered and rejected:
 * `dompurify` sanitises HTML into HTML, which still has to be injected;
 * `html-react-parser` converts to React but leaves the security question to a
 * sanitiser you must add anyway, and its default is to preserve attributes —
 * the exact behaviour the invisible-text bug needs removed.
 */

/* ── The output model ────────────────────────────────────────────────────── */

/**
 * The tags the renderer may emit. A closed union, so adding a tag means adding
 * it to {@link RENDER_AS} and to the renderer's class table — it can never be
 * introduced by data.
 *
 * `h1` IS ABSENT ON PURPOSE. The note's own title is the page's only `h1`, so
 * author headings are demoted one level (`h1`→`h2`, `h2`→`h3`, …, floor `h6`).
 * A document with two `h1`s is a real accessibility defect, and the note body
 * is the part that must yield.
 */
export type NoteTag =
  | 'p'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'ul'
  | 'ol'
  | 'li'
  | 'blockquote'
  | 'pre'
  | 'code'
  | 'strong'
  | 'em'
  | 'u'
  | 's'
  | 'sub'
  | 'sup'
  | 'br'
  | 'hr';

/** How a validated link is navigated. See {@link safeHref}. */
export type NoteLinkMode =
  /** A root-relative path inside Lawexa — client navigation. */
  | 'internal'
  /** An `http(s)` address elsewhere — opens in a new tab, `rel`-hardened. */
  | 'external'
  /** `mailto:` / `tel:` — hands off to the OS, never a new tab. */
  | 'protocol';

export type NoteNode =
  | { kind: 'text'; key: string; text: string }
  | { kind: 'element'; key: string; tag: NoteTag; children: NoteNode[] }
  | { kind: 'link'; key: string; href: string; mode: NoteLinkMode; children: NoteNode[] }
  /** A v1 case mention (or any link that resolves to a case page) — rendered
   *  with the shared case hover/tap preview instead of as a bare link. */
  | { kind: 'case'; key: string; slug: string; children: NoteNode[] }
  | { kind: 'image'; key: string; src: string; alt: string };

/* ── The allowlists ──────────────────────────────────────────────────────── */

/**
 * Source tag → the tag we render it as. Everything not named here either drops
 * ({@link DROP_SUBTREE}) or unwraps.
 *
 * The set is exactly the wave spec's verbs — headings, lists, quote, code,
 * link, image, bold/italic/underline/strike — plus the structural minimum a
 * document needs (`p`, `li`, `br`, `hr`, `pre`). Presentational synonyms are
 * normalised to their semantic form (`b`→`strong`, `i`→`em`, `strike`/`del`
 * →`s`) so the reading surface styles ONE element per meaning.
 */
const RENDER_AS: Readonly<Record<string, NoteTag>> = {
  p: 'p',
  // Demoted by one level — see the `NoteTag` docblock.
  h1: 'h2',
  h2: 'h3',
  h3: 'h4',
  h4: 'h5',
  h5: 'h6',
  h6: 'h6',
  ul: 'ul',
  ol: 'ol',
  li: 'li',
  // A pasted TABLE ROW becomes a paragraph (review F4). We do not render
  // tables — they are not in the wave's verb list and a note is prose — but
  // unwrapping `tr` along with everything else ran a whole table together into
  // one word ("CaseYearDonoghue1932Carlill1893"). Promoting the ROW to a
  // paragraph keeps the table's only structure that survives translation to
  // prose: one line per row. The cells inside it separate with spaces (see
  // `SEPARATE_AFTER_UNWRAP`).
  tr: 'p',
  blockquote: 'blockquote',
  pre: 'pre',
  code: 'code',
  strong: 'strong',
  b: 'strong',
  em: 'em',
  i: 'em',
  u: 'u',
  s: 's',
  strike: 's',
  del: 's',
  sub: 'sub',
  sup: 'sup',
  br: 'br',
  hr: 'hr',
};

/**
 * Elements removed WITH their contents.
 *
 * Two families, and the distinction is worth stating because it is the only
 * place this module discards text a reader might have wanted:
 *
 *  - EXECUTABLE OR EMBEDDING (`script`, `iframe`, `object`, `svg`, `math`, the
 *    media elements): their children are code, markup in another language, or
 *    fallback content for an embed we are not making. Unwrapping a `<script>`
 *    would print its source as prose.
 *  - INTERACTIVE / DOCUMENT CHROME (`form` and its controls, `link`, `meta`,
 *    `title`, `base`): they carry no reading, and unwrapping the form controls
 *    would spill option labels into the text.
 *
 * The parse is inert (see property (a) above), so nothing here has ever been
 * live — this list is about what makes SENSE to read, and about never letting
 * a `<style>` block's CSS text land in the middle of a note.
 */
const DROP_SUBTREE: ReadonlySet<string> = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'frame',
  'frameset',
  'noframes',
  'object',
  'embed',
  'applet',
  'param',
  'svg',
  'math',
  'canvas',
  'audio',
  'video',
  'track',
  'source',
  'picture',
  'map',
  'area',
  'form',
  'input',
  'textarea',
  'select',
  'option',
  'optgroup',
  'button',
  'output',
  'progress',
  'meter',
  'link',
  'meta',
  'base',
  'title',
  'head',
  'dialog',
  'slot',
  'marquee',
  'xmp',
  'plaintext',
  'listing',
  'bgsound',
]);

/**
 * Unwrapped elements that must leave a SPACE behind them (review F4).
 *
 * Unwrapping is what makes unknown markup degrade to its reading, but it also
 * deletes the element boundary — and for a cell, a term or a caption, that
 * boundary was the only thing separating two words. A pasted table came out as
 * one run-on token. These are the unwrap targets whose contents are
 * SIBLING PHRASES rather than continuous prose, so each contributes a single
 * space after its children.
 *
 * `div`, `span`, `section` and friends are deliberately NOT here: they wrap
 * whole blocks, whose own tags already provide the separation, and a space
 * after every `</div>` would litter the text.
 */
const SEPARATE_AFTER_UNWRAP: ReadonlySet<string> = new Set([
  'td',
  'th',
  'caption',
  'dt',
  'dd',
  'figcaption',
]);

/**
 * Nesting depth cap.
 *
 * Prose does not nest sixty-four levels deep; a document that does is either a
 * parser artefact or an attempt to blow the recursion. Past the cap the
 * subtree is flattened to its text, which loses formatting but keeps every
 * word — the same "degrade, never fail" rule the rest of the module follows.
 *
 * There is deliberately NO node-count cap: silently truncating a long note
 * would hide content the reader is entitled to, and unlike depth, length is a
 * legitimate thing for a note to have.
 */
const MAX_DEPTH = 64;

/**
 * Whether the stored value contains ANY markup at all.
 *
 * GENERIC, NOT AN ALLOWLIST (review F3). This started as a list of the 22 tags
 * we expected, and that was a real defect: a note whose markup used only
 * unlisted tags — script-only, iframe-only, `<object>`, `<font>`, `<dl>`, a
 * bare `<table>` — matched nothing, took the PLAIN-TEXT path, and therefore
 * never reached the parser at all. `DROP_SUBTREE` was bypassed and the raw
 * source printed as visible prose. (React escapes it, so it was never an
 * injection — it was a reader looking at `<iframe src=…>` as a sentence.)
 *
 * Any tag-shaped run now sends the value to the parser, which is the component
 * that actually knows what to do with each tag. The plain-text path is left
 * for genuinely tag-free strings only — and `a < b` still correctly fails to
 * match, because `<` must be followed by a letter, `!` or `/` to look like a
 * tag.
 */
const LOOKS_LIKE_HTML = /<[a-z!/][^>]*>/i;

/* ── URL validation ──────────────────────────────────────────────────────── */

/** Schemes we will navigate to. Anything else — `javascript:`, `data:`,
 *  `vbscript:`, `blob:`, or a scheme invented tomorrow — is refused. */
const ALLOWED_SCHEME = /^(?:https?|mailto|tel):/i;

/** Any scheme at all, for telling "has a scheme" from "is a path". */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Strip the characters a browser IGNORES while reading a URL scheme — every
 * C0 control (tab, newline, NUL, …), the space, and NBSP. Written as a
 * character-code filter rather than a regex range so the intent is legible and
 * no invisible literal ever ends up in this file.
 */
function stripSchemeNoise(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code > 32 && code !== 160) out += char;
  }
  return out;
}

/**
 * Validate an `href` and say how it should be navigated, or `null` to refuse.
 *
 * THE SCHEME IS TESTED ON A STRIPPED COPY. `java\tscript:alert(1)` and
 * `  javascript:…` are the classic bypasses: browsers ignore control
 * characters and leading whitespace inside a scheme, so a naive
 * `startsWith('javascript:')` misses both. Every character below U+0021 (plus
 * NBSP) is removed before the scheme is read, while the value we RETURN is the
 * merely-trimmed original — we decide on what the browser would see and hand
 * back what the author wrote.
 *
 * `#fragment` links are refused rather than rendered: this module strips `id`
 * from every element, so no in-document target can exist and the link would
 * silently go nowhere. Scheme-less relative paths (`foo/bar`) are refused for
 * the same "we only link what we can address" reason — they would resolve
 * against `/notes/{slug}` and land somewhere nobody meant. Both degrade to
 * their own text, which is still readable.
 */
export function safeHref(raw: string | null): { href: string; mode: NoteLinkMode } | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  const stripped = stripSchemeNoise(raw);

  if (HAS_SCHEME.test(stripped)) {
    if (!ALLOWED_SCHEME.test(stripped)) return null;
    return {
      href: value,
      mode: /^(?:mailto|tel):/i.test(stripped) ? 'protocol' : 'external',
    };
  }

  // A path that only LOOKS root-relative is refused with the schemes.
  if (isUnusableRelativePath(value)) return null;
  if (value.startsWith('/')) return { href: value, mode: 'internal' };
  return null;
}

/**
 * Whether a scheme-less value is unusable as an internal address — because it
 * is really off-site, or because it does not address what it appears to.
 *
 * THREE FAMILIES, all of which passed the original `startsWith('//')` test:
 *
 *  1. PROTOCOL-RELATIVE (`//evil.example`) — inherits the page scheme; an
 *     off-site address wearing a path's clothes.
 *  2. BACKSLASH (review F2) — `/\evil.example`, `/\/evil.example`,
 *     `/\\evil.example`. All three read as ordinary root-relative paths to a
 *     string test, but the URL parser in every browser normalises `\` to `/`
 *     before resolving, so all three land on `https://evil.example/`. A note
 *     author could write a link that LOOKED internal, rendered through
 *     `next/link` with no `rel` hardening and no new-tab announcement, and
 *     navigated off-site. The guard refuses the character outright: a
 *     legitimate in-app path never contains a backslash, so this costs nothing
 *     real and cannot be out-thought by a new arrangement of it.
 *  3. DOT SEGMENTS (review F7) — `/cases/..` resolves to `/`, so an anchor
 *     reading "Donoghue v Stevenson" would quietly land on the home page.
 *     Rejecting the case-mention treatment alone was not enough: the anchor
 *     simply fell through to this function and became a plain internal link
 *     with the same destination. Only WHOLE `.` / `..` segments are refused —
 *     a dot INSIDE a segment is ordinary (`/cases/r-v-smith-no.2`).
 *
 * A refused link is not dropped; it renders its own text. See {@link safeHref}.
 */
function isUnusableRelativePath(value: string): boolean {
  if (value.startsWith('//') || value.includes('\\')) return true;
  const pathname = value.split(/[?#]/, 1)[0];
  return pathname.split('/').some((segment) => segment === '.' || segment === '..');
}

/**
 * Validate an image `src`. Narrower than {@link safeHref} on purpose:
 *
 *  - `mailto:`/`tel:` are meaningless on an image;
 *  - `data:` is refused even though an inert `<img>` would not execute an SVG
 *    payload — a data URI in note content is either a megabyte of base64 the
 *    reader pays for on every load, or an attempt at something. Note images
 *    are uploaded through `POST /api/files` and come back as real URLs.
 */
export function safeImageSrc(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  const stripped = stripSchemeNoise(raw);

  if (HAS_SCHEME.test(stripped)) {
    return /^https?:/i.test(stripped) ? value : null;
  }
  // The same test the link path uses, including the backslash family (review
  // F2) — an `<img src>` resolves through the identical URL parser, so
  // `/\evil.example/pixel.gif` would have fetched off-site and leaked the
  // reader's referrer just as readily.
  if (isUnusableRelativePath(value)) return null;
  return value.startsWith('/') ? value : null;
}

/* ── Case-mention detection ──────────────────────────────────────────────── */

/** Path-ANCHORED: the path must BE a case page, so `/admin/cases/123` never
 *  matches. */
const CASE_PATH = /^\/cases\/([^/?#]+)\/?$/;

/** Hosts whose absolute `/cases/{slug}` links are OUR case pages. A static
 *  allow-list, so a foreign site with a coincidental `/cases/` segment is never
 *  hijacked into an internal link and a preview fetch. */
const OWN_HOSTS: ReadonlySet<string> = new Set(['lawexa.com', 'www.lawexa.com']);

/**
 * The case slug an anchor points at, or `null`.
 *
 * ── HOW v1 SERIALISED A CASE MENTION (read from `components/notes/mention/
 *    CaseMention.ts`, the TipTap extension that wrote every one of them) ─────
 *
 *     <a data-type="case-mention" class="case-mention"
 *        href="/cases/{slug}" data-case-id="{id}" data-case-slug="{slug}"
 *     >@{label}</a>
 *
 * So the HREF alone is enough for every well-formed mention, and matching on
 * it ALSO catches a plain hand-written link to a case page — which is the
 * right behaviour, since the reader does not care how the link got there.
 * `data-case-slug` is the fallback for a mention whose href was lost to a
 * copy-paste round trip through another editor; it is accepted only when
 * `data-type` confirms the element really is a mention, and only when the
 * value is a bare slug (no slash, no query, no whitespace), because it is
 * about to become a path segment.
 *
 * MIRRORS, DELIBERATELY, `extractCaseSlug` in the conversations markdown
 * renderer — same anchoring, same host allow-list. It is not imported from
 * there because that module is a `'use client'` React component and this one
 * must stay pure; and the two inputs genuinely differ (that renderer never
 * sees raw HTML, so it has no reason to know about `data-case-slug`).
 */
export function noteCaseSlug(element: Element): string | null {
  const fromHref = caseSlugFromHref(element.getAttribute('href'));
  if (fromHref) return usableSlug(fromHref);

  if (element.getAttribute('data-type') !== 'case-mention') return null;
  const raw = element.getAttribute('data-case-slug')?.trim();
  if (!raw || /[\s/?#]/.test(raw)) return null;
  return usableSlug(raw);
}

/**
 * Reject a slug that is only dots (review F7).
 *
 * `..` passes every other test — it has no slash, no whitespace, no query —
 * and becomes `/cases/..`, which the URL parser resolves to `/`. So a note
 * could carry something that LOOKED like a case reference, complete with the
 * hover preview's trigger styling, and quietly navigate the reader to the home
 * page (while the preview fetched a case named `..` and failed). A slug made
 * of nothing but dots addresses no case, so the anchor degrades to its own
 * text like any other unresolvable reference.
 */
function usableSlug(slug: string): string | null {
  return /^\.+$/.test(slug) ? null : slug;
}

function caseSlugFromHref(href: string | null): string | null {
  if (!href) return null;
  const value = href.trim();
  if (!value) return null;

  let pathname: string;
  if (value.startsWith('/') && !value.startsWith('//')) {
    pathname = value.split(/[?#]/, 1)[0];
  } else {
    try {
      const url = new URL(value);
      if (!OWN_HOSTS.has(url.hostname)) return null;
      pathname = url.pathname;
    } catch {
      return null;
    }
  }

  const match = CASE_PATH.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    // Malformed percent-encoding — fall back to the raw segment rather than
    // dropping a link that is plainly a case reference.
    return match[1].trim() || null;
  }
}

/* ── The walk ────────────────────────────────────────────────────────────── */

/** Node-key mint. Deterministic per parse, so React keys are stable for a
 *  given content string and a re-parse of identical HTML reconciles in place. */
class KeyMint {
  private next = 0;
  take(): string {
    this.next += 1;
    return `n${this.next}`;
  }
}

/**
 * Parse stored note HTML into the sanitised node tree.
 *
 * THREE ENTRY CONDITIONS, all honest:
 *
 *  - EMPTY content → an empty array; the caller renders its own empty state
 *    rather than an empty document.
 *  - NO `DOMParser` (a server render — the reader is a client component, but
 *    client components still prerender) → the whole value degraded to plain
 *    text in one paragraph. Nothing is lost that a reader can see, and the
 *    real tree arrives on the client's first paint.
 *  - NO TAGS AT ALL (a note stored as plain text, which pre-editor rows can
 *    be) → split on blank lines into paragraphs, so it reads as prose instead
 *    of one unbroken block.
 */
export function parseNoteHtml(html: string | null | undefined): NoteNode[] {
  if (!html || !html.trim()) return [];
  const keys = new KeyMint();

  if (!LOOKS_LIKE_HTML.test(html)) {
    return plainTextParagraphs(html, keys);
  }

  if (typeof DOMParser === 'undefined') {
    const text = htmlToPlainText(html);
    return text ? plainTextParagraphs(text, keys) : [];
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  return convertChildren(doc.body, keys, 0, false);
}

/**
 * Tags that may not legally nest inside a `<p>`, and would if left alone.
 *
 * `p` is the whole list today, and it earns its place because of the `tr: 'p'`
 * promotion (review F4): a pasted `<td><p>x</p></td>` is a perfectly legal
 * source tree, but with the row rendered as a paragraph its cell's paragraph
 * would land inside one. React does not re-parse, so the invalid nesting would
 * survive into the DOM (plus a dev-mode `validateDOMNesting` warning). Inside
 * a paragraph these UNWRAP with a trailing space instead, which reads as the
 * same line — exactly what a table row flattened to prose should be.
 */
const NOT_INSIDE_PARAGRAPH: ReadonlySet<NoteTag> = new Set<NoteTag>(['p']);

/**
 * Blank-line-separated text → one paragraph each, with SINGLE newlines turned
 * into real `<br>` nodes.
 *
 * The breaks are made STRUCTURAL rather than left to a `white-space: pre-line`
 * rule on the reading surface, and that is the whole point: `pre-line` would
 * apply to the HTML path too, where every newline between two pretty-printed
 * block tags would become a visible blank line. A `<br>` is only ever where
 * this function put it.
 */
function plainTextParagraphs(value: string, keys: KeyMint): NoteNode[] {
  return value
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const children: NoteNode[] = [];
      paragraph.split(/\r?\n/).forEach((line, index) => {
        if (index > 0) {
          children.push({ kind: 'element', key: keys.take(), tag: 'br', children: [] });
        }
        children.push({ kind: 'text', key: keys.take(), text: line });
      });
      return { kind: 'element' as const, key: keys.take(), tag: 'p' as const, children };
    });
}

function convertChildren(
  parent: Node,
  keys: KeyMint,
  depth: number,
  /** True once an ancestor has been rendered as a `<p>` — see
   *  {@link NOT_INSIDE_PARAGRAPH}. */
  inParagraph: boolean,
): NoteNode[] {
  const out: NoteNode[] = [];
  for (const child of Array.from(parent.childNodes)) {
    pushConverted(child, keys, depth, inParagraph, out);
  }
  return out;
}

/** Convert one source node, appending 0..n output nodes (an unwrapped element
 *  contributes its children directly, which is why this appends rather than
 *  returns). */
function pushConverted(
  node: Node,
  keys: KeyMint,
  depth: number,
  inParagraph: boolean,
  out: NoteNode[],
): void {
  // TEXT. Kept verbatim — no trimming and no whitespace collapsing, so a space
  // between two inline marks survives and `<pre>` keeps its shape. Incidental
  // indentation between block elements costs nothing: CSS removes whitespace
  // between blocks, and a text node the browser would have collapsed is one
  // React renders and the layout ignores.
  if (node.nodeType === 3 /* TEXT_NODE */) {
    const text = node.nodeValue ?? '';
    if (text) out.push({ kind: 'text', key: keys.take(), text });
    return;
  }

  // Comments, processing instructions, doctypes — no reading in them.
  if (node.nodeType !== 1 /* ELEMENT_NODE */) return;

  const element = node as Element;
  const tag = element.tagName.toLowerCase();

  if (DROP_SUBTREE.has(tag)) return;

  // Past the depth cap the subtree keeps its words and loses its structure.
  if (depth >= MAX_DEPTH) {
    const text = element.textContent ?? '';
    if (text) out.push({ kind: 'text', key: keys.take(), text });
    return;
  }

  if (tag === 'a') {
    pushAnchor(element, keys, depth, inParagraph, out);
    return;
  }

  if (tag === 'img') {
    const src = safeImageSrc(element.getAttribute('src'));
    // An image we will not load contributes its alt text if it has one — the
    // caption is often the only thing that made the line make sense.
    if (!src) {
      const alt = element.getAttribute('alt')?.trim();
      if (alt) out.push({ kind: 'text', key: keys.take(), text: alt });
      return;
    }
    out.push({
      kind: 'image',
      key: keys.take(),
      src,
      alt: element.getAttribute('alt')?.trim() ?? '',
    });
    return;
  }

  const rendered = RENDER_AS[tag];
  // A paragraph inside a paragraph is invalid nesting React would faithfully
  // reproduce, so it falls through to the unwrap below instead.
  if (rendered && !(inParagraph && NOT_INSIDE_PARAGRAPH.has(rendered))) {
    // `br` and `hr` are void: they have no children by definition, and asking
    // for them would be a lie in the model.
    const children =
      rendered === 'br' || rendered === 'hr'
        ? []
        : convertChildren(element, keys, depth + 1, inParagraph || rendered === 'p');
    out.push({ kind: 'element', key: keys.take(), tag: rendered, children });
    return;
  }

  // UNWRAP — the element disappears, its reading stays. `div`, `span`, `font`,
  // `table` and its cells, a custom element, anything at all: the note's words
  // are what the reader came for.
  for (const child of Array.from(element.childNodes)) {
    pushConverted(child, keys, depth + 1, inParagraph, out);
  }
  // …but a boundary that was carrying meaning leaves a space behind it, so
  // two cells do not fuse into one word (review F4). A paragraph demoted by
  // the nesting guard above separates for the same reason.
  if (SEPARATE_AFTER_UNWRAP.has(tag) || rendered === 'p') {
    out.push({ kind: 'text', key: keys.take(), text: ' ' });
  }
}

function pushAnchor(
  element: Element,
  keys: KeyMint,
  depth: number,
  inParagraph: boolean,
  out: NoteNode[],
): void {
  const children = convertChildren(element, keys, depth + 1, inParagraph);
  // An anchor with no reading in it is nothing to click.
  if (children.length === 0) return;

  const slug = noteCaseSlug(element);
  if (slug) {
    out.push({ kind: 'case', key: keys.take(), slug, children });
    return;
  }

  const link = safeHref(element.getAttribute('href'));
  if (!link) {
    // Refused (or absent) destination — the label still reads, it just is not
    // a link. Never a link to nowhere, and never a `javascript:` one.
    out.push(...children);
    return;
  }

  out.push({
    kind: 'link',
    key: keys.take(),
    href: link.href,
    mode: link.mode,
    children,
  });
}
