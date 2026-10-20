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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { applyAlign, type FormatState } from './formatting';
import { shortcutLabel } from './shortcut-label';
import { ALIGN_OPTIONS } from './toolbar-verbs';

/**
 * AlignMenu — the desktop bar's alignment control (Arthur's editor step 2,
 * 20 October 2026). One button that shows the alignment under the caret and
 * opens the four, each with its key binding, so the bar gains one control
 * rather than four. Inside a code block alignment means nothing, so it is
 * disabled there. Closing hands focus back to the editor, as the style box does.
 */
export function AlignMenu({
  editor,
  state,
  mac,
}: {
  editor: Editor;
  state: FormatState;
  mac: boolean;
}) {
  const current = ALIGN_OPTIONS.find((option) => option.align === state.align) ?? ALIGN_OPTIONS[0];
  const Icon = current.icon;
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            disabled={state.inCodeBlock}
            aria-label={`Alignment: ${current.label}`}
            onMouseDown={(event) => event.preventDefault()}
            className={cn(
              'v2-interactive inline-flex h-9 shrink-0 items-center gap-0.5 rounded-lg px-2 text-muted-foreground',
              'transition-colors duration-150 hover:bg-secondary/70 hover:text-foreground',
              'disabled:pointer-events-none disabled:opacity-40 data-[state=open]:bg-secondary data-[state=open]:text-foreground',
              FOCUS_RING,
            )}
          >
            <Icon aria-hidden className="size-4" />
            <ChevronDown aria-hidden className="size-3.5" />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          Alignment
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="start"
        className="w-52"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          editor.commands.focus();
        }}
      >
        <DropdownMenuRadioGroup value={state.align}>
          {ALIGN_OPTIONS.map(({ align, icon: OptionIcon, label, keys }) => (
            <DropdownMenuRadioItem
              key={align}
              value={align}
              onSelect={() => applyAlign(editor, align)}
            >
              <OptionIcon aria-hidden className="size-4" />
              {label}
              <DropdownMenuShortcut>{shortcutLabel(keys, mac)}</DropdownMenuShortcut>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
