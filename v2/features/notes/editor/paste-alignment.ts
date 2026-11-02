import { Extension } from '@tiptap/core';
import { Slice, type Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * paste-alignment — the first pasted line keeps its own alignment (Tester's
 * live check, 4c515c9b, after the pasted-alignment fix, paste-sanitizer.ts).
 *
 * ProseMirror pastes a slice whose first block is open: that block's words
 * join the line at the caret, and the line keeps its own attributes. So a
 * centred title pasted on an empty line took that line's alignment and came
 * in left, while every later block kept its own.
 *
 * When the caret sits in an EMPTY paragraph or heading and the first pasted
 * block brings an alignment of its own (`textAlign`, kept by the paste
 * cleaner) that differs from the line's, the slice's start is closed: the
 * pasted block replaces the empty line whole, alignment and all. Pasting into
 * a line that has words, or pasting a block with no alignment (plain text
 * among it), still joins the line as before, so a word pasted mid-sentence
 * never splits it.
 */
export function keepFirstPastedAlignment(slice: Slice, caretBlock: PMNode): Slice {
  if (slice.openStart === 0 || caretBlock.content.size > 0 || !caretBlock.isTextblock) return slice;
  let first: PMNode | null | undefined = slice.content.firstChild;
  for (let depth = 1; first && depth < slice.openStart; depth++) first = first.firstChild;
  const align = first?.isTextblock ? (first.attrs.textAlign as string | null | undefined) : undefined;
  if (!align || align === caretBlock.attrs.textAlign) return slice;
  return new Slice(slice.content, 0, slice.openEnd);
}

/** The plugin carrying it, in every note editor and the draft panel (`createNoteExtensions`). */
export const PasteAlignment = Extension.create({
  name: 'pasteAlignment',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('pasteAlignment'),
        props: {
          transformPasted: (slice, view) => keepFirstPastedAlignment(slice, view.state.selection.$from.parent),
        },
      }),
    ];
  },
});
