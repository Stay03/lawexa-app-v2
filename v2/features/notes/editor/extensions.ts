import type { Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import Image from '@tiptap/extension-image';

import { createCaseMentionExtension } from './case-mention';
import type { CaseMentionStore } from './mention-store';

/**
 * extensions — the note document's SCHEMA, which is also the whole of the
 * "no colour, ever" promise.
 *
 * ── WHAT IS DELIBERATELY ABSENT ─────────────────────────────────────────────
 * No `@tiptap/extension-color`, no `text-style`, no highlight, no font family or
 * size. The owner's decision (August 2026) is that notes have never had colour —
 * coloured notes came from pasting — and the v2 reader strips inline styles at
 * parse. This is the writing half of the same decision, and it is enforced by
 * ABSENCE rather than by a rule: a mark that is not in the schema cannot be
 * created by a shortcut, restored by a paste, or resurrected by stored HTML. The
 * invisible-text bug has nowhere to live.
 *
 * ── WHAT STARTERKIT v3 ALREADY BRINGS ───────────────────────────────────────
 * Bold, italic, STRIKE, UNDERLINE, LINK, code, code block, blockquote, both
 * lists, heading, horizontal rule, hard break, dropcursor, gapcursor, trailing
 * node and UndoRedo (v3's rename of History). Underline and Link were separate
 * packages in v2 and are bundled now, so nothing here imports them — the
 * duplicate registration that would cause is a real error, not a style point.
 *
 * ── HEADINGS: THREE IN THE SCHEMA, TWO ON THE TOOLBAR ───────────────────────
 * The toolbar offers H2 and H3 only (a note's title is the H1 of its page). The
 * SCHEMA still allows H1, because v1 notes contain them and a schema that
 * refused would silently flatten someone's existing headings into paragraphs the
 * first time they opened the note to fix a typo. Offering less than the document
 * can hold is a choice; destroying what it already holds is not.
 */

export interface NoteExtensionsConfig {
  /** The empty-document prompt. */
  placeholder: string;
  /** The `@` picker's state, owned by the screen and shared with the plugin. */
  mentionStore: CaseMentionStore;
}

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
  ];
}
