import type { Element, ElementContent, Root, RootContent, Text } from 'hast';

import { mentionTokenRegex } from '@/lib/utils/collab';

/**
 * rehype-mentions — a rehype transformer that turns resolved `@handles` inside
 * Lawexa's rendered markdown into the same chips human messages use. Phase-5
 * W3; a PORT of v1's `lib/utils/lawexa-mentions.ts` (v1 feature code is
 * boundary-blocked; the handle MAP it consumes still comes from the shared
 * `lib/utils/collab.ts`, so v1 and v2 can never disagree about what resolves) —
 * 2026-08-04.
 *
 * WHAT THE PORT ADDS: a mention OF THE VIEWER is marked `data-self`, so the
 * markdown path can carry the same self-mention emphasis the plain-text path
 * has (`MessageContent`). v1 had one chip style for everyone; in v2 being named
 * personally has to look different from being in the room, on both paths.
 *
 * THE ATTACHER GOTCHA (v1's docblock, kept because it is still a real trap):
 * unified CALLS each `rehypePlugins` entry and registers its RETURN VALUE as the
 * transformer. So this factory returns an attacher that returns the transformer
 * — returning the transformer directly would have unified invoke it with no
 * tree and crash.
 *
 * Text nodes only, and never inside `code`/`pre`: a handle in a code sample is
 * code. Unresolved `@tokens` stay plain text — the server's "never guess" rule
 * (digest §F.15), which is also why the map is the server's resolved list and
 * not something this file infers.
 */

/** Elements whose descendant text must never be treated as mentions. */
const CODE_ELEMENTS = new Set(['code', 'pre']);

function mentionSpan(label: string, isSelf: boolean): Element {
  return {
    type: 'element',
    tagName: 'span',
    properties: {
      className: ['lawexa-mention'],
      ...(isSelf ? { 'data-self': '' } : {}),
    },
    children: [{ type: 'text', value: `@${label}` }],
  };
}

/**
 * Split one text node into plain-text + mention-span nodes. Returns `null` when
 * the node holds no resolvable mention, so callers leave it untouched (which
 * keeps the tree — and therefore React's reconciliation — minimal).
 */
function splitTextNode(
  node: Text,
  handles: Map<string, string>,
  selfLabels: ReadonlySet<string>,
): ElementContent[] | null {
  const { value } = node;
  const parts: ElementContent[] = [];
  let lastIndex = 0;
  let matched = false;

  for (const match of value.matchAll(mentionTokenRegex())) {
    const token = match[0];
    const index = match.index ?? 0;
    const label = handles.get(token.slice(1).toLowerCase());
    if (!label) continue;

    matched = true;
    if (index > lastIndex) {
      parts.push({ type: 'text', value: value.slice(lastIndex, index) });
    }
    parts.push(mentionSpan(label, selfLabels.has(label)));
    lastIndex = index + token.length;
  }

  if (!matched) return null;
  if (lastIndex < value.length) {
    parts.push({ type: 'text', value: value.slice(lastIndex) });
  }
  return parts;
}

/** Recurse into a parent's children, rewriting mention text. Generic over the
 *  child type so it stays exact for both `Root` and `Element` parents. */
function visitChildren<Child extends RootContent | ElementContent>(
  children: Child[],
  handles: Map<string, string>,
  selfLabels: ReadonlySet<string>,
): Child[] {
  const next: Child[] = [];
  for (const child of children) {
    if (child.type === 'text') {
      const replaced = splitTextNode(child, handles, selfLabels);
      // Mention spans are `ElementContent`, valid in either parent.
      if (replaced) next.push(...(replaced as Child[]));
      else next.push(child);
      continue;
    }
    if (child.type === 'element' && !CODE_ELEMENTS.has(child.tagName)) {
      child.children = visitChildren(child.children, handles, selfLabels);
    }
    next.push(child);
  }
  return next;
}

/**
 * Build the rehype plugin. `handles` is `buildMentionHandleMap(metadata)`;
 * `selfLabels` are the display names that belong to the viewer.
 */
export function rehypeChannelMentions(
  handles: Map<string, string>,
  selfLabels: ReadonlySet<string>,
) {
  return function attacher() {
    return function transformer(tree: Root): void {
      if (handles.size === 0) return;
      tree.children = visitChildren(tree.children, handles, selfLabels);
    };
  };
}
