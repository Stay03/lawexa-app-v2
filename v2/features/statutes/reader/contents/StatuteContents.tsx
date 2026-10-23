'use client';

import { useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
  DialogSurface,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { SCREEN_BAR_ACTION_ID } from '@/v2/shell/screen-context';
import { useSheetSide } from '@/v2/features/cases/cited-by/use-sheet-side';
import type { AknOutlineDivision, AknOutlineSection } from '../akn';
import { LockMark } from '../StatuteOutline';
import {
  outlinePosition,
  owningDivisionOf,
  splitDivisionLabel,
  splitSectionLabel,
} from './contents-model';
import {
  DIVISION_PAD,
  focusCurrentOnOpen,
  nestingLevel,
  useCentreOnMount,
  type StatuteContentsProps,
} from './shared';

/**
 * StatuteContents — a statute's Contents, design A, "where you are" (finding
 * 10; Stay, 23 October 2026: "Let's see A push that"). It replaced the left
 * sheet, and the two other designs filmed beside it are gone.
 *
 * A compact panel that opens on the Part the reader is in, with the other
 * Parts folded to one row each, and a progress line across the top that
 * shows how far through the statute they are. On a PHONE it is a floating
 * sheet on the bottom edge (the One UI shape the owner asked for on 19
 * September 2026, rounded on all four corners and lifted off the edge); on a
 * COMPUTER it hangs from the bar's Contents button as a popover, so the
 * panel opens where the reader just clicked and the page stays visible
 * around it.
 *
 * ── WHY TWO PRIMITIVES ─────────────────────────────────────────────────────
 * A popover is the wrong thing on a phone (it would cover the bar and clip
 * at the screen's edge) and a modal sheet is the wrong thing beside a
 * button on a computer. The choice is a JS value (`useSheetSide`, the same
 * hook the case page's "See all" panel uses) because only one of the two may
 * hold focus. The server answer is never painted: the body mounts only when
 * the reader opens the panel, which is always on the client.
 *
 * The popover anchors to the bar button by its id (`SCREEN_BAR_ACTION_ID`)
 * through a virtual anchor measured when Radix positions the content, never
 * during render. The button is in the shell's bar, not in this tree, so a
 * real `PopoverTrigger` cannot wrap it.
 */

/* The phone sheet: inset on three sides, rounded on four corners, as tall as
 * what is in it up to about two thirds of the screen. `bg-popover` rather
 * than `bg-background`, because in dark mode elevation reads as lighter
 * (ResponsiveOverlay's note of 19 September 2026). */
const PHONE_SHEET =
  'fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-50 flex max-h-[min(72dvh,40rem)] flex-col overflow-hidden rounded-3xl bg-popover text-sm shadow-2xl ring-1 ring-foreground/5 outline-none';

const PHONE_MOTION =
  'data-open:animate-in data-closed:animate-out data-open:fade-in-0 data-closed:fade-out-0 data-open:slide-in-from-bottom-8 data-closed:slide-out-to-bottom-8 duration-300 ease-out';

/** The computer popover: the primitive's padding and gap are replaced, the
 *  body owns its own rhythm. */
const POPOVER =
  'flex w-[22rem] flex-col gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl ring-1 ring-foreground/10';

export function StatuteContents({
  outline,
  activeId,
  onJump,
  open,
  onOpenChange,
}: StatuteContentsProps) {
  const side = useSheetSide();
  const titleId = useId();
  // Measured by Radix when it positions the content, after mount; nothing
  // here reads the document during render.
  const anchorRef = useRef<{ getBoundingClientRect: () => DOMRect }>({
    getBoundingClientRect: () =>
      document.getElementById(SCREEN_BAR_ACTION_ID)?.getBoundingClientRect() ??
      new DOMRect(window.innerWidth - 12, 56, 0, 0),
  });

  const select = (id: string) => {
    onOpenChange(false);
    onJump(id);
  };

  if (side === 'bottom') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPortal>
          <DialogOverlay className="bg-black/40" />
          <DialogSurface
            className={cn(PHONE_SHEET, PHONE_MOTION)}
            aria-describedby={undefined}
            onOpenAutoFocus={focusCurrentOnOpen}
          >
            <div
              aria-hidden
              className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-foreground/15"
            />
            <WhereYouAre
              outline={outline}
              activeId={activeId}
              select={select}
              heading={
                <DialogTitle className="text-[15px] font-semibold tracking-tight">
                  Contents
                </DialogTitle>
              }
            />
          </DialogSurface>
        </DialogPortal>
      </Dialog>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal>
      <PopoverAnchor virtualRef={anchorRef} />
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        aria-labelledby={titleId}
        onOpenAutoFocus={focusCurrentOnOpen}
        className={POPOVER}
      >
        <WhereYouAre
          outline={outline}
          activeId={activeId}
          select={select}
          heading={
            <h2 id={titleId} className="text-[15px] font-semibold tracking-tight">
              Contents
            </h2>
          }
        />
      </PopoverContent>
    </Popover>
  );
}

/* ── The body, shared by both shapes ─────────────────────────────────────── */

function WhereYouAre({
  outline,
  activeId,
  select,
  heading,
}: {
  outline: AknOutlineDivision[];
  activeId: string | null;
  select: (id: string) => void;
  heading: ReactNode;
}) {
  const position = outlinePosition(outline, activeId);
  const owning = owningDivisionOf(outline, activeId);
  const owningLabel = outline.find((division) => division.id === owning)?.label ?? null;
  // The body mounts per open, so the initial fold is the reader's current
  // Part at that moment; the rest is theirs to open.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(owning ? [owning] : []),
  );
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // The row to centre on open: the active section, or the active Part.
  const currentId = activeId ?? owning;
  const currentRef = useCentreOnMount<HTMLLIElement>();
  const percent = Math.round(position.fraction * 100);

  return (
    <>
      <header className="shrink-0 px-5 pt-3 pb-3">
        <div className="flex items-baseline justify-between gap-3">
          {heading}
          {position.total > 0 ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {percent}% through
            </span>
          ) : null}
        </div>
        <ProgressLine fraction={position.fraction} />
        {owningLabel ? (
          <p className="mt-2 truncate text-xs text-muted-foreground">
            You are in <span className="text-foreground">{owningLabel}</span>
          </p>
        ) : null}
      </header>

      <nav
        aria-label="Contents"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
      >
        <ul className="flex flex-col gap-0.5">
          {outline.map((division) => (
            <DivisionFold
              key={division.id}
              division={division}
              activeId={activeId}
              currentId={currentId}
              currentRef={currentRef}
              isOpen={expanded.has(division.id)}
              onToggle={() => toggle(division.id)}
              select={select}
            />
          ))}
        </ul>
      </nav>
    </>
  );
}

/** A thin track with the read part filled and a dot where the reader is. */
function ProgressLine({ fraction }: { fraction: number }) {
  const percent = Math.round(fraction * 100);
  return (
    <div
      role="progressbar"
      aria-label="How far through the statute you are"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="relative mt-3 h-[3px] w-full rounded-full bg-border"
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
        style={{ width: `${percent}%` }}
      />
      <span
        aria-hidden
        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-popover transition-[left] duration-300 ease-out"
        style={{ left: `${percent}%` }}
      />
    </div>
  );
}

function DivisionFold({
  division,
  activeId,
  currentId,
  currentRef,
  isOpen,
  onToggle,
  select,
}: {
  division: AknOutlineDivision;
  activeId: string | null;
  currentId: string | null;
  currentRef: RefObject<HTMLLIElement | null>;
  isOpen: boolean;
  onToggle: () => void;
  select: (id: string) => void;
}) {
  const listId = useId();
  const { num, title } = splitDivisionLabel(division.label);
  const isCurrent = activeId === division.id;
  const hasSections = division.sections.length > 0;
  const showsSections = isOpen && hasSections;

  return (
    <li
      ref={currentId === division.id && !showsSections ? currentRef : undefined}
      className={DIVISION_PAD[nestingLevel(division.depth)]}
    >
      <div
        className={cn(
          'flex items-center rounded-xl transition-colors',
          showsSections && 'bg-secondary/60',
        )}
      >
        <button
          type="button"
          onClick={() => select(division.id)}
          aria-current={isCurrent ? 'location' : undefined}
          className={cn(
            'v2-interactive flex min-w-0 flex-1 items-baseline gap-2 rounded-xl py-2.5 pr-1 pl-3 text-left transition-colors hover:bg-secondary',
            FOCUS_RING,
          )}
        >
          {num ? (
            <span
              className={cn(
                'shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em]',
                isCurrent ? 'text-primary' : 'text-primary/80',
              )}
            >
              {num}
            </span>
          ) : null}
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-sm',
              isCurrent ? 'font-semibold text-primary' : 'font-medium text-foreground',
            )}
          >
            {title}
          </span>
          {division.locked ? <LockMark className="size-3.5 self-center" /> : null}
        </button>
        {hasSections ? (
          <>
            {!isOpen ? (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {division.sections.length}
              </span>
            ) : null}
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isOpen}
              aria-controls={listId}
              aria-label={`${isOpen ? 'Fold' : 'Unfold'} ${division.label}`}
              className={cn(
                'v2-interactive mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                FOCUS_RING,
              )}
            >
              <ChevronDown
                aria-hidden
                className={cn(
                  'size-4 transition-transform duration-200 ease-out',
                  isOpen && 'rotate-180',
                )}
              />
            </button>
          </>
        ) : null}
      </div>

      {showsSections ? (
        <ul
          id={listId}
          className="flex flex-col py-1 pl-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200"
        >
          {division.sections.map((section) => (
            <SectionRow
              key={section.id}
              section={section}
              isCurrent={activeId === section.id}
              rowRef={currentId === section.id ? currentRef : undefined}
              select={select}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function SectionRow({
  section,
  isCurrent,
  rowRef,
  select,
}: {
  section: AknOutlineSection;
  isCurrent: boolean;
  rowRef: RefObject<HTMLLIElement | null> | undefined;
  select: (id: string) => void;
}) {
  const { num, title } = splitSectionLabel(section.label);
  return (
    <li ref={rowRef}>
      <button
        type="button"
        onClick={() => select(section.id)}
        aria-current={isCurrent ? 'location' : undefined}
        className={cn(
          'v2-interactive flex w-full items-baseline gap-3 rounded-lg py-1.5 pr-3 pl-3 text-left text-[13px] leading-snug transition-colors hover:bg-secondary',
          isCurrent ? 'font-medium text-primary' : 'text-foreground/85',
          FOCUS_RING,
        )}
      >
        <span
          className={cn(
            'w-8 shrink-0 text-right text-xs tabular-nums',
            isCurrent ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {num ?? ''}
        </span>
        <span className="min-w-0 flex-1">{title}</span>
        {isCurrent ? (
          <span aria-hidden className="size-1.5 shrink-0 self-center rounded-full bg-primary" />
        ) : null}
        {section.locked ? <LockMark className="size-3.5 self-center" /> : null}
      </button>
    </li>
  );
}
