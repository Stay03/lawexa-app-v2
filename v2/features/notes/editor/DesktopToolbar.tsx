'use client';

import type { Editor } from '@tiptap/react';
import { AtSign, ImagePlus, Link2, Link2Off, Loader2, Redo2, RemoveFormatting, Undo2 } from 'lucide-react';

import { runFormat, type FormatState } from './formatting';
import { shortcutLabel, useIsMac } from './shortcut-label';
import { StyleSelect } from './StyleSelect';
import { ToolbarButton, ToolbarDivider } from './ToolbarButton';
import { BLOCK_VERBS, CLEAR_FORMATTING, CODE_VERB, REDO_KEYS, TEXT_VERBS, UNDO_KEYS } from './toolbar-verbs';

/** The lists and the quote: the block shapes that stay buttons beside the style box. */
const SHAPE_VERBS = BLOCK_VERBS.filter(
  ({ verb }) => verb === 'bulletList' || verb === 'orderedList' || verb === 'blockquote',
);

/**
 * DesktopToolbar — the note editor's bar on a computer (Arthur's editor step 1,
 * 19 October 2026). Until now a computer had only the selection bubble and two
 * insert icons in the header, so undo, redo and a heading needed a shortcut the
 * reader had to know. The bar holds every verb, in a word processor's order:
 *
 *   undo · redo | style | B I U S | lists · quote | link · image · @case | code · clear formatting
 *
 * Each button's tooltip names it and its key binding (⌘ on a Mac, Ctrl
 * elsewhere). The bar sticks to the top of the page while the note scrolls
 * under it. The selection bubble stays: it is the quick reach for a word just
 * selected, and both read the same verbs (`toolbar-verbs.ts`).
 */
export function DesktopToolbar({
  editor,
  state,
  onLink,
  onImage,
  onMention,
  imageBusy,
}: {
  editor: Editor;
  state: FormatState;
  onLink: () => void;
  onImage: () => void;
  onMention: () => void;
  imageBusy: boolean;
}) {
  const mac = useIsMac();
  const keys = (binding: string) => shortcutLabel(binding, mac);

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      aria-orientation="horizontal"
      className="sticky top-0 z-20 -mx-2 mb-6 flex flex-wrap items-center gap-0.5 border-b border-border bg-background/95 px-2 py-1.5 backdrop-blur-sm"
    >
      <ToolbarButton
        icon={Undo2}
        label="Undo"
        shortcut={keys(UNDO_KEYS)}
        disabled={!state.canUndo}
        onPress={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        icon={Redo2}
        label="Redo"
        shortcut={keys(REDO_KEYS)}
        disabled={!state.canRedo}
        onPress={() => editor.chain().focus().redo().run()}
      />

      <ToolbarDivider />

      <StyleSelect editor={editor} state={state} mac={mac} />

      <ToolbarDivider />

      {TEXT_VERBS.map(({ verb, icon, label, keys: binding }) => (
        <ToolbarButton
          key={verb}
          icon={icon}
          label={label}
          shortcut={keys(binding)}
          active={state[verb]}
          onPress={() => runFormat(editor, verb)}
        />
      ))}

      <ToolbarDivider />

      {SHAPE_VERBS.map(({ verb, icon, label, keys: binding }) => (
        <ToolbarButton
          key={verb}
          icon={icon}
          label={label}
          shortcut={keys(binding)}
          active={state[verb]}
          onPress={() => runFormat(editor, verb)}
        />
      ))}

      <ToolbarDivider />

      <ToolbarButton
        icon={state.link ? Link2Off : Link2}
        label={state.link ? 'Remove link' : 'Add link'}
        active={state.link}
        onPress={onLink}
      />
      <ToolbarButton
        icon={imageBusy ? Loader2 : ImagePlus}
        label={imageBusy ? 'Uploading image' : 'Insert image'}
        tone="accent"
        spin={imageBusy}
        disabled={imageBusy}
        onPress={onImage}
      />
      <ToolbarButton icon={AtSign} label="Mention a case" tone="accent" onPress={onMention} />

      <ToolbarDivider />

      <ToolbarButton
        icon={CODE_VERB.icon}
        label={CODE_VERB.label}
        shortcut={keys(CODE_VERB.keys)}
        active={state.code}
        onPress={() => runFormat(editor, CODE_VERB.verb)}
      />
      <ToolbarButton
        icon={RemoveFormatting}
        label={CLEAR_FORMATTING.label}
        shortcut={keys(CLEAR_FORMATTING.keys)}
        onPress={() => runFormat(editor, CLEAR_FORMATTING.verb)}
      />
    </div>
  );
}
