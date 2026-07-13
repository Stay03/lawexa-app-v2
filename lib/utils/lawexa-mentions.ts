/**
 * A rehype transformer that highlights resolved `@mentions` inside Lawexa's
 * rendered markdown, matching the chip styling human messages use.
 *
 * It walks the hast tree and, inside text nodes only, replaces each `@handle`
 * that resolves in the supplied map with a `<span class="lawexa-mention">`
 * element. Subtrees under `code`/`pre` are skipped so handles inside code are
 * never touched, and unresolved `@tokens` are left as plain text — mirroring the
 * server's "never guess" mention rule.
 */

import type { Element, ElementContent, Root, RootContent, Text } from 'hast';

import { mentionTokenRegex } from './collab';

/** Elements whose descendant text must never be treated as mentions. */
const CODE_ELEMENTS = new Set(['code', 'pre']);

/** Build a `<span class="lawexa-mention">@Label</span>` hast element. */
function mentionSpan(label: string): Element {
  return {
    type: 'element',
    tagName: 'span',
    properties: { className: ['lawexa-mention'] },
    children: [{ type: 'text', value: `@${label}` }],
  };
}

/**
 * Split one text node into plain-text + mention-span nodes. Returns `null` when
 * the node contains no resolvable mention, so callers can leave it untouched.
 */
function splitTextNode(
  node: Text,
  handles: Map<string, string>
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
    parts.push(mentionSpan(label));
    lastIndex = index + token.length;
  }

  if (!matched) return null;
  if (lastIndex < value.length) {
    parts.push({ type: 'text', value: value.slice(lastIndex) });
  }
  return parts;
}

/**
 * Recurse into a parent's children, rewriting mention text in place. Generic
 * over the child content type so it stays type-safe for both `Root`
 * (`RootContent`) and `Element` (`ElementContent`) parents.
 */
function visitChildren<Child extends RootContent | ElementContent>(
  children: Child[],
  handles: Map<string, string>
): Child[] {
  const next: Child[] = [];
  for (const child of children) {
    if (child.type === 'text') {
      const replaced = splitTextNode(child, handles);
      // Mention spans are `ElementContent`, always valid in either parent.
      if (replaced) {
        next.push(...(replaced as Child[]));
      } else {
        next.push(child);
      }
      continue;
    }
    if (child.type === 'element' && !CODE_ELEMENTS.has(child.tagName)) {
      child.children = visitChildren(child.children, handles);
    }
    next.push(child);
  }
  return next;
}

/**
 * A rehype plugin factory. Pass the resolved handle map; the returned value is a
 * unified *attacher* (what `react-markdown`'s `rehypePlugins` entries must be —
 * unified calls each entry and registers its return value as the transformer).
 * Returning the transformer directly would make unified invoke it as the
 * attacher with no tree and crash.
 */
export function rehypeLawexaMentions(handles: Map<string, string>) {
  return function attacher() {
    return function transformer(tree: Root): void {
      if (handles.size === 0) return;
      tree.children = visitChildren(tree.children, handles);
    };
  };
}
