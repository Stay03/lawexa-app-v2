import { Extension, type Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import { Table, TableKit, TableView } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';

import { createCaseMentionExtension } from './case-mention';
import { FontStyle } from './font-style';
import type { CaseMentionStore } from './mention-store';

/**
 * extensions — the note document's SCHEMA, which is also the whole of the
 * "no colour, ever" promise.
 *
 * ── WHAT IS DELIBERATELY ABSENT ─────────────────────────────────────────────
 * No `@tiptap/extension-color` and no `text-style`: no colour, and no inline
 * style of any kind. Font type and size arrived on 23 October 2026 (Stay: "Font
 * size and type for now") as their OWN mark, `FontStyle`, which writes data
 * attributes from a closed list and never a style (font-style.ts). The
 * owner's decision (August 2026) is that notes have never had colour — coloured
 * notes came from pasting — and the v2 reader strips inline styles at parse.
 * This is the writing half of the same decision, and it is enforced by ABSENCE
 * rather than by a rule: a mark that is not in the schema cannot be created by
 * a shortcut, restored by a paste, or resurrected by stored HTML. The
 * invisible-text bug has nowhere to live.
 *
 * ── ONE HIGHLIGHT, ALIGNMENT, TABLES (Arthur's editor step 2, 20 October 2026)
 * The highlight is Tiptap's `Highlight` with `multicolor` off: a plain `<mark>`
 * with no colour of its own, painted by the page in one colour, so it adds no
 * attribute a colour could ride on (`Mod-Shift-h`). Alignment is `text-align` on paragraphs and headings, the one style
 * value the reader keeps (as one of three words). Tables are `TableKit` without
 * column resizing, since a dragged width is a style the reader would drop.
 *
 * ── WHAT STARTERKIT v3 ALREADY BRINGS ───────────────────────────────────────
 * Bold, italic, STRIKE, UNDERLINE, LINK, code, code block, blockquote, both
 * lists, heading, horizontal rule, hard break, dropcursor, gapcursor, trailing
 * node and UndoRedo (v3's rename of History). Underline and Link were separate
 * packages in v2 and are bundled now, so nothing here imports them — the
 * duplicate registration that would cause is a real error, not a style point.
 *
 * ── HEADINGS: THREE LEVELS ──────────────────────────────────────────────────
 * H1 to H3, all three in the style menu since step 2 (Large heading, Heading,
 * Subheading). The reader shows them one level down, under the page's own
 * title, so a note never has a second H1 when read.
 */

export interface NoteExtensionsConfig {
  /** The empty-document prompt. */
  placeholder: string;
  /** The `@` picker's state, owned by the screen and shared with the plugin. */
  mentionStore: CaseMentionStore;
}

/**
 * Clear formatting on `Mod-\`, as in Google Docs (Arthur's editor step 1). The
 * same rule as the toolbar's button (`clearFormatting` in `formatting.ts`): the
 * text marks and the highlight come off and a heading goes back to normal text;
 * lists, quotes, links and alignment stay.
 */
const ClearFormattingShortcut = Extension.create({
  name: 'clearFormattingShortcut',
  addKeyboardShortcuts() {
    return {
      'Mod-\\': () => {
        const chain = this.editor
          .chain()
          .unsetBold()
          .unsetItalic()
          .unsetUnderline()
          .unsetStrike()
          .unsetCode()
          .unsetHighlight();
        if (this.editor.isActive('heading')) chain.setParagraph();
        return chain.run();
      },
    };
  },
});

export function createNoteExtensions({
  placeholder,
  mentionStore,
}: NoteExtensionsConfig): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        // A link inside an EDITOR is text to be edited, not a destination — a
        // click puts the caret in it; the bubble menu is how you follow or
        // change it.
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-2',
          rel: 'noopener noreferrer nofollow',
        },
      },
    }),
    Placeholder.configure({ placeholder }),
    Image.configure({
      // Uploaded images arrive as URLs from `POST /files`; a base64 paste would
      // be embedded in the note body and count against the 5MB content cap.
      allowBase64: false,
      HTMLAttributes: { class: 'rounded-xl max-w-full h-auto' },
    }),
    createCaseMentionExtension(mentionStore),
    ClearFormattingShortcut,
    Highlight.configure({ multicolor: false }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
    }),
    TableKit.configure({ table: false }),
    EditorTable.configure({ resizable: false }),
    // Font type and size (the draft editor, 23 October 2026): one span with
    // data attributes from a closed list (lib/notes/note-fonts.ts), never a style. In
    // every note editor, so a note saved from a draft keeps its fonts when it
    // is edited later.
    FontStyle,
  ];
}

/**
 * The table, drawn by Tiptap's own `TableView` (which the package installs only
 * with column resizing on). Without a node view ProseMirror keeps the table's
 * first `<colgroup>`, so deleted columns stayed as empty width until a reload
 * (Tester, 20 October 2026); `TableView.update` redraws the columns on every
 * change. It also puts the table in a `.tableWrapper` box, which scrolls a wide
 * table sideways. Editor only: the stored HTML is `renderHTML`'s, unchanged.
 */
const EditorTable = Table.extend({
  addNodeView() {
    return ({ node }) => new TableView(node, this.options.cellMinWidth);
  },
});
