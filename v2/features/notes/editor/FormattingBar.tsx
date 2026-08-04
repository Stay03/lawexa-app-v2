'use client';

import type { Editor } from '@tiptap/react';
import { AtSign, ImagePlus, Link2, Link2Off, Loader2, Redo2, Undo2 } from 'lucide-react';

import { DockPortal } from '@/v2/shell/Dock';
import { runFormat, type FormatState } from './formatting';
import { ToolbarButton, ToolbarDivider } from './ToolbarButton';
import { BLOCK_VERBS, CODE_VERB, TEXT_VERBS } from './toolbar-verbs';

/**
 * FormattingBar — the TOUCH formatting surface, docked in the shell's bottom row.
 *
 * ── WHY THE DOCK AND NOT A FLOATING BAR ─────────────────────────────────────
 * The shell is a three-row grid pinned to `calc(100dvh - var(--keyboard-inset))`,
 * so anything in the dock row rides ABOVE the on-screen keyboard for free — on
 * browsers that resize the layout viewport because `dvh` already shrank, and on
 * the ones that only overlay it (iOS Safari, and the Android engines that ignore
 * `interactive-widget`) because `KeyboardInsetSync` measures the occlusion and
 * writes it into that variable. A `position: fixed` bar would sit BEHIND the
 * keyboard on exactly those devices, which is the bug the dock exists to
 * prevent. `DockPortal` is how a route fills that row from inside the content
 * region.
 *
 * ── WHY IT IS ALWAYS THERE, NOT FOCUS-GATED ─────────────────────────────────
 * Showing the bar only while the editor has focus would make it appear and
 * disappear as the reader taps between the title and the body, and would move
 * the document under them each time. It is present for the whole editing
 * session instead: one stable strip, no reflow, and undo/redo — the two verbs a
 * touch keyboard has no shortcut for — always within reach.
 *
 * The row scrolls horizontally on narrow phones rather than wrapping into two
 * rows, so the document never loses a second strip of height.
 */
export function FormattingBar({
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
  /** An upload is in flight — the image button shows it rather than a toast. */
  imageBusy: boolean;
}) {
  return (
    <DockPortal>
      <div className="border-t border-border bg-background/95 backdrop-blur-sm">
        <div
          role="toolbar"
          aria-label="Formatting"
          aria-orientation="horizontal"
          className="v2-quiet-scroll flex items-center gap-0.5 overflow-x-auto px-2 py-1.5"
        >
          {TEXT_VERBS.map(({ verb, icon, label }) => (
            <ToolbarButton
              key={verb}
              icon={icon}
              label={label}
              active={state[verb]}
              onPress={() => runFormat(editor, verb)}
            />
          ))}

          <ToolbarDivider />

          {BLOCK_VERBS.map(({ verb, icon, label }) => (
            <ToolbarButton
              key={verb}
              icon={icon}
              label={label}
              active={state[verb]}
              onPress={() => runFormat(editor, verb)}
            />
          ))}

          <ToolbarDivider />

          <ToolbarButton
            icon={CODE_VERB.icon}
            label={CODE_VERB.label}
            active={state.code}
            onPress={() => runFormat(editor, CODE_VERB.verb)}
          />
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
          <ToolbarButton
            icon={AtSign}
            label="Mention a case"
            tone="accent"
            onPress={onMention}
          />

          <ToolbarDivider />

          {/* Undo/redo are MOBILE-ONLY: a physical keyboard already has ⌘Z / ⌘⇧Z,
              and a touch keyboard has nothing. */}
          <ToolbarButton
            icon={Undo2}
            label="Undo"
            disabled={!state.canUndo}
            onPress={() => editor.chain().focus().undo().run()}
          />
          <ToolbarButton
            icon={Redo2}
            label="Redo"
            disabled={!state.canRedo}
            onPress={() => editor.chain().focus().redo().run()}
          />
        </div>
      </div>
    </DockPortal>
  );
}
