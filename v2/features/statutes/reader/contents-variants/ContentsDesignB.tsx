'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { CornerDownLeft, Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
  DialogSurface,
  DialogTitle,
} from '@/components/ui/dialog';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import type { AknOutlineDivision } from '../akn';
import { LockMark } from '../StatuteOutline';
import {
  matchOutline,
  matchRows,
  sectionCount,
  splitDivisionLabel,
  splitSectionLabel,
  stepHighlight,
  type OutlineMatchRow,
} from './contents-model';
import { useCentreOnMount, type ContentsDesignProps } from './shared';

/**
 * Contents design B, "jump to" (`?contents=b`; finding 10, prototype).
 *
 * A centred panel with a search field on top, in the command-palette
 * grammar: type a section number or a few words of a title and the list
 * narrows as you type, grouped by Part with the Part's name held at the top
 * of its group as it scrolls. Arrow keys move the highlight, Enter jumps,
 * Escape closes; a pointer hovers and clicks. The current section wears a
 * "Here" tag and the list opens on it.
 *
 * On a PHONE the panel sits at the top of the screen so the keyboard, which
 * rises at once, never covers it; its height follows the keyboard inset. On
 * a COMPUTER it is a card a little above centre, 36rem wide.
 *
 * The field is a combobox over a listbox (`aria-activedescendant`), the
 * pattern a screen reader already knows for a filtered list: it announces
 * the highlighted row as the arrows move without focus ever leaving the
 * field.
 */

const PANEL =
  'fixed inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] z-50 flex max-h-[calc(100dvh-var(--keyboard-inset,0px)-1.5rem)] flex-col overflow-hidden rounded-3xl bg-popover text-sm shadow-2xl ring-1 ring-foreground/5 outline-none';

const PANEL_DESKTOP =
  'md:inset-x-auto md:left-1/2 md:top-[max(3rem,14dvh)] md:w-[36rem] md:max-w-[calc(100vw-2rem)] md:-translate-x-1/2 md:max-h-[min(34rem,calc(100dvh-max(3rem,14dvh)-2rem))]';

/** Drops in from the top on a phone; on a computer a short rise with a
 *  little zoom, the card's own motion. */
const PANEL_MOTION =
  'data-open:animate-in data-closed:animate-out data-open:fade-in-0 data-closed:fade-out-0 data-open:slide-in-from-top-4 data-closed:slide-out-to-top-4 md:data-open:zoom-in-95 md:data-closed:zoom-out-95 md:data-open:slide-in-from-top-2 md:data-closed:slide-out-to-top-2 duration-200 ease-out';

export function ContentsDesignB({
  outline,
  activeId,
  onJump,
  open,
  onOpenChange,
}: ContentsDesignProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const select = (id: string) => {
    onOpenChange(false);
    onJump(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40" />
        <DialogSurface
          className={cn(PANEL, PANEL_DESKTOP, PANEL_MOTION)}
          aria-describedby={undefined}
          /* The field is the panel: focus goes straight to it on both
             shapes, so the reader types at once. */
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <JumpTo outline={outline} activeId={activeId} select={select} inputRef={inputRef} />
        </DialogSurface>
      </DialogPortal>
    </Dialog>
  );
}

/* ── The body ────────────────────────────────────────────────────────────── */

function JumpTo({
  outline,
  activeId,
  select,
  inputRef,
}: {
  outline: AknOutlineDivision[];
  activeId: string | null;
  select: (id: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (row: OutlineMatchRow) => `${baseId}-${row.id}`;

  // One state for the query and the highlight together, so a new query
  // resets the highlight in the same update and the two can never disagree.
  const [state, setState] = useState(() => {
    const rows = matchRows(matchOutline(outline, ''));
    const current = rows.findIndex((row) => row.id === activeId);
    return { query: '', highlight: current };
  });
  const groups = useMemo(() => matchOutline(outline, state.query), [outline, state.query]);
  const rows = useMemo(() => matchRows(groups), [groups]);
  const highlight = state.highlight < rows.length ? state.highlight : rows.length - 1;
  const highlighted = highlight >= 0 ? rows[highlight] : null;
  const sections = sectionCount(rows);
  const trimmed = state.query.trim();

  const setHighlight = (index: number) =>
    setState((prev) => (prev.highlight === index ? prev : { ...prev, highlight: index }));

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlight(stepHighlight(highlight, 1, rows.length));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlight(stepHighlight(highlight, -1, rows.length));
        break;
      case 'Home':
        if (rows.length > 0) {
          event.preventDefault();
          setHighlight(0);
        }
        break;
      case 'End':
        if (rows.length > 0) {
          event.preventDefault();
          setHighlight(rows.length - 1);
        }
        break;
      case 'Enter':
        if (highlighted) {
          event.preventDefault();
          select(highlighted.id);
        }
        break;
      default:
        break;
    }
  };

  // The highlighted row stays in view as the arrows move it; `nearest` is a
  // no-op while it is already visible, so a hover never scrolls the list.
  const highlightedId = highlighted ? optionId(highlighted) : null;
  useEffect(() => {
    if (!highlightedId) return;
    document.getElementById(highlightedId)?.scrollIntoView({ block: 'nearest' });
  }, [highlightedId]);
  // On open the list is centred on the current section (after the effect
  // above, so the centre wins the first frame).
  const currentRef = useCentreOnMount<HTMLLIElement>();

  return (
    <>
      <DialogTitle className="sr-only">Jump to a section</DialogTitle>
      <div className="flex shrink-0 items-center gap-3 border-b border-border/70 px-4">
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Section number or title"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={highlightedId ?? undefined}
          aria-autocomplete="list"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder="Section number or a word from its title"
          value={state.query}
          onChange={(event) => setState({ query: event.target.value, highlight: 0 })}
          onKeyDown={onKeyDown}
          className="h-13 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/80 md:h-12 md:text-[15px]"
        />
        {trimmed ? (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => {
              setState({ query: '', highlight: 0 });
              inputRef.current?.focus();
            }}
            className={cn(
              'v2-interactive flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
              FOCUS_RING,
            )}
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : (
          <DialogClose asChild>
            <button
              type="button"
              className={cn(
                'v2-interactive hidden h-6 items-center rounded-md border border-border px-1.5 font-mono text-[10px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:inline-flex',
                FOCUS_RING,
              )}
            >
              esc
              <span className="sr-only"> closes</span>
            </button>
          </DialogClose>
        )}
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label="Sections"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2"
      >
        {groups.length === 0 ? (
          <li role="presentation" className="px-3 py-10 text-center text-sm text-muted-foreground">
            <span role="status">Nothing matches “{trimmed}”.</span>
          </li>
        ) : null}
        {groups.map((group) => {
          const headingId = `${baseId}-${group.division.id}-heading`;
          const { num, title } = splitDivisionLabel(group.division.label);
          const headingRow = group.divisionMatched
            ? rows.find((row) => row.kind === 'division' && row.id === group.division.id)
            : undefined;
          return (
            <li key={group.division.id} role="presentation">
              <ul role="group" aria-labelledby={headingId} className="pb-1">
                {/* The Part's name holds at the top of its group as the list
                    scrolls, so a row is never read without its Part. */}
                <li
                  id={headingId}
                  role="presentation"
                  className="sticky top-0 z-10 flex items-baseline gap-2 bg-popover/95 px-3 pt-2 pb-1 backdrop-blur-sm"
                >
                  {num ? (
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/80">
                      {num}
                    </span>
                  ) : null}
                  <span className="min-w-0 truncate text-xs font-medium text-muted-foreground">
                    {title}
                  </span>
                </li>
                {headingRow ? (
                  <Option
                    id={optionId(headingRow)}
                    num={num ?? 'Part'}
                    title={title}
                    tag="start of this part"
                    locked={headingRow.locked}
                    isHighlighted={highlighted?.id === headingRow.id}
                    isCurrent={activeId === headingRow.id}
                    rowRef={activeId === headingRow.id ? currentRef : undefined}
                    onHover={() => setHighlight(rows.indexOf(headingRow))}
                    onSelect={() => select(headingRow.id)}
                  />
                ) : null}
                {group.sections.map((section) => {
                  const row = rows.find((candidate) => candidate.id === section.id);
                  if (!row) return null;
                  const split = splitSectionLabel(section.label);
                  return (
                    <Option
                      key={section.id}
                      id={optionId(row)}
                      num={split.num ?? ''}
                      title={split.title}
                      tag={null}
                      locked={row.locked}
                      isHighlighted={highlighted?.id === row.id}
                      isCurrent={activeId === row.id}
                      rowRef={activeId === row.id ? currentRef : undefined}
                      onHover={() => setHighlight(rows.indexOf(row))}
                      onSelect={() => select(row.id)}
                    />
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">
        <span className="tabular-nums">
          {trimmed
            ? `${rows.length} ${rows.length === 1 ? 'match' : 'matches'}`
            : `${sections} ${sections === 1 ? 'section' : 'sections'}`}
        </span>
        <span className="hidden items-center gap-3 md:flex" aria-hidden>
          <span className="flex items-center gap-1">
            <Key>↑</Key>
            <Key>↓</Key>
            move
          </span>
          <span className="flex items-center gap-1">
            <Key>
              <CornerDownLeft className="size-2.5" />
            </Key>
            jump
          </span>
        </span>
      </footer>
    </>
  );
}

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border px-1 font-sans text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

function Option({
  id,
  num,
  title,
  tag,
  locked,
  isHighlighted,
  isCurrent,
  rowRef,
  onHover,
  onSelect,
}: {
  id: string;
  num: string;
  title: string;
  tag: string | null;
  locked: boolean;
  isHighlighted: boolean;
  isCurrent: boolean;
  rowRef: RefObject<HTMLLIElement | null> | undefined;
  onHover: () => void;
  onSelect: () => void;
}) {
  return (
    <li
      id={id}
      ref={rowRef}
      role="option"
      aria-selected={isHighlighted}
      aria-current={isCurrent ? 'location' : undefined}
      data-highlighted={isHighlighted || undefined}
      onMouseMove={onHover}
      onClick={onSelect}
      className={cn(
        'v2-interactive flex cursor-pointer items-baseline gap-3 rounded-xl px-3 py-2 text-sm transition-colors data-[highlighted]:bg-secondary',
        isCurrent ? 'text-primary' : 'text-foreground',
      )}
    >
      <span
        className={cn(
          'w-10 shrink-0 text-right text-xs tabular-nums',
          isCurrent ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {num}
      </span>
      <span className={cn('min-w-0 flex-1 truncate', isCurrent && 'font-medium')}>{title}</span>
      {tag ? (
        <span className="shrink-0 text-[11px] text-muted-foreground">{tag}</span>
      ) : null}
      {isCurrent ? (
        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
          Here
        </span>
      ) : null}
      {locked ? <LockMark className="size-3.5 self-center" /> : null}
    </li>
  );
}
