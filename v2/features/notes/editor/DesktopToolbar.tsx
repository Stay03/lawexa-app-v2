'use client';

import type { Editor } from '@tiptap/react';
import { AtSign, ImagePlus, Link2, Link2Off, Loader2, MoreHorizontal, Redo2, RemoveFormatting, Undo2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { AlignMenu } from './AlignMenu';
import { runFormat, type FormatState } from './formatting';
import { shortcutLabel, useIsMac } from './shortcut-label';
import { StyleSelect } from './StyleSelect';
import { TableMenu } from './TableMenu';
import { DESKTOP_MENU_TRIGGER, ToolbarButton, ToolbarDivider } from './ToolbarButton';
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
 *   undo · redo | style | B I U S highlight | align | lists · quote · table | link · image · @case | More
 *
 * ONE ROW (techlead, 20 October 2026: "a wrapped bar isn't clean"). Step 2
 * added highlight, the alignment menu and the table menu, and the bar wrapped
 * at 1440 px. So its controls are 32 px (the phone's dock bar keeps 36 px for
 * a thumb), the alignment and table buttons show their icon without a chevron,
 * and the two least-used verbs, inline code and clear formatting, sit in a
 * More menu with their key bindings, which still work from the keyboard.
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
        compact
        icon={Undo2}
        label="Undo"
        shortcut={keys(UNDO_KEYS)}
        disabled={!state.canUndo}
        onPress={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        compact
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
          compact
          key={verb}
          icon={icon}
          label={label}
          shortcut={keys(binding)}
          active={state[verb]}
          onPress={() => runFormat(editor, verb)}
        />
      ))}

      <ToolbarDivider />

      <AlignMenu editor={editor} state={state} mac={mac} />

      <ToolbarDivider />

      {SHAPE_VERBS.map(({ verb, icon, label, keys: binding }) => (
        <ToolbarButton
          compact
          key={verb}
          icon={icon}
          label={label}
          shortcut={keys(binding)}
          active={state[verb]}
          onPress={() => runFormat(editor, verb)}
        />
      ))}
      <TableMenu editor={editor} state={state} />

      <ToolbarDivider />

      <ToolbarButton
        compact
        icon={state.link ? Link2Off : Link2}
        label={state.link ? 'Remove link' : 'Add link'}
        active={state.link}
        onPress={onLink}
      />
      <ToolbarButton
        compact
        icon={imageBusy ? Loader2 : ImagePlus}
        label={imageBusy ? 'Uploading image' : 'Insert image'}
        tone="accent"
        spin={imageBusy}
        disabled={imageBusy}
        onPress={onImage}
      />
      <ToolbarButton compact icon={AtSign} label="Mention a case" tone="accent" onPress={onMention} />

      <ToolbarDivider />

      <DesktopMoreMenu editor={editor} state={state} mac={mac} />
    </div>
  );
}

/** Inline code and clear formatting, each with its key binding. Closing hands focus back to the editor. */
function DesktopMoreMenu({ editor, state, mac }: { editor: Editor; state: FormatState; mac: boolean }) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            aria-label="More formatting"
            onMouseDown={(event) => event.preventDefault()}
            className={cn(DESKTOP_MENU_TRIGGER, FOCUS_RING)}
          >
            <MoreHorizontal aria-hidden className="size-4" />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          More
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        className="w-56"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          editor.commands.focus();
        }}
      >
        <DropdownMenuCheckboxItem checked={state.code} onSelect={() => runFormat(editor, CODE_VERB.verb)}>
          <CODE_VERB.icon aria-hidden className="size-4" />
          {CODE_VERB.label}
          <DropdownMenuShortcut>{shortcutLabel(CODE_VERB.keys, mac)}</DropdownMenuShortcut>
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem onSelect={() => runFormat(editor, CLEAR_FORMATTING.verb)}>
          <RemoveFormatting aria-hidden className="size-4" />
          {CLEAR_FORMATTING.label}
          <DropdownMenuShortcut>{shortcutLabel(CLEAR_FORMATTING.keys, mac)}</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
