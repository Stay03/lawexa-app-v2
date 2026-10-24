import type { JSONContent } from '@tiptap/core';
import type { Nodes, PhrasingContent, Root, RootContent, Table } from 'mdast';
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
 * dropped and its words stay. The span is the one tag read: any other HTML is
 * still text. Code takes no font, as in the editor.
 */

type Mark = NonNullable<JSONContent['marks']>[number];

export interface DraftFont {
  font: NoteFont | null;
  size: NoteSize | null;
}

const NO_FONT: DraftFont = { font: null, size: null };

const parser = unified().use(remarkParse).use(remarkGfm);

export function markdownToDoc(markdown: string, base: DraftFont = NO_FONT): JSONContent {
  const root = parser.runSync(parser.parse(markdown)) as Root;
  const content = blocks(root.children, base);
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

function block(node: RootContent, font: DraftFont): JSONContent[] {
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
function inline(nodes: readonly PhrasingContent[], outer: DraftFont, marks: readonly Mark[] = []): JSONContent[] {
  const fonts: DraftFont[] = [outer];
  const font = () => fonts[fonts.length - 1];
  return nodes.flatMap((node): JSONContent[] => {
    switch (node.type) {
      case 'text':
        return node.value ? [textNode(node.value, marks, font())] : [];
      case 'strong':
        return inline(node.children, font(), [...marks, { type: 'bold' }]);
      case 'emphasis':
        return inline(node.children, font(), [...marks, { type: 'italic' }]);
      case 'delete':
        return inline(node.children, font(), [...marks, { type: 'strike' }]);
      case 'inlineCode':
        return node.value ? [textNode(node.value, [...marks, { type: 'code' }], NO_FONT)] : [];
      case 'link':
        return inline(node.children, font(), [...marks, { type: 'link', attrs: { href: node.url } }]);
      case 'break':
        return [{ type: 'hardBreak' }];
      case 'image':
        return node.alt ? [textNode(node.alt, marks, font())] : [];
      case 'html': {
        const open = SPAN_OPEN.exec(node.value.trim());
        if (open) {
          fonts.push(spanFont(open[1], font()));
          return [];
        }
        if (SPAN_CLOSE.test(node.value.trim())) {
          if (fonts.length > 1) fonts.pop();
          return [];
        }
        return node.value ? [textNode(node.value, marks, font())] : [];
      }
      default:
        return textOf(node) ? [textNode(textOf(node), marks, font())] : [];
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
