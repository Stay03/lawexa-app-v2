'use client';

import { useEditorState, type Editor } from '@tiptap/react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { FONT_STYLE } from './font-style';
import { HOUSE_FONT_LABEL, NOTE_FONTS, NOTE_SIZES, noteFont, noteSize, type NoteFont, type NoteSize } from './font-values';

/**
 * FontMenu and SizeMenu — the toolbar's font type and size (the draft editor,
 * Stay 23 October 2026), each a dropdown like the text style one
 * (StyleSelect.tsx): it names what is under the caret, a choice SETS it, and
 * closing hands focus back to the editor. "Default" goes back to the house
 * font or size, which carries no attribute at all.
 *
 * Each font's name is set in that font, so the reader sees what they pick.
 */

const TRIGGER = cn(
  'v2-interactive inline-flex h-8 shrink-0 items-center justify-between gap-1 rounded-lg px-2 text-sm text-foreground',
  'transition-colors duration-150 hover:bg-secondary/70 disabled:pointer-events-none disabled:opacity-40',
  'data-[state=open]:bg-secondary',
  FOCUS_RING,
);

const FONT_FACE: Readonly<Record<NoteFont, string>> = {
  'Times New Roman': "font-['Times_New_Roman',Times,serif]",
  Arial: 'font-[Arial,Helvetica,sans-serif]',
  Georgia: 'font-[Georgia,serif]',
};

const DEFAULT_VALUE = 'default';

function useFontState(editor: Editor): { font: NoteFont | null; size: NoteSize | null; disabled: boolean } {
  return (
    useEditorState({
      editor,
      selector: ({ editor: instance }) => {
        const attributes = instance.getAttributes(FONT_STYLE);
        return {
          font: noteFont(attributes.font),
          size: noteSize(attributes.size),
          disabled: instance.isActive('codeBlock'),
        };
      },
    }) ?? { font: null, size: null, disabled: false }
  );
}

export function FontMenu({ editor }: { editor: Editor }) {
  const { font, disabled } = useFontState(editor);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={`Font: ${font ?? HOUSE_FONT_LABEL}`}
        onMouseDown={(event) => event.preventDefault()}
        // 9.5rem holds "Times New Roman" without an ellipsis.
        className={cn(TRIGGER, 'w-[9.5rem]')}
      >
        <span className={cn('truncate', font && FONT_FACE[font])}>
          {font ?? HOUSE_FONT_LABEL}
        </span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-52"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          editor.commands.focus();
        }}
      >
        <DropdownMenuRadioGroup value={font ?? DEFAULT_VALUE}>
          <DropdownMenuRadioItem value={DEFAULT_VALUE} onSelect={() => editor.chain().focus().setNoteFont(null).run()}>
            {HOUSE_FONT_LABEL}
          </DropdownMenuRadioItem>
          {NOTE_FONTS.map((option) => (
            <DropdownMenuRadioItem
              key={option}
              value={option}
              onSelect={() => editor.chain().focus().setNoteFont(option).run()}
              className={FONT_FACE[option]}
            >
              {option}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SizeMenu({ editor }: { editor: Editor }) {
  const { size, disabled } = useFontState(editor);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={`Size: ${size ? `${size} point` : HOUSE_FONT_LABEL}`}
        onMouseDown={(event) => event.preventDefault()}
        className={cn(TRIGGER, 'w-[4.5rem] tabular-nums')}
      >
        <span className="truncate">{size ?? '–'}</span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-32"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          editor.commands.focus();
        }}
      >
        <DropdownMenuRadioGroup value={size ? String(size) : DEFAULT_VALUE}>
          <DropdownMenuRadioItem value={DEFAULT_VALUE} onSelect={() => editor.chain().focus().setNoteSize(null).run()}>
            {HOUSE_FONT_LABEL}
          </DropdownMenuRadioItem>
          {NOTE_SIZES.map((option) => (
            <DropdownMenuRadioItem
              key={option}
              value={String(option)}
              onSelect={() => editor.chain().focus().setNoteSize(option).run()}
              className="tabular-nums"
            >
              {option} pt
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
