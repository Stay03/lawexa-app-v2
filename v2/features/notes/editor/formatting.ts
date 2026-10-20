'use client';

import { useEditorState, type Editor } from '@tiptap/react';

import type { Alignment, BlockStyle, StyleChoice, TableAction } from './toolbar-verbs';

/**
 * formatting — the editor's toolbar VERBS and the toolbar's live state.
 *
 * One module for both because the two must agree: a verb the bubble menu can
 * apply and the dock bar cannot (or that lights up in one and not the other) is
 * the classic two-toolbar drift, and v1 had exactly that (its fixed toolbar
 * offered H1 + H2, its bubble offered H2 only, and neither offered H3).
 *
 * ── THE LINT RULE THIS MODULE EXISTS TO OBEY ────────────────────────────────
 * `editor.isActive('bold')` reads ProseMirror state, which changes without
 * React knowing. Calling it during render is a non-reactive read the React
 * Compiler lint rejects OUTRIGHT (it runs as errors here), and it is also just
 * wrong: the button would light up a transaction late. `useEditorState` is the
 * sanctioned reader — it subscribes to the editor's transactions through
 * `useSyncExternalStore` and re-renders only when the SELECTED value changes.
 * So every active flag in the app comes from {@link useFormatState} and nowhere
 * else.
 *
 * The selector returns a flat object of primitives on purpose: the hook's
 * default equality is a deep compare, so a flat object of booleans is compared
 * field by field and a re-render happens only when a button genuinely changes
 * appearance — not on every keystroke.
 */

/** Every formatting verb the notes editor offers. Nothing else exists. */
export type FormatVerb =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'highlight'
  | 'code'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bulletList'
  | 'orderedList'
  | 'blockquote'
  // The style dropdown's Normal text, and Clear formatting (Arthur's step 1).
  | 'paragraph'
  | 'clearFormatting';

/** A verb a toolbar button toggles, whose lit state is `state[verb]`. */
export type ToggleVerb = Exclude<FormatVerb, 'paragraph' | 'clearFormatting'>;

export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  highlight: boolean;
  code: boolean;
  h1: boolean;
  h2: boolean;
  h3: boolean;
  bulletList: boolean;
  orderedList: boolean;
  blockquote: boolean;
  /** What the block under the caret is, for the style dropdown's label. */
  blockStyle: BlockStyle;
  /** The alignment of the block under the caret. */
  align: Alignment;
  /** The caret is in a table, so the table menu offers rows and columns. */
  inTable: boolean;
  /** A link mark covers the selection — the link button then OFFERS to remove it. */
  link: boolean;
  /** The caret sits inside a code block, where a formatting bubble is nonsense. */
  inCodeBlock: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

const NOTHING_ACTIVE: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  highlight: false,
  code: false,
  h1: false,
  h2: false,
  h3: false,
  bulletList: false,
  orderedList: false,
  blockquote: false,
  blockStyle: 'paragraph',
  align: 'left',
  inTable: false,
  link: false,
  inCodeBlock: false,
  canUndo: false,
  canRedo: false,
};

/** Apply a verb. Always focuses first, so a click on a toolbar never steals the caret. */
export function runFormat(editor: Editor, verb: FormatVerb): void {
  const chain = editor.chain().focus();
  switch (verb) {
    case 'bold':
      chain.toggleBold().run();
      return;
    case 'italic':
      chain.toggleItalic().run();
      return;
    case 'underline':
      chain.toggleUnderline().run();
      return;
    case 'strike':
      chain.toggleStrike().run();
      return;
    case 'highlight':
      chain.toggleHighlight().run();
      return;
    case 'code':
      chain.toggleCode().run();
      return;
    case 'h1':
      chain.toggleHeading({ level: 1 }).run();
      return;
    case 'h2':
      chain.toggleHeading({ level: 2 }).run();
      return;
    case 'h3':
      chain.toggleHeading({ level: 3 }).run();
      return;
    case 'bulletList':
      chain.toggleBulletList().run();
      return;
    case 'orderedList':
      chain.toggleOrderedList().run();
      return;
    case 'blockquote':
      chain.toggleBlockquote().run();
      return;
    case 'paragraph':
      chain.setParagraph().run();
      return;
    case 'clearFormatting':
      clearFormatting(editor);
      return;
  }
}

/**
 * Clear formatting: the bold, italic, underline, strike, highlight and code
 * marks come off the selection and a heading goes back to normal text. A
 * list, a quote, a link and the alignment stay, since they are what the text
 * is rather than how it looks (`CLEAR_FORMATTING` in `toolbar-verbs.ts`).
 * Returns whether it ran, for the keyboard shortcut.
 */
export function clearFormatting(editor: Editor): boolean {
  const chain = editor
    .chain()
    .focus()
    .unsetBold()
    .unsetItalic()
    .unsetUnderline()
    .unsetStrike()
    .unsetCode()
    .unsetHighlight();
  if (editor.isActive('heading')) chain.setParagraph();
  return chain.run();
}

/**
 * The style dropdown SETS a style; it never toggles. Choosing Heading on a
 * heading keeps it a heading (a toggle would turn it back into text), and
 * Normal text turns any heading into a paragraph.
 */
export function applyStyle(editor: Editor, style: StyleChoice): void {
  const chain = editor.chain().focus();
  if (style === 'paragraph') chain.setParagraph().run();
  else chain.setHeading({ level: style === 'h1' ? 1 : style === 'h2' ? 2 : 3 }).run();
}

/** Align the paragraph or heading under the caret. Left is the default, so
 *  choosing it removes the alignment rather than storing `left`. */
export function applyAlign(editor: Editor, align: Alignment): void {
  const chain = editor.chain().focus();
  if (align === 'left') chain.unsetTextAlign().run();
  else chain.setTextAlign(align).run();
}

/**
 * The table menu's actions. A new table is three by three with a header row,
 * the shape most notes want (a comparison of cases, a list of dates); rows and
 * columns are added from inside it.
 */
export function runTableAction(editor: Editor, action: TableAction): void {
  const chain = editor.chain().focus();
  switch (action) {
    case 'insert':
      chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      return;
    case 'rowBefore':
      chain.addRowBefore().run();
      return;
    case 'rowAfter':
      chain.addRowAfter().run();
      return;
    case 'columnBefore':
      chain.addColumnBefore().run();
      return;
    case 'columnAfter':
      chain.addColumnAfter().run();
      return;
    case 'headerRow':
      chain.toggleHeaderRow().run();
      return;
    case 'deleteRow':
      chain.deleteRow().run();
      return;
    case 'deleteColumn':
      chain.deleteColumn().run();
      return;
    case 'deleteTable':
      chain.deleteTable().run();
      return;
  }
}

/** The alignment under the caret. Tiptap answers `isActive({ textAlign })`
 *  for the paragraph or heading the selection is in. */
function alignOf(editor: Editor): Alignment {
  if (editor.isActive({ textAlign: 'center' })) return 'center';
  if (editor.isActive({ textAlign: 'right' })) return 'right';
  if (editor.isActive({ textAlign: 'justify' })) return 'justify';
  return 'left';
}

/** The block under the caret, as the style dropdown names it. */
function blockStyleOf(editor: Editor): BlockStyle {
  if (editor.isActive('heading', { level: 1 })) return 'h1';
  if (editor.isActive('heading', { level: 2 })) return 'h2';
  if (editor.isActive('heading', { level: 3 })) return 'h3';
  if (editor.isActive('paragraph')) return 'paragraph';
  return 'other';
}

/**
 * Open the `@` case picker from a button. Typing the trigger is what the
 * suggestion plugin listens for, so the button types it — one code path for the
 * keyboard route and the button route, and no second way for the picker to open.
 *
 * ── TWO THINGS THE ONE-LINE VERSION GOT WRONG ───────────────────────────────
 *  1. `@tiptap/suggestion` only fires after an ALLOWED PREFIX — by default a
 *     space or the start of a block. A bare `@` typed straight after a word
 *     ("Okafor@") is dead on arrival: it renders as a literal character and no
 *     picker ever opens. So the space is inserted too when the character before
 *     the caret is not already whitespace.
 *  2. Inserting over a SELECTION replaces it. The button is an insert, not a
 *     transform: the caret collapses to the end of whatever is selected first,
 *     so pressing it never destroys the words the reader had highlighted.
 */
export function openCaseMention(editor: Editor): void {
  const { state } = editor;
  const end = state.selection.to;
  // The character immediately before the insertion point, read from the
  // document rather than the DOM. `textBetween` over an empty range at the
  // start of a block returns '', which correctly counts as "no prefix needed".
  const before = state.doc.textBetween(Math.max(0, end - 1), end, undefined, ' ');
  const needsSpace = before.length > 0 && !/\s/.test(before);

  editor
    .chain()
    .focus()
    .setTextSelection(end)
    .insertContent(needsSpace ? ' @' : '@')
    .run();
}

/** The live toolbar state. Safe to call with a null editor (it is null until mounted). */
export function useFormatState(editor: Editor | null): FormatState {
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }): FormatState => {
      if (!instance) return NOTHING_ACTIVE;
      return {
        bold: instance.isActive('bold'),
        italic: instance.isActive('italic'),
        underline: instance.isActive('underline'),
        strike: instance.isActive('strike'),
        highlight: instance.isActive('highlight'),
        code: instance.isActive('code'),
        h1: instance.isActive('heading', { level: 1 }),
        h2: instance.isActive('heading', { level: 2 }),
        h3: instance.isActive('heading', { level: 3 }),
        bulletList: instance.isActive('bulletList'),
        orderedList: instance.isActive('orderedList'),
        blockquote: instance.isActive('blockquote'),
        blockStyle: blockStyleOf(instance),
        align: alignOf(instance),
        inTable: instance.isActive('table'),
        link: instance.isActive('link'),
        inCodeBlock: instance.isActive('codeBlock'),
        canUndo: instance.can().undo(),
        canRedo: instance.can().redo(),
      };
    },
  });

  return state ?? NOTHING_ACTIVE;
}
