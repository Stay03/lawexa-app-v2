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

import type { FormatVerb, ToggleVerb } from './formatting';

/**
 * toolbar-verbs — the note editor's formatting vocabulary, in order, once.
 *
 * THE LIST IS THE SPEC. Bold, italic, underline, strikethrough, H2, H3, bullet
 * list, ordered list, quote, inline code — plus link, image and `@case` as the
 * three INSERT actions each toolbar wires itself (they open something rather
 * than toggling a mark, so they carry no shared state), and since Arthur's
 * editor step 1 (19 October 2026) a style dropdown (Normal text, Heading,
 * Subheading), Clear formatting, and each control's key binding for its
 * tooltip. Nothing else exists: no colour, no highlight, no font family, no
 * size. See `extensions.ts` for why that is enforced by the schema and not by
 * this list.
 *
 * Every toolbar (the desktop bar, the desktop selection bubble and the touch
 * dock bar with its More menu) renders from these arrays, so a verb added here
 * appears in all of them or in none. v1's two toolbars each hand-listed their
 * own buttons and had already drifted (a fixed bar with H1+H2, a bubble with H2
 * only, H3 in neither).
 *
 * The `verb` keys are also the {@link FormatState} field names, so a button
 * reads its own lit state with `state[verb]` and no lookup table can go stale.
 */

export interface ToolbarVerb {
  verb: ToggleVerb;
  icon: LucideIcon;
  label: string;
  /** Tiptap's own key binding for it, shown in the tooltip (`shortcut-label.ts`). */
  keys: string;
}

/** Character-level marks — the group a text selection reaches for first. */
export const TEXT_VERBS: readonly ToolbarVerb[] = [
  { verb: 'bold', icon: Bold, label: 'Bold', keys: 'Mod-b' },
  { verb: 'italic', icon: Italic, label: 'Italic', keys: 'Mod-i' },
  { verb: 'underline', icon: Underline, label: 'Underline', keys: 'Mod-u' },
  { verb: 'strike', icon: Strikethrough, label: 'Strikethrough', keys: 'Mod-Shift-s' },
];

/** Block shapes — what this paragraph IS. */
export const BLOCK_VERBS: readonly ToolbarVerb[] = [
  { verb: 'h2', icon: Heading2, label: 'Heading', keys: 'Mod-Alt-2' },
  { verb: 'h3', icon: Heading3, label: 'Subheading', keys: 'Mod-Alt-3' },
  { verb: 'bulletList', icon: List, label: 'Bulleted list', keys: 'Mod-Shift-8' },
  { verb: 'orderedList', icon: ListOrdered, label: 'Numbered list', keys: 'Mod-Shift-7' },
  { verb: 'blockquote', icon: Quote, label: 'Quote', keys: 'Mod-Shift-b' },
];

/** Inline code sits with the insert group: it marks a fragment, not a paragraph. */
export const CODE_VERB: ToolbarVerb = {
  verb: 'code',
  icon: Code,
  label: 'Inline code',
  keys: 'Mod-e',
};

/** Undo and redo: Tiptap's UndoRedo bindings (StarterKit). */
export const UNDO_KEYS = 'Mod-z';
export const REDO_KEYS = 'Mod-Shift-z';

/**
 * Clear formatting: the bold, italic, underline, strike and code marks come
 * off and a heading goes back to normal text. Lists, quotes and links stay:
 * they are what the text is, not how it looks. `Mod-\` as in Google Docs,
 * registered by `extensions.ts`.
 */
export const CLEAR_FORMATTING = { verb: 'clearFormatting', label: 'Clear formatting', keys: 'Mod-\\' } as const;

/**
 * The style dropdown (Arthur's step 1). Normal, Heading and Subheading; a
 * note's title is the page's H1, so the H1 style is not offered until Stay
 * says otherwise (techlead, 19 October 2026). A legacy H1 already in a note
 * still shows its name in the dropdown, so the reader can see what it is.
 */
export type BlockStyle = 'paragraph' | 'h1' | 'h2' | 'h3' | 'other';

export interface StyleOption {
  style: 'paragraph' | 'h2' | 'h3';
  verb: FormatVerb;
  label: string;
  keys: string;
}

export const STYLE_OPTIONS: readonly StyleOption[] = [
  { style: 'paragraph', verb: 'paragraph', label: 'Normal text', keys: 'Mod-Alt-0' },
  { style: 'h2', verb: 'h2', label: 'Heading', keys: 'Mod-Alt-2' },
  { style: 'h3', verb: 'h3', label: 'Subheading', keys: 'Mod-Alt-3' },
];

/** The dropdown's own label for the block under the caret. */
export function styleLabel(style: BlockStyle): string {
  switch (style) {
    case 'h1':
      return 'Large heading';
    case 'h2':
      return 'Heading';
    case 'h3':
      return 'Subheading';
    case 'other':
      return 'Style';
    default:
      return 'Normal text';
  }
}
