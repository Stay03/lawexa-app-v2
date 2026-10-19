'use client';

import type { Editor } from '@tiptap/react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { applyStyle, type FormatState } from './formatting';
import { shortcutLabel } from './shortcut-label';
import { STYLE_OPTIONS, styleLabel } from './toolbar-verbs';

/**
 * StyleSelect — the desktop bar's style dropdown (Arthur's editor step 1):
 * Normal text, Heading, Subheading, each with its key binding. The trigger
 * names the block under the caret, so it reads like a word processor's style
 * box. A choice SETS the style (`applyStyle`); it never toggles.
 *
 * Inside a code block a style means nothing, so the dropdown is disabled there.
 * Closing the menu hands focus back to the editor rather than to the trigger,
 * so the caret is where the reader left it.
 */
export function StyleSelect({
  editor,
  state,
  mac,
}: {
  editor: Editor;
  state: FormatState;
  mac: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={state.inCodeBlock}
        aria-label={`Text style: ${styleLabel(state.blockStyle)}`}
        onMouseDown={(event) => event.preventDefault()}
        className={cn(
          'v2-interactive inline-flex h-9 w-32 shrink-0 items-center justify-between gap-1 rounded-lg px-2.5 text-sm text-foreground',
          'transition-colors duration-150 hover:bg-secondary/70 disabled:pointer-events-none disabled:opacity-40',
          'data-[state=open]:bg-secondary',
          FOCUS_RING,
        )}
      >
        <span className="truncate">{styleLabel(state.blockStyle)}</span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-56"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          editor.commands.focus();
        }}
      >
        <DropdownMenuRadioGroup value={state.blockStyle}>
          {STYLE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.style}
              value={option.style}
              onSelect={() => applyStyle(editor, option.style)}
              className={cn(
                option.style === 'h2' && 'text-base font-semibold',
                option.style === 'h3' && 'font-semibold',
              )}
            >
              {option.label}
              <DropdownMenuShortcut>{shortcutLabel(option.keys, mac)}</DropdownMenuShortcut>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
