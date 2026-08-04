'use client';

import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Link2, Link2Off } from 'lucide-react';

import { runFormat, type FormatState } from './formatting';
import { ToolbarButton, ToolbarDivider } from './ToolbarButton';
import { BLOCK_VERBS, CODE_VERB, TEXT_VERBS } from './toolbar-verbs';

/**
 * EditorBubbleMenu — the DESKTOP formatting surface: nothing on screen until
 * text is selected, then the verbs appear over the selection.
 *
 * ── WHY THERE IS NO FIXED TOOLBAR ───────────────────────────────────────────
 * The page is the paper. v1 put a permanent centred button bar above the
 * document (and a second one in "writer mode"), which meant every note was
 * written under a strip of chrome that is only relevant while formatting. Here
 * the chrome is summoned by the act that needs it and is otherwise absent.
 *
 * ── DESKTOP ONLY, DELIBERATELY ──────────────────────────────────────────────
 * This component is never rendered on a touch device. Selecting text on iOS
 * raises the system callout (Copy / Look Up / Share) directly over the selection
 * — the exact space a bubble occupies — and a web page cannot suppress it
 * (Tiptap #1806, #6276). Touch gets `FormattingBar` in the shell dock instead.
 * The choice is made by pointer capability, not width (see `useCoarsePointer`).
 *
 * ── TRANSFORM VERBS ONLY ────────────────────────────────────────────────────
 * Every button here acts ON the selection. The two INSERT actions (an image, an
 * `@case` reference) are deliberately absent: they put something NEW at the
 * caret, so offering them over a selection would mean replacing the text the
 * reader just highlighted. On desktop they live in the page's header row, which
 * is reachable with nothing selected — where inserting actually makes sense.
 *
 * ── v3 POSITIONING ──────────────────────────────────────────────────────────
 * Tiptap 3 positions this with Floating UI through `options`; `tippyOptions` is
 * gone with the dependency. `updateDelay` throttles repositioning while a
 * selection is dragged.
 */
export function EditorBubbleMenu({
  editor,
  state,
  onLink,
}: {
  editor: Editor;
  state: FormatState;
  /** Opens the link dialog (or removes the link when one is active). */
  onLink: () => void;
}) {
  return (
    <BubbleMenu
      editor={editor}
      updateDelay={120}
      options={{ placement: 'top', offset: 8, flip: true, shift: true }}
      // Only over a REAL selection, and never inside a code block, where every
      // verb here would either do nothing or corrupt the block.
      shouldShow={({ editor: instance, from, to }) =>
        from !== to && !instance.isActive('codeBlock')
      }
      className="z-50 flex items-center gap-0.5 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-150"
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
    </BubbleMenu>
  );
}
