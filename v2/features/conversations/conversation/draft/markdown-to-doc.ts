import type { JSONContent } from '@tiptap/core';
import type { Nodes, PhrasingContent, Root, RootContent, Table } from 'mdast';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { noteFont, noteSize, type NoteFont, type NoteSize } from '@/lib/notes/note-fonts';
import { FONT_STYLE } from '@/v2/features/notes/editor/font-style';

/**
 * markdown-to-doc — a draft's Markdown as the note editor's document, so the
 * draft Lawexa wrote opens in the editor (the draft editor, Stay 23 October
 * 2026) with its headings, lists, tables and emphasis intact.
 *
 * Markdown is parsed (remark, with GitHub tables and strikethrough, the same
 * dialect the chat renders) and walked into Tiptap's JSON directly. No HTML is
 * produced or parsed on the way, so nothing in a draft can smuggle markup or a
 * style into the editor: only the nodes below are made, and anything else
 * becomes plain text.
 *
 * It maps onto the note editor's schema (extensions.ts): headings 1 to 3 (a
 * deeper one becomes a 3), paragraphs, both lists, quotes, code blocks, a rule,
 * tables, and the bold, italic, strike, code and link marks.
 *
 * FONTS (Stay, 24 October 2026: Lawexa may set them). Two ways in, both read
 * as the editor's one font mark (font-style.ts), so a saved note keeps them as
 * the span the server allows:
 *   - the draft's own font and size (`<draft font size>`, draft-blocks.ts),
 *     passed in as `base` and put on every run of text, except that headings
 *     take the font but keep their own size;
 *   - `<span data-font="…" data-size="…">words</span>` inside the Markdown,
 *     which wins over `base` for its words.
 * Only allowed values are kept (lib/notes/note-fonts.ts); a span with none is
 * dropped and its words stay. Code takes no font, as in the editor.
 *
 * ALIGNMENT (Stay, 2 November 2026, thread 20a87a84: centring in drafts as in
 * notes; the shape agreed in thread 384c). A line alone in the editor's own
 * form, `<p style="text-align: center">words</p>` or `<h1>` to `<h3>` with
 * center, right or justify, becomes that paragraph or heading with its
 * alignment, its words read as inline Markdown; `<br>` inside it is a line
 * break (a signature block centred with Shift+Enter, woz ee444601). It is
 * read whenever it stands alone on its line, blank lines around it or not:
 * lines written one under the other each become their own block, and the
 * Markdown lines beside it are read as Markdown. While the draft is still being written
 * the last line may not have its closing tag yet: it is read as aligned all
 * the same, and an opening tag still being typed shows nothing. The font span
 * and this line are the only tags read: any other HTML is still text.
 *
 * Three slips Lawexa makes are read as the same blocks (Tester's live check,
 * 85466156; the shapes agreed with woz, b2e6ef86 and 9282c136), and nothing
 * else: a heading inside the aligned `p` on one line, `<h2>words</h2>` or
 * `## words`, is that heading, aligned; and a block split over lines, its
 * opening and closing tags each alone on a line, is read line by line as one
 * aligned block each (a `#` line a heading; inside an `h1` to `h3`, its lines
 * are one heading). Blank lines inside make nothing. A split block with
 * another tag inside, inside a code fence, or with no closing tag stays text,
 * except at the very end of a draft still being written, where its lines show
 * aligned before the closing tag arrives. A line holding only `<br>`s, a gap
 * Lawexa leaves before signature lines (woz d3643d84), is one empty paragraph.
 *
 * Inside an aligned line, and nowhere else, `<strong>` and `<b>`, `<em>` and
 * `<i>`, and `<u>` are bold, italic and underline (Techlead ee4398e5; shapes
 * 1966bfb1). An aligned `div` reads as an aligned `p`, on one line or split;
 * inside a split `p` or `div`, a plain `<h1>`–`<h3>` or `<p>` line is that
 * block, aligned. Any other tag still stays text.
 */

type Mark = NonNullable<JSONContent['marks']>[number];

export interface DraftFont {
  font: NoteFont | null;
  size: NoteSize | null;
}

const NO_FONT: DraftFont = { font: null, size: null };

// remark-breaks, as the chat renders (MarkdownText.tsx): one newline is a new
// line, so an address block written line by line opens as lines (a hard break,
// saved as <br>). Without it the newline stayed inside the text, showed in the
// editor, and was folded into a space once saved and reopened (Lucy's live
// check, 24 October 2026).
const parser = unified().use(remarkParse).use(remarkBreaks).use(remarkGfm);

export function markdownToDoc(markdown: string, base: DraftFont = NO_FONT): JSONContent {
  const root = parser.runSync(parser.parse(alignedSlipsAsLines(markdown))) as Root;
  const last = root.children[root.children.length - 1];
  const content = root.children.flatMap((node) => block(node, base, node === last));
  return { type: 'doc', content: content.length > 0 ? content : [{ type: 'paragraph' }] };
}

/** `<span …>` alone (a font run opening), or `</span>`. */
const SPAN_OPEN = /^<span\b([^>]*)>$/i;
const SPAN_CLOSE = /^<\/span\s*>$/i;

function spanFont(attributes: string, outer: DraftFont): DraftFont {
  const value = (name: string) => new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(attributes)?.[1] ?? null;
  return {
    font: noteFont(value('data-font')) ?? outer.font,
    size: noteSize(value('data-size')) ?? outer.size,
  };
}

function blocks(nodes: readonly RootContent[], font: DraftFont): JSONContent[] {
  return nodes.flatMap((node) => block(node, font));
}

type Align = 'center' | 'right' | 'justify';

/**
 * One aligned line: the tag, its one style (any case, spaces around the
 * colon, a closing `;`, either quote), its words, and the closing tag.
 */
const ALIGNED_LINE = /^<(p|h[1-3]|div)\s+style\s*=\s*(["'])\s*text-align\s*:\s*(center|right|justify)\s*;?\s*\2\s*>(.*?)(<\/\1\s*>)?$/i;

/** An aligned line's opening tag still being typed: nothing to show yet. */
const OPENING_TAG = /^<(?:p|h[1-3]|div)(?:\s[^>]*)?$/i;

/**
 * An HTML block's lines, each an aligned paragraph or heading where it is one;
 * `null` when no line is, so the block stays text as before. `streaming`: the
 * block is the draft's last, so its last line may lack its closing tag.
 */
function alignedLines(value: string, font: DraftFont, streaming: boolean): JSONContent[] | null {
  const lines = value.split('\n');
  const content: JSONContent[] = [];
  // The lines between aligned ones, read as Markdown together (a paragraph may run over several).
  let others: string[] = [];
  const flush = () => {
    if (others.some((line) => line.trim())) content.push(...(markdownToDoc(others.join('\n'), font).content ?? []));
    others = [];
  };
  let aligned = false;
  lines.forEach((raw, index) => {
    const line = raw.trim();
    const open = streaming && index === lines.length - 1;
    if (BREAKS_ONLY.test(line)) {
      aligned = true;
      flush();
      content.push({ type: 'paragraph' });
      return;
    }
    const match = ALIGNED_LINE.exec(line);
    if (match && (match[5] || open)) {
      aligned = true;
      flush();
      const tag = match[1].toLowerCase();
      const align = match[3].toLowerCase() as Align;
      content.push(
        tag === 'p' || tag === 'div'
          ? withContent({ type: 'paragraph', attrs: { textAlign: align } }, inlineMarkdown(match[4], font))
          : // A heading keeps its own size, as a `#` heading does.
            withContent(
              { type: 'heading', attrs: { level: Number(tag[1]), textAlign: align } },
              inlineMarkdown(match[4], { font: font.font, size: null }),
            ),
      );
      return;
    }
    if (open && OPENING_TAG.test(line)) return;
    others.push(raw);
  });
  if (!aligned) return null;
  flush();
  return content;
}

/** An aligned block's opening tag alone on its line, up to three spaces in (four is code). */
const OPENING_LINE = /^ {0,3}<(p|h[1-3]|div)\s+style\s*=\s*(["'])\s*text-align\s*:\s*(center|right|justify)\s*;?\s*\2\s*>\s*$/i;
const CLOSING_LINE = /^ {0,3}<\/(p|h[1-3]|div)\s*>\s*$/i;
/** A plain `<p>words</p>` line inside a split `p` or `div`. */
const PLAIN_PARAGRAPH = /^<p\s*>(.*)<\/p\s*>$/i;
/** A heading inside an aligned `p`: `<h2>words</h2>`, or `## words`. */
const INNER_HEADING = /^<(h[1-3])\s*>(.*)<\/\1\s*>$/i;
const HASH_HEADING = /^(#{1,3})\s+(.*)$/;
/** A line inside a split block that is a tag of its own (not the font span or a `<br>`): the block stays text. */
const TAG_LINE = /^<\/?(?!span\b|br\b)[a-z]/i;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HALF_TAG = /^ {0,3}<\/?[a-z0-9]*$/i;
/** A line holding only `<br>`s, up to three spaces in as the server reads it (woz af6173d6): a gap, one empty paragraph. */
const BREAKS_ONLY = /^ {0,3}(?:<br\s*\/?>[ \t]*)+$/i;

function alignedLine(tag: string, align: string, words: string): string {
  return `<${tag} style="text-align: ${align}">${words}</${tag}>`;
}

/** A `p` line's words as a heading's, when they are one: `[tag, words]`, else `null`. */
function headingInside(words: string): [string, string] | null {
  const inner = INNER_HEADING.exec(words.trim());
  if (inner) return [inner[1].toLowerCase(), inner[2]];
  const hashes = HASH_HEADING.exec(words.trim());
  return hashes ? [`h${hashes[1].length}`, hashes[2]] : null;
}

/** One aligned line, with a heading inside its `p` (or `#`s inside its `h`) made the heading itself. */
function oneAlignedLine(line: string): string {
  const match = /^ {0,3}\S/.test(line) ? ALIGNED_LINE.exec(line.trim()) : null;
  if (!match || !match[5]) return line;
  const tag = match[1].toLowerCase();
  const align = match[3].toLowerCase();
  if (tag === 'p' || tag === 'div') {
    const heading = headingInside(match[4]);
    if (heading) return alignedLine(heading[0], align, heading[1]);
    return tag === 'div' ? alignedLine('p', align, match[4]) : line;
  }
  return alignedLine(tag, align, match[4].replace(/^\s*#{1,3}\s+/, ''));
}

/** A split block's lines, as one-line aligned blocks; `null` when one is a tag of its own. */
function splitBlockLines(tag: string, align: string, inner: readonly string[]): string[] | null {
  const lines = inner.map((line) => line.trim()).filter(Boolean);
  const paragraphs = tag === 'p' || tag === 'div';
  // A plain heading or paragraph line is allowed inside a split `p` or `div`; any other tag line keeps the block text.
  const allowed = (line: string) => paragraphs && (INNER_HEADING.test(line) || PLAIN_PARAGRAPH.test(line));
  if (lines.some((line) => TAG_LINE.test(line) && !allowed(line))) return null;
  if (lines.length === 0) return [];
  if (!paragraphs) return [alignedLine(tag, align, lines.map((line) => line.replace(/^#{1,3}\s+/, '')).join('<br>'))];
  return lines.map((line) => {
    const heading = headingInside(line);
    if (heading) return alignedLine(heading[0], align, heading[1]);
    return alignedLine('p', align, PLAIN_PARAGRAPH.exec(line)?.[1] ?? line);
  });
}

/**
 * The slips Lawexa makes around an aligned block, rewritten as the one-line
 * blocks they mean before the Markdown is parsed; every other line as it was.
 */
function alignedSlipsAsLines(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let fence: string | null = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const fenceMark = FENCE.exec(line)?.[1];
    if (fence !== null) {
      if (fenceMark && fenceMark[0] === fence[0] && fenceMark.length >= fence.length) fence = null;
      out.push(line);
      continue;
    }
    if (fenceMark) {
      fence = fenceMark;
      out.push(line);
      continue;
    }
    if (BREAKS_ONLY.test(line)) {
      // Alone between blank lines, so it is an HTML block of its own and not a break inside a paragraph.
      out.push('', '<br>', '');
      continue;
    }
    const opening = OPENING_LINE.exec(line);
    if (!opening) {
      out.push(oneAlignedLine(line));
      continue;
    }
    const tag = opening[1].toLowerCase();
    const align = opening[3].toLowerCase();
    let end = index + 1;
    while (end < lines.length && !FENCE.test(lines[end]) && CLOSING_LINE.exec(lines[end])?.[1].toLowerCase() !== tag) end++;
    const closed = end < lines.length && !FENCE.test(lines[end]);
    // No closing tag: only the end of a draft still being written, with no blank line in what follows, reads as open.
    const open = !closed && end === lines.length && !lines.slice(index + 1).some((rest) => !rest.trim());
    // A closing tag still being typed shows nothing.
    const inner = lines.slice(index + 1, end).filter((rest, at, all) => !(open && at === all.length - 1 && HALF_TAG.test(rest)));
    const block = closed || open ? splitBlockLines(tag, align, inner) : null;
    if (!block) {
      out.push(line);
      continue;
    }
    out.push('', ...block, '');
    index = end;
  }
  return out.join('\n');
}

/** `<br>`, `<br/>` or `<br />`: a line break inside an aligned line. */
const LINE_BREAK = /<br\s*\/?>/gi;
/** Stands in for each `<br>` while the words are read, so bold, italic or a link may run across one. */
const BREAK_MARK = '\uE000';

/**
 * An aligned line's words, read as inline Markdown: bold, italic, links and
 * the font span, with each `<br>` a line break. The words are read once, so
 * `**A. Name<br>Director**` is bold on both lines.
 */
function inlineMarkdown(words: string, font: DraftFont): JSONContent[] {
  const marked = words.replaceAll(BREAK_MARK, '').replace(LINE_BREAK, BREAK_MARK);
  return inlinePart(marked, font).flatMap((node): JSONContent[] => {
    if (node.type !== 'text' || !node.text?.includes(BREAK_MARK)) return [node];
    return node.text.split(BREAK_MARK).flatMap((text, index) => [
      ...(index > 0 ? [{ type: 'hardBreak' }] : []),
      ...(text ? [{ ...node, text }] : []),
    ]);
  });
}

function inlinePart(words: string, font: DraftFont): JSONContent[] {
  const root = parser.runSync(parser.parse(words)) as Root;
  const first = root.children[0];
  if (root.children.length === 1 && first.type === 'paragraph') return inline(first.children, font, [], true);
  const text = root.children.map(textOf).join(' ');
  return text ? [textNode(text, [], font)] : [];
}

function block(node: RootContent, font: DraftFont, last = false): JSONContent[] {
  switch (node.type) {
    case 'heading':
      // A heading keeps its own size: the draft's font reaches it, the draft's size does not.
      return [
        withContent(
          { type: 'heading', attrs: { level: Math.min(3, Math.max(1, node.depth)) } },
          inline(node.children, { font: font.font, size: null }),
        ),
      ];
    case 'paragraph':
      return [withContent({ type: 'paragraph' }, inline(node.children, font))];
    case 'list':
      return [
        {
          type: node.ordered ? 'orderedList' : 'bulletList',
          ...(node.ordered && typeof node.start === 'number' && node.start !== 1 ? { attrs: { start: node.start } } : {}),
          content: node.children.map((item) => ({ type: 'listItem', content: nonEmptyBlocks(item.children, font) })),
        },
      ];
    case 'blockquote':
      return [{ type: 'blockquote', content: nonEmptyBlocks(node.children, font) }];
    case 'code':
      return [withContent({ type: 'codeBlock', attrs: { language: node.lang ?? null } }, node.value ? [{ type: 'text', text: node.value }] : [])];
    case 'thematicBreak':
      return [{ type: 'horizontalRule' }];
    case 'table':
      return [table(node, font)];
    case 'html': {
      const value = node.value.trim();
      // A font span's tag alone on its line opens or closes nothing across blocks: drop it.
      if (!value || SPAN_OPEN.test(value) || SPAN_CLOSE.test(value)) return [];
      const aligned = alignedLines(value, font, last);
      if (aligned) return aligned;
      // An aligned line's opening tag still arriving at the draft's end shows nothing yet.
      if (last && OPENING_TAG.test(value)) return [];
      return [{ type: 'paragraph', content: [textNode(node.value, [], font)] }];
    }
    default: {
      // Footnotes, definitions and anything else the dialect may yield: their text, if any.
      const text = textOf(node);
      return text ? [{ type: 'paragraph', content: [textNode(text, [], font)] }] : [];
    }
  }
}

/** A list item or quote must hold at least one block. */
function nonEmptyBlocks(nodes: readonly RootContent[], font: DraftFont): JSONContent[] {
  const content = blocks(nodes, font);
  return content.length > 0 ? content : [{ type: 'paragraph' }];
}

function table(node: Table, font: DraftFont): JSONContent {
  return {
    type: 'table',
    content: node.children.map((row, rowIndex) => ({
      type: 'tableRow',
      content: row.children.map((cell) => ({
        type: rowIndex === 0 ? 'tableHeader' : 'tableCell',
        content: [withContent({ type: 'paragraph' }, inline(cell.children, font))],
      })),
    })),
  };
}

/**
 * A run of inline nodes. A font span's open and close tags arrive as their own
 * `html` siblings around its words, so the font in force is a stack walked
 * along the siblings: an open pushes, a close pops, and a close with nothing
 * open is dropped.
 */
/**
 * `<strong>`, `<b>`, `<em>`, `<i>` and `<u>` with no attributes, opening or
 * closing: read as marks inside an aligned line only (`tags`). One left open
 * marks the rest of the line.
 */
const MARK_TAG = /^<(\/?)(strong|b|em|i|u)\s*>$/i;
const TAG_MARK: Record<string, Mark['type']> = { strong: 'bold', b: 'bold', em: 'italic', i: 'italic', u: 'underline' };

function inline(nodes: readonly PhrasingContent[], outer: DraftFont, outerMarks: readonly Mark[] = [], tags = false): JSONContent[] {
  const fonts: DraftFont[] = [outer];
  const font = () => fonts[fonts.length - 1];
  // Marks opened by a tag and not yet closed, on everything after them.
  const opened: Mark[] = [];
  const marks = () => [...outerMarks, ...opened];
  return nodes.flatMap((node): JSONContent[] => {
    switch (node.type) {
      case 'text':
        return node.value ? [textNode(node.value, marks(), font())] : [];
      case 'strong':
        return inline(node.children, font(), [...marks(), { type: 'bold' }], tags);
      case 'emphasis':
        return inline(node.children, font(), [...marks(), { type: 'italic' }], tags);
      case 'delete':
        return inline(node.children, font(), [...marks(), { type: 'strike' }], tags);
      case 'inlineCode':
        return node.value ? [textNode(node.value, [...marks(), { type: 'code' }], NO_FONT)] : [];
      case 'link':
        return inline(node.children, font(), [...marks(), { type: 'link', attrs: { href: node.url } }], tags);
      case 'break':
        return [{ type: 'hardBreak' }];
      case 'image':
        return node.alt ? [textNode(node.alt, marks(), font())] : [];
      case 'html': {
        const tag = tags ? MARK_TAG.exec(node.value.trim()) : null;
        if (tag) {
          const type = TAG_MARK[tag[2].toLowerCase()];
          if (!tag[1]) {
            opened.push({ type });
          } else {
            // A closing tag ends the latest of its kind; a stray one is dropped (woz 2fe1cc54).
            const at = opened.findLastIndex((mark) => mark.type === type);
            if (at >= 0) opened.splice(at, 1);
          }
          return [];
        }
        const open = SPAN_OPEN.exec(node.value.trim());
        if (open) {
          fonts.push(spanFont(open[1], font()));
          return [];
        }
        if (SPAN_CLOSE.test(node.value.trim())) {
          if (fonts.length > 1) fonts.pop();
          return [];
        }
        return node.value ? [textNode(node.value, marks(), font())] : [];
      }
      default:
        return textOf(node) ? [textNode(textOf(node), marks(), font())] : [];
    }
  });
}

function textNode(text: string, marks: readonly Mark[], font: DraftFont): JSONContent {
  const all = font.font || font.size ? [...marks, { type: FONT_STYLE, attrs: { font: font.font, size: font.size } }] : marks;
  return all.length > 0 ? { type: 'text', text, marks: [...all] } : { type: 'text', text };
}

function withContent(node: JSONContent, content: JSONContent[]): JSONContent {
  return content.length > 0 ? { ...node, content } : node;
}

/** The plain text inside any node. */
function textOf(node: Nodes): string {
  if ('value' in node && typeof node.value === 'string') return node.value;
  if ('children' in node) return (node.children as Nodes[]).map(textOf).join('');
  return '';
}
