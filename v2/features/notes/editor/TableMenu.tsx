'use client';

import { Fragment } from 'react';
import type { Editor } from '@tiptap/react';
import { ChevronDown, Table } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { runTableAction, type FormatState } from './formatting';
import { TABLE_EDITS, TABLE_INSERT } from './toolbar-verbs';

/**
 * TableMenu — the desktop bar's table control (Arthur's editor step 2,
 * 20 October 2026). Outside a table it offers Insert table (three by three,
 * with a header row). With the caret in a table it offers rows, columns, the
 * header row and the removals, in that order, so the destructive ones sit
 * last and in the destructive colour. The button is lit while the caret is in
 * a table. Closing hands focus back to the editor.
 */
export function TableMenu({ editor, state }: { editor: Editor; state: FormatState }) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            disabled={state.inCodeBlock}
            aria-label="Table"
            onMouseDown={(event) => event.preventDefault()}
            className={cn(
              'v2-interactive inline-flex h-9 shrink-0 items-center gap-0.5 rounded-lg px-2 text-muted-foreground',
              'transition-colors duration-150 hover:bg-secondary/70 hover:text-foreground',
              'disabled:pointer-events-none disabled:opacity-40 data-[state=open]:bg-secondary data-[state=open]:text-foreground',
              state.inTable && 'bg-secondary text-foreground',
              FOCUS_RING,
            )}
          >
            <Table aria-hidden className="size-4" />
            <ChevronDown aria-hidden className="size-3.5" />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          Table
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
        <TableMenuItems editor={editor} state={state} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The table actions as menu items, shared by the desktop menu and the phone's
 * More menu so the two offer the same actions in the same order.
 */
export function TableMenuItems({ editor, state }: { editor: Editor; state: FormatState }) {
  if (!state.inTable) {
    return (
      <DropdownMenuItem onSelect={() => runTableAction(editor, TABLE_INSERT.action)}>
        <Table aria-hidden className="size-4" />
        {TABLE_INSERT.label}
      </DropdownMenuItem>
    );
  }
  return TABLE_EDITS.map((group, index) => (
    <Fragment key={group[0].action}>
      {index > 0 && <DropdownMenuSeparator />}
      {group.map((item) => (
        <DropdownMenuItem
          key={item.action}
          variant={item.removes ? 'destructive' : 'default'}
          onSelect={() => runTableAction(editor, item.action)}
        >
          {item.label}
        </DropdownMenuItem>
      ))}
    </Fragment>
  ));
}
