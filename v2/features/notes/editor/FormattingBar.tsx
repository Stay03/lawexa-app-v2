'use client';

import type { Editor } from '@tiptap/react';
import { AtSign, ImagePlus, Link2, Link2Off, Loader2, Redo2, Undo2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { DockPortal } from '@/v2/shell/Dock';
import { runFormat, type FormatState } from './formatting';
import { ToolbarButton, ToolbarDivider } from './ToolbarButton';
import { BLOCK_VERBS, CODE_VERB, TEXT_VERBS } from './toolbar-verbs';
import { OVERFLOW_LEFT, OVERFLOW_RIGHT, useOverflowEdges } from './use-overflow-edges';

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
 * region. (The dock row opts out of content-driven width in shell.css — this
 * bar is the max-content child that once inflated the whole shell to 605px on
 * a 390px phone, pushing the header's bell and menu off-screen.)
 *
 * ── WHY IT IS ALWAYS THERE, NOT FOCUS-GATED ─────────────────────────────────
 * Showing the bar only while the editor has focus would make it appear and
 * disappear as the reader taps between the title and the body, and would move
 * the document under them each time. It is present for the whole editing
 * session instead: one stable strip, no reflow.
 *
 * ── REACH ORDER, NOT SPEC ORDER ─────────────────────────────────────────────
 * The row scrolls horizontally on narrow phones rather than wrapping into two
 * rows, so the LEFT end is prime reach and the tail is a swipe away. The order
 * therefore deviates from the shared arrays' spec order, deliberately:
 * undo/redo first (the two verbs a touch keyboard has no shortcut for), then
 * marks, lists, and the three insert actions; the structure verbs (headings,
 * quote, code) take the tail. On a 390px phone the cut lands mid-button, and a
 * geometry-driven edge fade ({@link useOverflowEdges}) marks the hidden rest —
 * a scrollable row must never cut on a clean edge that reads as complete.
 */

/** Reach-ordered slices of the shared vocabulary (see docblock). */
const LIST_VERBS = BLOCK_VERBS.filter(
  ({ verb }) => verb === 'bulletList' || verb === 'orderedList',
);
const STRUCTURE_VERBS = BLOCK_VERBS.filter(
  ({ verb }) => verb === 'h2' || verb === 'h3' || verb === 'blockquote',
);

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
  const { attach, edges } = useOverflowEdges();

  return (
    <DockPortal>
      <div className="relative border-t border-border bg-background/95 backdrop-blur-sm">
        <div
          ref={attach}
          role="toolbar"
          aria-label="Formatting"
          aria-orientation="horizontal"
          className="v2-quiet-scroll flex items-center gap-0.5 overflow-x-auto overscroll-x-contain px-2 py-1.5"
        >
          {/* Undo/redo are MOBILE-ONLY (a physical keyboard has ⌘Z / ⌘⇧Z, a
              touch keyboard has nothing) and sit FIRST — prime reach. */}
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

          <ToolbarDivider />

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

          {LIST_VERBS.map(({ verb, icon, label }) => (
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

          {STRUCTURE_VERBS.map(({ verb, icon, label }) => (
            <ToolbarButton
              key={verb}
              icon={icon}
              label={label}
              active={state[verb]}
              onPress={() => runFormat(editor, verb)}
            />
          ))}
          <ToolbarButton
            icon={CODE_VERB.icon}
            label={CODE_VERB.label}
            active={state.code}
            onPress={() => runFormat(editor, CODE_VERB.verb)}
          />
        </div>

        {/* Scroll-cut affordances — drawn only while geometry says content is
            hidden on that side, so neither fade can lie on a wide tablet. */}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent transition-opacity duration-150 motion-reduce:transition-none',
            edges & OVERFLOW_LEFT ? 'opacity-100' : 'opacity-0',
          )}
        />
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent transition-opacity duration-150 motion-reduce:transition-none',
            edges & OVERFLOW_RIGHT ? 'opacity-100' : 'opacity-0',
          )}
        />
      </div>
    </DockPortal>
  );
}
