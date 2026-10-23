import type { JSONContent } from '@tiptap/core';
import type { Nodes, PhrasingContent, Root, RootContent, Table } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

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
 */

type Mark = NonNullable<JSONContent['marks']>[number];

const parser = unified().use(remarkParse).use(remarkGfm);

export function markdownToDoc(markdown: string): JSONContent {
  const root = parser.runSync(parser.parse(markdown)) as Root;
  const content = blocks(root.children);
  return { type: 'doc', content: content.length > 0 ? content : [{ type: 'paragraph' }] };
}

function blocks(nodes: readonly RootContent[]): JSONContent[] {
  return nodes.flatMap(block);
}

function block(node: RootContent): JSONContent[] {
  switch (node.type) {
    case 'heading':
      return [withContent({ type: 'heading', attrs: { level: Math.min(3, Math.max(1, node.depth)) } }, inline(node.children))];
    case 'paragraph':
      return [withContent({ type: 'paragraph' }, inline(node.children))];
    case 'list':
      return [
        {
          type: node.ordered ? 'orderedList' : 'bulletList',
          ...(node.ordered && typeof node.start === 'number' && node.start !== 1 ? { attrs: { start: node.start } } : {}),
          content: node.children.map((item) => ({ type: 'listItem', content: nonEmptyBlocks(item.children) })),
        },
      ];
    case 'blockquote':
      return [{ type: 'blockquote', content: nonEmptyBlocks(node.children) }];
    case 'code':
      return [withContent({ type: 'codeBlock', attrs: { language: node.lang ?? null } }, node.value ? [{ type: 'text', text: node.value }] : [])];
    case 'thematicBreak':
      return [{ type: 'horizontalRule' }];
    case 'table':
      return [table(node)];
    case 'html':
      return node.value.trim() ? [{ type: 'paragraph', content: [{ type: 'text', text: node.value }] }] : [];
    default:
      // Footnotes, definitions and anything else the dialect may yield: their text, if any.
      return textOf(node) ? [{ type: 'paragraph', content: [{ type: 'text', text: textOf(node) }] }] : [];
  }
}

/** A list item or quote must hold at least one block. */
function nonEmptyBlocks(nodes: readonly RootContent[]): JSONContent[] {
  const content = blocks(nodes);
  return content.length > 0 ? content : [{ type: 'paragraph' }];
}

function table(node: Table): JSONContent {
  return {
    type: 'table',
    content: node.children.map((row, rowIndex) => ({
      type: 'tableRow',
      content: row.children.map((cell) => ({
        type: rowIndex === 0 ? 'tableHeader' : 'tableCell',
        content: [withContent({ type: 'paragraph' }, inline(cell.children))],
      })),
    })),
  };
}

function inline(nodes: readonly PhrasingContent[], marks: readonly Mark[] = []): JSONContent[] {
  return nodes.flatMap((node): JSONContent[] => {
    switch (node.type) {
      case 'text':
        return node.value ? [textNode(node.value, marks)] : [];
      case 'strong':
        return inline(node.children, [...marks, { type: 'bold' }]);
      case 'emphasis':
        return inline(node.children, [...marks, { type: 'italic' }]);
      case 'delete':
        return inline(node.children, [...marks, { type: 'strike' }]);
      case 'inlineCode':
        return node.value ? [textNode(node.value, [...marks, { type: 'code' }])] : [];
      case 'link':
        return inline(node.children, [...marks, { type: 'link', attrs: { href: node.url } }]);
      case 'break':
        return [{ type: 'hardBreak' }];
      case 'image':
        return node.alt ? [textNode(node.alt, marks)] : [];
      case 'html':
        return node.value ? [textNode(node.value, marks)] : [];
      default:
        return textOf(node) ? [textNode(textOf(node), marks)] : [];
    }
  });
}

function textNode(text: string, marks: readonly Mark[]): JSONContent {
  return marks.length > 0 ? { type: 'text', text, marks: [...marks] } : { type: 'text', text };
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
