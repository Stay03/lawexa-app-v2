import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading2,
  Heading3,
  Highlighter,
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
 * tooltip. Step 2 (20 October 2026) adds Large heading to the style, one
 * highlight, alignment and tables. Nothing else exists: no colour, no font
 * family, no size. See `extensions.ts` for why that is enforced by the schema
 * and not by this list.
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
  { verb: 'highlight', icon: Highlighter, label: 'Highlight', keys: 'Mod-Shift-h' },
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
 * Clear formatting: the bold, italic, underline, strike, highlight and code
 * marks come off and a heading goes back to normal text. Lists, quotes, links
 * and alignment stay: they are what the text is, not how it looks. `Mod-\` as
 * in Google Docs, registered by `extensions.ts`.
 */
export const CLEAR_FORMATTING = { verb: 'clearFormatting', label: 'Clear formatting', keys: 'Mod-\\' } as const;

/**
 * The style dropdown. Normal text, Large heading, Heading and Subheading.
 * Large heading (H1) joined in Arthur's step 2 (20 October 2026). The reader
 * shows a note's headings one level down, under the page's own title, so the
 * three sizes stay three sizes when read.
 */
export type BlockStyle = 'paragraph' | 'h1' | 'h2' | 'h3' | 'other';

export type StyleChoice = 'paragraph' | 'h1' | 'h2' | 'h3';

export interface StyleOption {
  style: StyleChoice;
  verb: FormatVerb;
  label: string;
  keys: string;
}

export const STYLE_OPTIONS: readonly StyleOption[] = [
  { style: 'paragraph', verb: 'paragraph', label: 'Normal text', keys: 'Mod-Alt-0' },
  { style: 'h1', verb: 'h1', label: 'Large heading', keys: 'Mod-Alt-1' },
  { style: 'h2', verb: 'h2', label: 'Heading', keys: 'Mod-Alt-2' },
  { style: 'h3', verb: 'h3', label: 'Subheading', keys: 'Mod-Alt-3' },
];

/** Alignment of a paragraph or heading (Arthur's step 2). */
export type Alignment = 'left' | 'center' | 'right' | 'justify';

export interface AlignOption {
  align: Alignment;
  icon: LucideIcon;
  label: string;
  /** Tiptap TextAlign's own bindings. */
  keys: string;
}

export const ALIGN_OPTIONS: readonly AlignOption[] = [
  { align: 'left', icon: AlignLeft, label: 'Align left', keys: 'Mod-Shift-l' },
  { align: 'center', icon: AlignCenter, label: 'Align centre', keys: 'Mod-Shift-e' },
  { align: 'right', icon: AlignRight, label: 'Align right', keys: 'Mod-Shift-r' },
  { align: 'justify', icon: AlignJustify, label: 'Justify', keys: 'Mod-Shift-j' },
];

/** The table menu (Arthur's step 2): insert outside a table, the rest inside one. */
export type TableAction =
  | 'insert'
  | 'rowBefore'
  | 'rowAfter'
  | 'columnBefore'
  | 'columnAfter'
  | 'headerRow'
  | 'deleteRow'
  | 'deleteColumn'
  | 'deleteTable';

export interface TableItem {
  action: TableAction;
  label: string;
  /** A removal, drawn in the destructive colour and kept last. */
  removes?: boolean;
}

export const TABLE_INSERT: TableItem = { action: 'insert', label: 'Insert table' };

/** Inside a table, in groups: add, the header row, remove. */
export const TABLE_EDITS: readonly (readonly TableItem[])[] = [
  [
    { action: 'rowBefore', label: 'Add row above' },
    { action: 'rowAfter', label: 'Add row below' },
    { action: 'columnBefore', label: 'Add column left' },
    { action: 'columnAfter', label: 'Add column right' },
  ],
  [{ action: 'headerRow', label: 'Header row on or off' }],
  [
    { action: 'deleteRow', label: 'Delete row', removes: true },
    { action: 'deleteColumn', label: 'Delete column', removes: true },
    { action: 'deleteTable', label: 'Delete table', removes: true },
  ],
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
