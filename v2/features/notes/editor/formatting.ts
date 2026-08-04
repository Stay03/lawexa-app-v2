'use client';

import { useEditorState, type Editor } from '@tiptap/react';

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
  | 'code'
  | 'h2'
  | 'h3'
  | 'bulletList'
  | 'orderedList'
  | 'blockquote';

export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
  h2: boolean;
  h3: boolean;
  bulletList: boolean;
  orderedList: boolean;
  blockquote: boolean;
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
  code: false,
  h2: false,
  h3: false,
  bulletList: false,
  orderedList: false,
  blockquote: false,
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
    case 'code':
      chain.toggleCode().run();
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
  }
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
        code: instance.isActive('code'),
        h2: instance.isActive('heading', { level: 2 }),
        h3: instance.isActive('heading', { level: 3 }),
        bulletList: instance.isActive('bulletList'),
        orderedList: instance.isActive('orderedList'),
        blockquote: instance.isActive('blockquote'),
        link: instance.isActive('link'),
        inCodeBlock: instance.isActive('codeBlock'),
        canUndo: instance.can().undo(),
        canRedo: instance.can().redo(),
      };
    },
  });

  return state ?? NOTHING_ACTIVE;
}
