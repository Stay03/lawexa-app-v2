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
import { PILL_TRIGGER } from './ToolbarButton';
import { STYLE_OPTIONS, styleLabel } from './toolbar-verbs';

/**
 * StyleSelect — the desktop bar's style dropdown (Arthur's editor step 1):
 * Normal text, Large heading (step 2), Heading, Subheading, each with its key
 * binding. The trigger
 * names the block under the caret, so it reads like a word processor's style
 * box. A choice SETS the style (`applyStyle`); it never toggles.
 *
 * Inside a code block a style means nothing, so the dropdown is disabled there.
 * Closing the menu hands focus back to the editor rather than to the trigger,
 * so the caret is where the reader left it.
 *
 * `pill` is the draft panel's floating bar (take B): a trigger as wide as its
 * word, with "Normal" for normal text, so the bar stays short.
 */
export function StyleSelect({
  editor,
  state,
  mac,
  pill = false,
  menuClassName,
}: {
  editor: Editor;
  state: FormatState;
  mac: boolean;
  pill?: boolean;
  /** The caller's surface for the menu (the draft panel's own). */
  menuClassName?: string;
}) {
  const label = styleLabel(state.blockStyle);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={state.inCodeBlock}
        aria-label={`Text style: ${label}`}
        onMouseDown={(event) => event.preventDefault()}
        className={cn(
          pill
            ? cn(PILL_TRIGGER, 'gap-1.5 pr-1.75 pl-2.25 text-[13px] text-foreground')
            : cn(
                // 144 px holds "Large heading", the longest name, without an ellipsis
                // (Tester, 20 October 2026: "Normal t…" at 112 px).
                'v2-interactive inline-flex h-8 w-36 shrink-0 items-center justify-between gap-1 rounded-lg px-2 text-sm text-foreground',
                'transition-colors duration-150 hover:bg-secondary/70 disabled:pointer-events-none disabled:opacity-40',
                'data-[state=open]:bg-secondary',
              ),
          FOCUS_RING,
        )}
      >
        <span className="truncate">{pill && state.blockStyle === 'paragraph' ? 'Normal' : label}</span>
        <ChevronDown aria-hidden className={cn('shrink-0 text-muted-foreground', pill ? 'size-3.25' : 'size-4')} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn('w-56', menuClassName)}
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
                option.style === 'h1' && 'text-lg font-semibold',
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
