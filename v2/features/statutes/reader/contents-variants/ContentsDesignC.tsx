'use client';

import { useId, type RefObject } from 'react';
import { XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
  DialogSurface,
  DialogTitle,
} from '@/components/ui/dialog';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import type { AknOutlineDivision, AknOutlineSection } from '../akn';
import { LockMark } from '../StatuteOutline';
import { outlinePosition, splitDivisionLabel, splitSectionLabel } from './contents-model';
import {
  DIVISION_PAD,
  focusCurrentOnOpen,
  nestingLevel,
  useCentreOnMount,
  type ContentsDesignProps,
} from './shared';

/**
 * Contents design C, "printed contents" (`?contents=c`; finding 10,
 * prototype).
 *
 * The table of contents of a printed Act, set in the reader's serif
 * (Fraunces, the document's own voice): each Part's name in small capitals
 * with its number in the label colour, then its sections as rows with the
 * title on the left, a dotted leader, and the section number right-aligned
 * in a tabular column, the way a page number sits in a book. The current
 * section carries a soft band and a mark in the margin, and the list opens
 * on it.
 *
 * On a COMPUTER it is a full-height panel on the RIGHT edge, the opposite
 * side from the sheet Stay turned down, beside the column it indexes. On a
 * PHONE it drops down from the top of the screen, under the bar the button
 * is in, and stops at about 85% of the height with the page showing beneath
 * it; one element whose classes change at `md:`, no JS breakpoint.
 */

const PANEL =
  'fixed inset-x-0 top-0 z-50 flex max-h-[min(85dvh,calc(100dvh-3rem))] flex-col overflow-hidden rounded-b-[1.75rem] bg-popover pt-[env(safe-area-inset-top,0px)] text-sm shadow-2xl ring-1 ring-foreground/5 outline-none';

const PANEL_DESKTOP =
  'md:inset-x-auto md:inset-y-0 md:right-0 md:h-full md:max-h-none md:w-[26rem] md:rounded-none md:border-l md:border-border/60 md:pt-0 md:shadow-xl md:ring-0';

/** Drops from the top on a phone; slides in from the right edge on a
 *  computer, with the phone's vertical travel reset there. */
const PANEL_MOTION =
  'data-open:animate-in data-closed:animate-out data-open:fade-in-0 data-closed:fade-out-0 data-open:slide-in-from-top-6 data-closed:slide-out-to-top-6 md:data-open:slide-in-from-top-0 md:data-closed:slide-out-to-top-0 md:data-open:slide-in-from-right-6 md:data-closed:slide-out-to-right-6 duration-300 ease-out';

/** The serif the document reads in, so the contents read as its own page. */
const SERIF = "font-fraunces [font-variation-settings:'SOFT'_20,'WONK'_0,'opsz'_14]";

export function ContentsDesignC({
  outline,
  activeId,
  onJump,
  open,
  onOpenChange,
}: ContentsDesignProps) {
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
          onOpenAutoFocus={focusCurrentOnOpen}
        >
          <PrintedContents outline={outline} activeId={activeId} select={select} />
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-[calc(env(safe-area-inset-top,0px)+1rem)] right-4 rounded-full text-muted-foreground md:top-6"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </DialogSurface>
      </DialogPortal>
    </Dialog>
  );
}

/* ── The body ────────────────────────────────────────────────────────────── */

function PrintedContents({
  outline,
  activeId,
  select,
}: {
  outline: AknOutlineDivision[];
  activeId: string | null;
  select: (id: string) => void;
}) {
  const position = outlinePosition(outline, activeId);
  const sections = outline.reduce((count, division) => count + division.sections.length, 0);
  const parts = outline.filter((division) => division.sections.length > 0).length;
  const currentRef = useCentreOnMount<HTMLLIElement>();

  return (
    <>
      <header className="shrink-0 px-7 pt-5 pb-3 md:pt-7">
        <DialogTitle
          className={cn(
            SERIF,
            'text-[1.625rem] leading-none font-semibold tracking-tight text-foreground',
          )}
        >
          Contents
        </DialogTitle>
        <p className="mt-2 text-xs tabular-nums text-muted-foreground">
          {sections > 0 ? `${sections} sections` : null}
          {sections > 0 && parts > 1 ? ` in ${parts} parts` : null}
          {position.total > 0 ? ` · ${Math.round(position.fraction * 100)}% read` : null}
        </p>
        <hr className="mt-4 border-foreground/15" />
      </header>

      <nav
        aria-label="Contents"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-10"
      >
        {outline.map((division) => (
          <PrintedDivision
            key={division.id}
            division={division}
            activeId={activeId}
            currentRef={currentRef}
            select={select}
          />
        ))}
      </nav>
    </>
  );
}

function PrintedDivision({
  division,
  activeId,
  currentRef,
  select,
}: {
  division: AknOutlineDivision;
  activeId: string | null;
  currentRef: RefObject<HTMLLIElement | null>;
  select: (id: string) => void;
}) {
  const headingId = useId();
  const { num, title } = splitDivisionLabel(division.label);
  const isCurrent = activeId === division.id;
  const flat = division.sections.length === 0;

  return (
    <section
      aria-labelledby={headingId}
      className={cn('mt-5 first:mt-2', DIVISION_PAD[nestingLevel(division.depth)])}
    >
      {/* The Part's name is also the way to its start. A flat act's entries
          (sections with no Part over them) are set as rows instead. */}
      {flat ? (
        <ul>
          <li ref={isCurrent ? currentRef : undefined}>
            <Row
              label={division.label}
              locked={division.locked ?? false}
              isCurrent={isCurrent}
              onSelect={() => select(division.id)}
            />
          </li>
        </ul>
      ) : (
        <>
          <h3 id={headingId} className="px-2">
            <button
              type="button"
              onClick={() => select(division.id)}
              aria-current={isCurrent ? 'location' : undefined}
              className={cn(
                'v2-interactive -mx-2 flex w-[calc(100%+1rem)] items-baseline gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-secondary/70',
                FOCUS_RING,
              )}
            >
              {num ? (
                <span
                  className={cn(
                    'shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em]',
                    isCurrent ? 'text-primary' : 'text-primary/85',
                  )}
                >
                  {num}
                </span>
              ) : null}
              <span
                className={cn(
                  SERIF,
                  'min-w-0 flex-1 text-[15px] leading-snug font-semibold tracking-[0.04em] [font-variant-caps:all-small-caps]',
                  isCurrent ? 'text-primary' : 'text-foreground',
                )}
              >
                {title}
              </span>
              {division.locked ? <LockMark className="size-3.5 self-center" /> : null}
            </button>
          </h3>
          <ul className="mt-0.5">
            {division.sections.map((section) => (
              <PrintedSection
                key={section.id}
                section={section}
                isCurrent={activeId === section.id}
                rowRef={activeId === section.id ? currentRef : undefined}
                select={select}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function PrintedSection({
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
  return (
    <li ref={rowRef}>
      <Row
        label={section.label}
        locked={section.locked ?? false}
        isCurrent={isCurrent}
        onSelect={() => select(section.id)}
      />
    </li>
  );
}

/**
 * One line of the printed table: title, dotted leader, number on the right.
 * The leader is a bordered span lifted to the baseline; the title may wrap
 * to a second line, and the leader then runs from the end of its last line.
 */
function Row({
  label,
  locked,
  isCurrent,
  onSelect,
}: {
  label: string;
  locked: boolean;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  const { num, title } = splitSectionLabel(label);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isCurrent ? 'location' : undefined}
      className={cn(
        SERIF,
        'v2-interactive relative flex w-full items-baseline gap-2 rounded-md px-2 py-[5px] text-left text-[15px] leading-snug transition-colors hover:bg-secondary/70',
        isCurrent &&
          'bg-primary/8 text-primary before:absolute before:top-1/2 before:-left-2.5 before:size-1.5 before:-translate-y-1/2 before:rounded-full before:bg-primary',
        FOCUS_RING,
      )}
    >
      <span className={cn('min-w-0 shrink', isCurrent ? 'font-medium' : 'text-foreground/90')}>
        {title}
      </span>
      <span
        aria-hidden
        className={cn(
          'mb-[0.35em] min-w-4 flex-1 self-end border-b border-dotted',
          isCurrent ? 'border-primary/50' : 'border-foreground/35',
        )}
      />
      {num ? (
        <span
          className={cn(
            'shrink-0 text-[13px] tabular-nums',
            isCurrent ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {num}
        </span>
      ) : null}
      {locked ? <LockMark className="size-3.5 self-center" /> : null}
    </button>
  );
}
