/**
 * A rehype transformer that highlights resolved `@mentions` inside Lawexa's
 * rendered markdown, matching the chip styling human messages use.
 *
 * It walks the hast tree and, inside text nodes only, replaces each `@handle`
 * that resolves in the supplied map with a `<span class="lawexa-mention">`
 * element. Subtrees under `code`/`pre` are skipped so handles inside code are
 * never touched, and unresolved `@tokens` are left as plain text — mirroring the
 * server's "never guess" mention rule.
 *
 * Finding the mentions is `scanMentions`, the one shared scanner the plain-text
 * path uses — token shape, left word boundary and trailing-dot shed in a single
 * pass. Scanning by hand here is what left Lawexa's replies disagreeing with
 * human messages twice over: "I'll ask @adaobi." rendered grey because the full
 * stop was never shed, and an `@` mid-word could chip a person nobody tagged.
 */

import type { Element, ElementContent, Root, RootContent, Text } from 'hast';

import { scanMentions, type MentionChip } from './collab';

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
  chips: ReadonlyMap<string, MentionChip>
): ElementContent[] | null {
  const { value } = node;
  const hits = scanMentions(value, chips);
  if (hits.length === 0) return null;

  const parts: ElementContent[] = [];
  let lastIndex = 0;
  for (const hit of hits) {
    if (hit.index > lastIndex) {
      parts.push({ type: 'text', value: value.slice(lastIndex, hit.index) });
    }
    parts.push(mentionSpan(hit.chip.label));
    // Only past the HANDLE — a full stop the scan swept up stays text.
    lastIndex = hit.index + hit.token.length;
  }

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
  chips: ReadonlyMap<string, MentionChip>
): Child[] {
  const next: Child[] = [];
  for (const child of children) {
    if (child.type === 'text') {
      const replaced = splitTextNode(child, chips);
      // Mention spans are `ElementContent`, always valid in either parent.
      if (replaced) {
        next.push(...(replaced as Child[]));
      } else {
        next.push(child);
      }
      continue;
    }
    if (child.type === 'element' && !CODE_ELEMENTS.has(child.tagName)) {
      child.children = visitChildren(child.children, chips);
    }
    next.push(child);
  }
  return next;
}

/**
 * Widen the `handle → label` map its caller passes back to the chip shape the
 * shared resolver reads. `buildMentionHandleMap` is that map's own projection
 * of the chips, so nothing is invented here: the identity fields stay null
 * because v1's markdown chip shows one style for everyone and carries no title.
 */
function toChips(handles: Map<string, string>): Map<string, MentionChip> {
  const chips = new Map<string, MentionChip>();
  for (const [form, label] of handles) {
    chips.set(form, { label, uuid: null, username: null });
  }
  return chips;
}

/**
 * A rehype plugin factory. Pass the resolved handle map; the returned value is a
 * unified *attacher* (what `react-markdown`'s `rehypePlugins` entries must be —
 * unified calls each entry and registers its return value as the transformer).
 * Returning the transformer directly would make unified invoke it as the
 * attacher with no tree and crash.
 */
export function rehypeLawexaMentions(handles: Map<string, string>) {
  const chips = toChips(handles);
  return function attacher() {
    return function transformer(tree: Root): void {
      if (chips.size === 0) return;
      tree.children = visitChildren(tree.children, chips);
    };
  };
}
