import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';

import type { CaseMentionItem, CaseMentionStore } from './mention-store';

/**
 * case-mention — the `@` case reference node, rebuilt.
 *
 * ── THE SERIALISED SHAPE IS A CONTRACT, NOT A CHOICE ────────────────────────
 * v1 stored case mentions as this exact anchor:
 *
 *     <a data-type="case-mention" class="case-mention"
 *        data-case-id="11831" data-case-slug="okafor-v-nweke"
 *        href="/cases/okafor-v-nweke">@Okafor v. Nweke</a>
 *
 * Thousands of existing notes contain it, and the v2 reader turns exactly that
 * markup back into a case link. So the rebuild reproduces it attribute for
 * attribute — same order, same class, same `@`-prefixed text — and parses the
 * same selector back. A note written in v1 and edited in v2 round-trips
 * unchanged; a note written in v2 renders identically in both readers.
 *
 * THAT ROUND TRIP DEPENDS ON THE PARSE RULE'S `priority`, not just its
 * selector. Read the note on {@link parseHTML} below before touching it: at the
 * default priority the Link MARK claims the anchor first and every stored
 * mention is silently downgraded to a styled link on the first load — and the
 * next autosave makes that permanent.
 *
 * ── WHAT IS ACTUALLY REBUILT ────────────────────────────────────────────────
 * Everything behind that markup. v1 extended `@tiptap/extension-mention` and
 * bolted a tippy.js popup onto it, whose suggestion handler called the case
 * search API on EVERY keystroke with no debounce and no cancellation. This is a
 * plain `Node` wired straight to `@tiptap/suggestion`, with the picker's state
 * in `mention-store.ts` (debounced, generation-guarded, cache-backed) and its
 * UI an ordinary React component in the editor's own tree. No tippy, no second
 * React root, no per-keystroke request.
 *
 * The node is built by a FACTORY rather than configured through options,
 * because it needs a live store and `addOptions()` has no honest default for
 * one — a `null` default cast into shape would be a lie the type system would
 * then stop checking.
 */

export const CASE_MENTION_NAME = 'caseMention';

/** The trigger character. Also what a Backspace over a mention restores. */
const TRIGGER = '@';

/**
 * The class the suggestion decoration puts on the live `@query` text while the
 * picker is open. v2-unique so it can never collide with v1's stylesheet; it is
 * styled from the editor wrapper (see `NotePaper`), not from a global rule.
 */
export const MENTION_TRIGGER_CLASS = 'v2-mention-trigger';

const CaseMentionPluginKey = new PluginKey('v2CaseMention');

interface CaseMentionAttributes {
  id: number | null;
  slug: string | null;
  label: string | null;
}

/** Read a node's attributes back as real types rather than trusting `attrs`. */
function attributesOf(node: ProseMirrorNode): CaseMentionAttributes {
  const attrs = node.attrs as Partial<Record<keyof CaseMentionAttributes, unknown>>;
  return {
    id: typeof attrs.id === 'number' ? attrs.id : null,
    slug: typeof attrs.slug === 'string' ? attrs.slug : null,
    label: typeof attrs.label === 'string' ? attrs.label : null,
  };
}

/** `data-case-id` arrives as a string from stored HTML; keep it a number here. */
function parseId(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  return Number(value);
}

export function createCaseMentionExtension(store: CaseMentionStore) {
  return Node.create({
    name: CASE_MENTION_NAME,
    group: 'inline',
    inline: true,
    // One indivisible thing: the caret never lands inside a case name, and a
    // Backspace removes the whole reference (see the shortcut below).
    atom: true,
    selectable: false,
    draggable: false,

    addAttributes() {
      return {
        id: {
          default: null,
          parseHTML: (element) => parseId(element.getAttribute('data-case-id')),
          renderHTML: (attributes) =>
            attributes.id == null ? {} : { 'data-case-id': attributes.id },
        },
        slug: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-case-slug'),
          renderHTML: (attributes) =>
            attributes.slug == null ? {} : { 'data-case-slug': attributes.slug },
        },
        label: {
          default: null,
          // The visible name lives in the anchor's TEXT, not an attribute —
          // v1's shape, and the reason a stored mention stays readable even to
          // something that knows nothing about this node type.
          parseHTML: (element) => element.textContent?.replace(/^@/, '') || null,
          renderHTML: () => ({}),
        },
      };
    },

    parseHTML() {
      return [
        {
          tag: 'a[data-type="case-mention"]',
          /**
           * RULE-LEVEL PRIORITY, AND IT IS LOAD-BEARING.
           *
           * prosemirror-model's `schemaRules()` collects ALL MARK parse rules
           * before ALL NODE parse rules, then sorts by rule priority (default
           * 50). Link is a mark, its rule is `a[href]`, and its `getAttrs`
           * ACCEPTS a stored case-mention anchor — so at the default priority
           * the link mark claims every mention before this node rule is ever
           * consulted, and the mention comes back as ordinary text wearing a
           * link. The next autosave then writes that back: `data-type`,
           * `data-case-id` and `data-case-slug` are gone from the stored HTML
           * permanently, and the reader (which gates on `data-type`) stops
           * seeing a case reference at all.
           *
           * Extension-level `priority` does NOT reach here — it orders
           * extensions, not the parse rules inside one. Only the rule's own
           * `priority` moves it ahead of the mark rules, and anything above 50
           * does it; 60 is deliberately modest so a future rule can still be
           * placed on either side of this one.
           */
          priority: 60,
        },
      ];
    },

    renderHTML({ node, HTMLAttributes }) {
      const { id, slug, label } = attributesOf(node);
      return [
        'a',
        mergeAttributes(
          { 'data-type': 'case-mention', class: 'case-mention' },
          HTMLAttributes,
          {
            href: `/cases/${slug ?? ''}`,
            'data-case-id': id,
            'data-case-slug': slug,
          },
        ),
        `${TRIGGER}${label ?? id ?? ''}`,
      ];
    },

    renderText({ node }) {
      const { label, id } = attributesOf(node);
      return `${TRIGGER}${label ?? id ?? ''}`;
    },

    addKeyboardShortcuts() {
      return {
        // Backspace immediately after a mention turns it back into the `@` that
        // produced it, so a mistyped pick can be re-picked instead of retyped.
        Backspace: () =>
          this.editor.commands.command(({ tr, state }) => {
            const { selection } = state;
            if (!selection.empty) return false;
            const { anchor } = selection;
            let removed = false;
            state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
              if (node.type.name !== this.name) return true;
              removed = true;
              tr.insertText(TRIGGER, pos, pos + node.nodeSize);
              return false;
            });
            return removed;
          }),
      };
    },

    addProseMirrorPlugins() {
      return [
        Suggestion<CaseMentionItem, CaseMentionItem>({
          editor: this.editor,
          char: TRIGGER,
          pluginKey: CaseMentionPluginKey,
          // Case names contain spaces ("Okafor v. Nweke"), so the query cannot
          // end at the first one.
          allowSpaces: true,
          startOfLine: false,
          decorationClass: MENTION_TRIGGER_CLASS,

          // Deliberately empty: the picker's search lives in the store, which
          // debounces it and guards against out-of-order answers. See the
          // store's header for why the plugin's own hook is the wrong place.
          items: () => [],

          command: ({ editor, range, props }) => {
            // Absorb a following space so picking a case never leaves a double
            // gap (the same correction the stock Mention extension makes).
            const nodeAfter = editor.view.state.selection.$to.nodeAfter;
            const insertRange = nodeAfter?.text?.startsWith(' ')
              ? { from: range.from, to: range.to + 1 }
              : range;

            editor
              .chain()
              .focus()
              .insertContentAt(insertRange, [
                {
                  type: CASE_MENTION_NAME,
                  attrs: { id: props.id, slug: props.slug, label: props.label },
                },
                { type: 'text', text: ' ' },
              ])
              .run();
          },

          render: () => ({
            onStart: (props) =>
              store.start({
                clientRect: props.clientRect,
                query: props.query,
                command: props.command,
              }),
            onUpdate: (props) =>
              store.update({
                clientRect: props.clientRect,
                query: props.query,
                command: props.command,
              }),
            onKeyDown: ({ event }) => store.handleKeyDown(event),
            onExit: () => store.exit(),
          }),
        }),
      ];
    },
  });
}
