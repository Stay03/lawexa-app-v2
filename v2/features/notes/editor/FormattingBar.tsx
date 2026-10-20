'use client';

import { useRef } from 'react';
import type { Editor } from '@tiptap/react';
import {
  AtSign,
  ImagePlus,
  Link2,
  Link2Off,
  Loader2,
  MoreHorizontal,
  Redo2,
  RemoveFormatting,
  Undo2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DockPortal } from '@/v2/shell/Dock';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { applyAlign, applyStyle, runFormat, type FormatState } from './formatting';
import { TableMenuItems } from './TableMenu';
import { ToolbarButton, ToolbarDivider } from './ToolbarButton';
import {
  ALIGN_OPTIONS,
  BLOCK_VERBS,
  CLEAR_FORMATTING,
  CODE_VERB,
  STYLE_OPTIONS,
  TEXT_VERBS,
} from './toolbar-verbs';
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
 * ── NINE BUTTONS AND "MORE" (Arthur's editor step 1, 19 October 2026) ────────
 * The row used to scroll sideways, with headings, quote and code a swipe away.
 * It now holds what a thumb reaches for and fits a 390px phone without
 * scrolling: undo · redo | bold · italic | the two lists | image · @case |
 * More. "More" opens a menu above the bar with the rest: the style (Normal
 * text, Large heading, Heading, Subheading), underline, strikethrough,
 * highlight, quote, inline code, alignment, the table actions, link and clear
 * formatting (highlight, alignment, tables and Large heading since Arthur's
 * step 2, 20 October 2026). On a narrower phone the row still scrolls, and a
 * geometry-driven edge fade ({@link useOverflowEdges}) marks the hidden rest.
 */

/** The marks the row keeps; underline, strike and highlight are in More. */
const ROW_TEXT_VERBS = TEXT_VERBS.filter(({ verb }) => verb === 'bold' || verb === 'italic');
const MORE_TEXT_VERBS = TEXT_VERBS.filter(({ verb }) => verb !== 'bold' && verb !== 'italic');
const LIST_VERBS = BLOCK_VERBS.filter(
  ({ verb }) => verb === 'bulletList' || verb === 'orderedList',
);
const QUOTE_VERB = BLOCK_VERBS.find(({ verb }) => verb === 'blockquote');

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
          {/* Undo/redo first: a touch keyboard has no shortcut for either. */}
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

          {ROW_TEXT_VERBS.map(({ verb, icon, label }) => (
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

          <MoreMenu editor={editor} state={state} onLink={onLink} />
        </div>

        {/* Scroll-cut affordances — drawn only while geometry says content is
            hidden on that side, so neither fade can lie on a wide phone. */}
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

/**
 * "More": the verbs the row has no room for, in a menu that opens above the
 * bar. The style is a choice (one is ticked), the marks show whether they are
 * on, and closing the menu hands focus back to the editor so the caret stays
 * where it was.
 */
function MoreMenu({
  editor,
  state,
  onLink,
}: {
  editor: Editor;
  state: FormatState;
  onLink: () => void;
}) {
  // Add link opens the link dialog, which takes focus itself: the menu must not
  // pull focus back to the editor as it closes.
  const toDialog = useRef(false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More formatting"
        onMouseDown={(event) => event.preventDefault()}
        className={cn(
          'v2-interactive inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-secondary/70 hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground',
          FOCUS_RING,
        )}
      >
        <MoreHorizontal aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="end"
        sideOffset={8}
        className="w-60"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!toDialog.current) editor.commands.focus();
          toDialog.current = false;
        }}
      >
        <DropdownMenuLabel>Style</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={state.blockStyle}>
          {STYLE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.style}
              value={option.style}
              disabled={state.inCodeBlock}
              onSelect={() => applyStyle(editor, option.style)}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        {MORE_TEXT_VERBS.map(({ verb, icon: Icon, label }) => (
          <DropdownMenuCheckboxItem
            key={verb}
            checked={state[verb]}
            onSelect={() => runFormat(editor, verb)}
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </DropdownMenuCheckboxItem>
        ))}
        {QUOTE_VERB ? (
          <DropdownMenuCheckboxItem
            checked={state.blockquote}
            onSelect={() => runFormat(editor, QUOTE_VERB.verb)}
          >
            <QUOTE_VERB.icon aria-hidden className="size-4" />
            {QUOTE_VERB.label}
          </DropdownMenuCheckboxItem>
        ) : null}
        <DropdownMenuCheckboxItem
          checked={state.code}
          onSelect={() => runFormat(editor, CODE_VERB.verb)}
        >
          <CODE_VERB.icon aria-hidden className="size-4" />
          {CODE_VERB.label}
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Alignment</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={state.align}>
          {ALIGN_OPTIONS.map(({ align, icon: Icon, label }) => (
            <DropdownMenuRadioItem
              key={align}
              value={align}
              disabled={state.inCodeBlock}
              onSelect={() => applyAlign(editor, align)}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Table</DropdownMenuLabel>
        <TableMenuItems editor={editor} state={state} />

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => {
            toDialog.current = true;
            onLink();
          }}
        >
          {state.link ? <Link2Off aria-hidden className="size-4" /> : <Link2 aria-hidden className="size-4" />}
          {state.link ? 'Remove link' : 'Add link'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => runFormat(editor, CLEAR_FORMATTING.verb)}>
          <RemoveFormatting aria-hidden className="size-4" />
          {CLEAR_FORMATTING.label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
