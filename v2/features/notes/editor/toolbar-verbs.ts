import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline,
  type LucideIcon,
} from 'lucide-react';

import type { FormatVerb } from './formatting';

/**
 * toolbar-verbs — the note editor's formatting vocabulary, in order, once.
 *
 * THE LIST IS THE SPEC. Bold, italic, underline, strikethrough, H2, H3, bullet
 * list, ordered list, quote, inline code — plus link, image and `@case` as the
 * three INSERT actions each toolbar wires itself (they open something rather
 * than toggling a mark, so they carry no shared state). Nothing else exists:
 * no colour, no highlight, no font family, no size. See `extensions.ts` for why
 * that is enforced by the schema and not by this list.
 *
 * Both toolbars — the desktop selection bubble and the touch dock bar — render
 * from these arrays, so a verb added here appears in both or in neither. v1's
 * two toolbars each hand-listed their own buttons and had already drifted (a
 * fixed bar with H1+H2, a bubble with H2 only, H3 in neither).
 *
 * The `verb` keys are also the {@link FormatState} field names, so a button
 * reads its own lit state with `state[verb]` and no lookup table can go stale.
 */

export interface ToolbarVerb {
  verb: FormatVerb;
  icon: LucideIcon;
  label: string;
}

/** Character-level marks — the group a text selection reaches for first. */
export const TEXT_VERBS: readonly ToolbarVerb[] = [
  { verb: 'bold', icon: Bold, label: 'Bold' },
  { verb: 'italic', icon: Italic, label: 'Italic' },
  { verb: 'underline', icon: Underline, label: 'Underline' },
  { verb: 'strike', icon: Strikethrough, label: 'Strikethrough' },
];

/** Block shapes — what this paragraph IS. */
export const BLOCK_VERBS: readonly ToolbarVerb[] = [
  { verb: 'h2', icon: Heading2, label: 'Heading' },
  { verb: 'h3', icon: Heading3, label: 'Subheading' },
  { verb: 'bulletList', icon: List, label: 'Bulleted list' },
  { verb: 'orderedList', icon: ListOrdered, label: 'Numbered list' },
  { verb: 'blockquote', icon: Quote, label: 'Quote' },
];

/** Inline code sits with the insert group: it marks a fragment, not a paragraph. */
export const CODE_VERB: ToolbarVerb = {
  verb: 'code',
  icon: Code,
  label: 'Inline code',
};
