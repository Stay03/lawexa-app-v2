import { createElement, type ReactNode } from 'react';

import type { NoteNode, NoteTag } from './note-html';

/**
 * note-elements — the walker's node tree as plain React elements, for v1's note
 * reader (`components/notes/NoteContent.tsx`).
 *
 * WHY IT EXISTS (techlead 941240f0, 3 October 2026): v1 rendered a note's stored
 * HTML with `dangerouslySetInnerHTML` and no sanitiser, so a note carrying a
 * script or an `onerror` attribute ran in the reader's browser. It now renders
 * only what `parseNoteHtml` lets through: a closed set of tags, links with a
 * checked scheme, and images with a checked source. No HTML string reaches the
 * DOM, and no attribute is copied from the author's markup.
 *
 * WHAT IT KEEPS FROM v1: a case mention renders as the same anchor v1's editor
 * writes (`data-type="case-mention"`, `data-case-slug`, class `case-mention`),
 * so the existing tooltip hook and click navigation in v1's reader still find
 * it. The href is rebuilt from the walker's validated slug, never the author's.
 *
 * Built with `createElement`, not JSX, so the node test runner can import it.
 * v2's reader has its own renderer, which uses v2's case preview component.
 */

/** Tags React must create without children. */
const VOID_TAGS: ReadonlySet<NoteTag> = new Set<NoteTag>(['br', 'hr']);

export function renderNoteNodes(nodes: readonly NoteNode[]): ReactNode[] {
  return nodes.map(renderNoteNode);
}

function renderNoteNode(node: NoteNode): ReactNode {
  switch (node.kind) {
    case 'text':
      return node.text;

    case 'element':
      return VOID_TAGS.has(node.tag)
        ? createElement(node.tag, { key: node.key })
        : createElement(node.tag, { key: node.key }, ...renderNoteNodes(node.children));

    case 'case':
      return createElement(
        'a',
        {
          key: node.key,
          href: `/cases/${encodeURIComponent(node.slug)}`,
          className: 'case-mention',
          'data-type': 'case-mention',
          'data-case-slug': node.slug,
        },
        ...renderNoteNodes(node.children),
      );

    case 'link':
      return createElement(
        'a',
        node.mode === 'external'
          ? { key: node.key, href: node.href, target: '_blank', rel: 'noreferrer noopener nofollow' }
          : { key: node.key, href: node.href },
        ...renderNoteNodes(node.children),
      );

    case 'image':
      return createElement('img', { key: node.key, src: node.src, alt: node.alt, loading: 'lazy' });
  }
}
