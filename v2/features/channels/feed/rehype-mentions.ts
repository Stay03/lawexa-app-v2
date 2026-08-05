import type { Element, ElementContent, Root, RootContent, Text } from 'hast';

import { isSelfMention, scanMentions, type MentionChip } from '@/lib/utils/collab';

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
 * "OF THE VIEWER" IS DECIDED BY UUID. This used to take a set of display-name
 * strings, which emphasised the wrong chip the moment two members shared a
 * name — the exact ambiguity usernames were introduced to end. The chip map
 * carries each mention's uuid now, so the comparison is identity.
 *
 * THE ATTACHER GOTCHA (v1's docblock, kept because it is still a real trap):
 * unified CALLS each `rehypePlugins` entry and registers its RETURN VALUE as the
 * transformer. So this factory returns an attacher that returns the transformer
 * — returning the transformer directly would have unified invoke it with no
 * tree and crash.
 *
 * Text nodes only, and never inside `code`/`pre`: a handle in a code sample is
 * code. Unresolved `@tokens` stay plain text — the server's "never guess" rule
 * (digest §F.19), which is also why the map is the server's resolved list and
 * not something this file infers.
 */

/** Elements whose descendant text must never be treated as mentions. */
const CODE_ELEMENTS = new Set(['code', 'pre']);

function mentionSpan(chip: MentionChip, isSelf: boolean): Element {
  return {
    type: 'element',
    tagName: 'span',
    properties: {
      className: ['lawexa-mention'],
      ...(isSelf ? { 'data-self': '' } : {}),
      // The handle on hover — a POINTER extra only, never the answer to "which
      // Ada Obi": that is carried by the chip's own text, which becomes the
      // handle whenever a name is contested (`buildMentionChips`), so a phone
      // reader is never left guessing. Absent on pre-2026-08-05 history, and
      // absent when the chip already IS the handle.
      ...(chip.username && chip.label !== chip.username
        ? { title: `@${chip.username}` }
        : {}),
    },
    children: [{ type: 'text', value: `@${chip.label}` }],
  };
}

/**
 * Split one text node into plain-text + mention-span nodes. Returns `null` when
 * the node holds no resolvable mention, so callers leave it untouched (which
 * keeps the tree — and therefore React's reconciliation — minimal).
 */
function splitTextNode(
  node: Text,
  chips: ReadonlyMap<string, MentionChip>,
  viewerUuid: string | null,
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
    parts.push(mentionSpan(hit.chip, isSelfMention(hit.chip.uuid, viewerUuid)));
    // Only past the HANDLE — a full stop the scan swept up stays text.
    lastIndex = hit.index + hit.token.length;
  }

  if (lastIndex < value.length) {
    parts.push({ type: 'text', value: value.slice(lastIndex) });
  }
  return parts;
}

/** Recurse into a parent's children, rewriting mention text. Generic over the
 *  child type so it stays exact for both `Root` and `Element` parents. */
function visitChildren<Child extends RootContent | ElementContent>(
  children: Child[],
  chips: ReadonlyMap<string, MentionChip>,
  viewerUuid: string | null,
): Child[] {
  const next: Child[] = [];
  for (const child of children) {
    if (child.type === 'text') {
      const replaced = splitTextNode(child, chips, viewerUuid);
      // Mention spans are `ElementContent`, valid in either parent.
      if (replaced) next.push(...(replaced as Child[]));
      else next.push(child);
      continue;
    }
    if (child.type === 'element' && !CODE_ELEMENTS.has(child.tagName)) {
      child.children = visitChildren(child.children, chips, viewerUuid);
    }
    next.push(child);
  }
  return next;
}

/**
 * Build the rehype plugin. `chips` is `buildMentionChips(metadata)`;
 * `viewerUuid` is the reader, for the self-mention weight.
 */
export function rehypeChannelMentions(
  chips: ReadonlyMap<string, MentionChip>,
  viewerUuid: string | null,
) {
  return function attacher() {
    return function transformer(tree: Root): void {
      if (chips.size === 0) return;
      tree.children = visitChildren(tree.children, chips, viewerUuid);
    };
  };
}
