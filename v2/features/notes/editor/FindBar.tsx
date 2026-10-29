'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { CaseSensitive, ChevronDown, ChevronRight, ChevronUp, WholeWord, X, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import {
  clearFind,
  FIND_DEFAULTS,
  findCountLabel,
  findNext,
  findPrevious,
  getFindState,
  replaceAll,
  replaceCurrent,
  runFind,
  setFindQuery,
  type FindOptions,
} from './find-replace';
import { FindDebugPanel } from './FindDebugPanel';
import './find-replace.css';

/**
 * FindBar — find and replace in a note's body (Arthur asked; Stay said "Yes
 * build", 24 October 2026). One bar for the note editor and the chat's draft
 * panel.
 *
 *   [›] [Find        3 of 12] [↑] [↓] [Aa] [ab] [×]
 *       [Replace with        ] [Replace] [Replace all]
 *
 * Aa is Match case and [ab] is Whole word (find-replace.ts), both off as the
 * bar opens. Enter goes to the next match and Shift+Enter to the previous
 * one; Escape or × closes the bar, clears every tint and puts the caret back
 * in the note. The chevron opens the replace row. A read-only editor has no chevron and no
 * replace row, so it can find but not change.
 *
 * Three places to stand:
 *  - `float`: a computer. A small card at the top right of the note, over the
 *    text, under the sticky formatting bar.
 *  - `dock`: a phone. A full-width strip at the top of the screen under the
 *    header, so the keyboard does not cover it.
 *  - `draft`: the draft panel, which draws one bar for both shapes: a strip on
 *    the phone sheet, the card at xl.
 */
export type FindBarLayout = 'float' | 'dock' | 'draft';

const FRAME: Record<FindBarLayout, string> = {
  float: 'w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg',
  dock: 'border-b border-border bg-background/95 px-2 py-1.5 backdrop-blur-sm',
  draft: cn(
    'border-b border-border/70 bg-popover/95 px-3 py-1.5 backdrop-blur-sm',
    // The panel's menus lift on a shadow with no ring (draft-panel.css).
    'xl:absolute xl:top-full xl:right-3 xl:mt-2 xl:w-[24rem] xl:rounded-xl xl:border-0 xl:bg-[var(--v2-draft-menu-bg)] xl:p-1.5 xl:shadow-[var(--v2-draft-menu-shadow)] xl:backdrop-blur-none',
  ),
};

/** 32px for a pointer, 36px for a thumb. */
const BUTTON_SIZE: Record<FindBarLayout, string> = {
  float: 'size-8',
  dock: 'size-9',
  draft: 'size-9 xl:size-8',
};

/** The boxes and the Replace buttons, as tall as the icon buttons. */
const CONTROL_HEIGHT: Record<FindBarLayout, string> = {
  float: 'h-8',
  dock: 'h-9',
  draft: 'h-9 xl:h-8',
};

export function FindBar({
  editor,
  layout,
  label,
  seed,
  focusRequest,
  onClose,
}: {
  editor: Editor;
  layout: FindBarLayout;
  /** The search region's name ("Find in note", "Find in draft"). */
  label: string;
  /** The words to search for as the bar opens: the selection, or nothing. */
  seed: string;
  /** Moves on every request to open, so a second Ctrl+F puts focus back in the find box. */
  focusRequest: number;
  onClose: () => void;
}) {
  const countId = useId();
  const replaceId = useId();
  const findRef = useRef<HTMLInputElement | null>(null);
  // The seed counts only as the bar opens; a later one would fight the box.
  const seedRef = useRef(seed);
  const [query, setQuery] = useState(seed);
  const [replacement, setReplacement] = useState('');
  const [options, setOptions] = useState<FindOptions>(FIND_DEFAULTS);
  const [replaceOpen, setReplaceOpen] = useState(false);

  const { total, current, editable } = useEditorState({
    editor,
    selector: ({ editor: instance }) => {
      const find = getFindState(instance.state);
      return { total: find.matches.length, current: find.current, editable: instance.isEditable };
    },
  });

  // Search for the seed as the bar opens; clear every tint when it goes, by
  // any road (the × or Escape, or the screen unmounting it).
  useEffect(() => {
    runFind(editor, setFindQuery(seedRef.current, FIND_DEFAULTS));
    return () => {
      if (!editor.isDestroyed) runFind(editor, clearFind());
    };
  }, [editor]);

  // Focus goes to the find box on open, and again on each Ctrl+F while open.
  useEffect(() => {
    const input = findRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [focusRequest]);

  const search = (value: string) => {
    setQuery(value);
    runFind(editor, setFindQuery(value, options));
  };

  const toggle = (option: keyof FindOptions) => {
    const next = { ...options, [option]: !options[option] };
    setOptions(next);
    runFind(editor, setFindQuery(query, next));
  };

  const close = () => {
    runFind(editor, clearFind());
    onClose();
    editor.commands.focus();
  };

  const next = () => runFind(editor, findNext());
  const previous = () => runFind(editor, findPrevious());
  const replaceOne = () => {
    if (editable) runFind(editor, replaceCurrent(replacement));
  };
  const replaceEvery = () => {
    if (editable) runFind(editor, replaceAll(replacement));
  };

  const onFindKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (event.shiftKey) previous();
    else next();
  };

  const onReplaceKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    replaceOne();
  };

  const count = findCountLabel(query, total, current);
  const none = total === 0;

  return (
    <div
      role="search"
      aria-label={label}
      onKeyDown={(event) => {
        // Escape closes the bar alone: the draft panel's own Escape must not
        // close the panel too.
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
      className={cn(FRAME[layout], 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150')}
    >
      {/* The hidden readout, only with ?finddebug=1 (find-debug.ts). */}
      <FindDebugPanel />
      <div className="flex items-center gap-0.5">
        {editable ? (
          <FindIconButton
            layout={layout}
            icon={replaceOpen ? ChevronDown : ChevronRight}
            label={replaceOpen ? 'Hide replace' : 'Show replace'}
            expanded={replaceOpen}
            controls={replaceOpen ? replaceId : undefined}
            onPress={() => setReplaceOpen((open) => !open)}
          />
        ) : null}
        <div className="relative min-w-0 flex-1">
          <Input
            ref={findRef}
            value={query}
            onChange={(event) => search(event.target.value)}
            onKeyDown={onFindKey}
            placeholder="Find"
            aria-label="Find"
            aria-describedby={countId}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            className={cn(CONTROL_HEIGHT[layout], 'rounded-lg')}
            // Room for the count and no more, so on a phone, with Whole word
            // beside Match case, the words typed stay in view.
            style={count ? { paddingRight: `calc(${count.length}ch + 1rem)` } : undefined}
          />
          <span
            id={countId}
            aria-live="polite"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs tabular-nums text-muted-foreground"
          >
            {count}
          </span>
        </div>
        <FindIconButton
          layout={layout}
          icon={ChevronUp}
          label="Previous match"
          shortcut="Shift+Enter"
          disabled={none}
          onPress={previous}
        />
        <FindIconButton
          layout={layout}
          icon={ChevronDown}
          label="Next match"
          shortcut="Enter"
          disabled={none}
          onPress={next}
        />
        <FindIconButton
          layout={layout}
          icon={CaseSensitive}
          label="Match case"
          pressed={options.caseSensitive}
          onPress={() => toggle('caseSensitive')}
        />
        <FindIconButton
          layout={layout}
          icon={WholeWord}
          label="Whole word"
          pressed={options.wholeWord}
          onPress={() => toggle('wholeWord')}
        />
        <FindIconButton layout={layout} icon={X} label="Close find" shortcut="Esc" onPress={close} />
      </div>

      {editable && replaceOpen ? (
        <div id={replaceId} className="mt-1 flex items-center gap-1">
          {/* Lines the replace box up under the find box. */}
          <span aria-hidden className={cn('shrink-0', BUTTON_SIZE[layout])} />
          <Input
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            onKeyDown={onReplaceKey}
            placeholder="Replace with"
            aria-label="Replace with"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className={cn(CONTROL_HEIGHT[layout], 'min-w-0 flex-1 rounded-lg')}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={none}
            onClick={replaceOne}
            className={cn(CONTROL_HEIGHT[layout], 'rounded-lg')}
          >
            Replace
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={none}
            onClick={replaceEvery}
            className={cn(CONTROL_HEIGHT[layout], 'rounded-lg')}
          >
            Replace all
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The bar's icon buttons. A press keeps focus in the find box (so Enter still
 * goes to the next match). On a computer each names itself in a tooltip; on a
 * phone, which has no hover, the name is for the screen reader alone.
 */
function FindIconButton({
  layout,
  icon: Icon,
  label,
  shortcut,
  disabled = false,
  pressed,
  expanded,
  controls,
  onPress,
}: {
  layout: FindBarLayout;
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  /** For a toggle (Match case, Whole word): on or off. */
  pressed?: boolean;
  /** For the chevron: whether the replace row is open. */
  expanded?: boolean;
  controls?: string;
  onPress: () => void;
}) {
  const button = (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-disabled={disabled ? true : undefined}
      onMouseDown={(event) => event.preventDefault()}
      onClick={disabled ? undefined : onPress}
      className={cn(
        'v2-interactive inline-flex shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150',
        BUTTON_SIZE[layout],
        disabled
          ? 'cursor-default opacity-40'
          : pressed
            ? 'bg-secondary text-foreground'
            : 'hover:bg-secondary/70 hover:text-foreground',
        FOCUS_RING,
      )}
    >
      <Icon aria-hidden className="size-4" />
    </button>
  );

  if (layout === 'dock') return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        <span>{label}</span>
        {shortcut ? <kbd className="ml-2 font-sans text-[11px] opacity-70">{shortcut}</kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}
