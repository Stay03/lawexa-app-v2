import { Mark, mergeAttributes, type CommandProps } from '@tiptap/core';

import { noteFont, noteSize, type NoteFont, type NoteSize } from './font-values';

/**
 * FontStyle — a note's font and size as ONE mark, written as the span the
 * contract names (font-values.ts): `<span data-font="…" data-size="…">`, with
 * no `style` attribute, so the reader and the downloads read the same thing.
 *
 * One mark with two attributes rather than two marks, so a run that has both
 * is one span, as agreed; clearing both removes the mark. Reading HTML keeps
 * only allowed values: a span whose values are all unknown is not this mark
 * at all, and its text stays plain.
 *
 * In the editor the attributes are drawn by `note-fonts.css`, from the same
 * data attributes, never by an inline style.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontStyle: {
      /** Set the selection's font; `null` goes back to the house font. */
      setNoteFont: (font: NoteFont | null) => ReturnType;
      /** Set the selection's size; `null` goes back to the default size. */
      setNoteSize: (size: NoteSize | null) => ReturnType;
    };
  }
}

export const FONT_STYLE = 'fontStyle';

export const FontStyle = Mark.create({
  name: FONT_STYLE,

  addAttributes() {
    return {
      font: {
        default: null,
        parseHTML: (element) => noteFont(element.getAttribute('data-font')),
        renderHTML: (attributes) => (attributes.font ? { 'data-font': attributes.font } : {}),
      },
      size: {
        default: null,
        parseHTML: (element) => noteSize(element.getAttribute('data-size')),
        renderHTML: (attributes) => (attributes.size ? { 'data-size': String(attributes.size) } : {}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span',
        // Only a span carrying at least one allowed value is this mark.
        getAttrs: (element) =>
          noteFont(element.getAttribute('data-font')) || noteSize(element.getAttribute('data-size')) ? null : false,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    const apply =
      (change: { font?: NoteFont | null; size?: NoteSize | null }) =>
      ({ commands, editor }: CommandProps) => {
        const current = editor.getAttributes(FONT_STYLE) as { font?: NoteFont | null; size?: NoteSize | null };
        const next = { font: current.font ?? null, size: current.size ?? null, ...change };
        // Inside a command, the command set writes to the one transaction being built.
        if (next.font === null && next.size === null) return commands.unsetMark(FONT_STYLE);
        return commands.setMark(FONT_STYLE, next);
      };
    return {
      setNoteFont: (font) => apply({ font }),
      setNoteSize: (size) => apply({ size }),
    };
  },
});
