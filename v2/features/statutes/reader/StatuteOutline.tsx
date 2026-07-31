'use client';

import { useEffect, useRef, useState } from 'react';
import { TableOfContents } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { V2_SHELL_CONTENT_ID } from '@/v2/shell/shell-content';
import type { AknOutlineDivision } from './akn';

/**
 * StatuteOutline — the reader's wayfinding, in the outline grammar the case
 * page established, extended one level for legislation's real shape:
 *
 *   ≥96rem   a "Contents" RAIL beside the column: the divisions (parts /
 *            chapters / schedules), with the ACTIVE division's sections
 *            expanded beneath it. A 719-node Act would be an unusable flat
 *            rail; divisions-always + sections-on-demand keeps the map the
 *            size of the territory you're in. (96rem is the first width the
 *            rail HONESTLY fits — the arithmetic, which must account for the
 *            shell's 256px sidebar, lives beside the aside in
 *            StatuteDocument.)
 *   <96rem   a floating "Contents" pill (sticky at the column's bottom edge)
 *            opening a Sheet with the full tree — the affordance the rail
 *            collapses into, on desktop widths below the threshold as well
 *            as on mobile.
 *
 * ── THE SPY ─────────────────────────────────────────────────────────────────
 * One IntersectionObserver, rooted at the SHELL SCROLLER (`#v2-shell-content`
 * — the v2 scroll container is that div, not the window; a viewport-rooted
 * band would measure against a box the content region only partly occupies).
 * A section is "current" while it crosses the upper reading band; several can
 * cross around short sections, so the first in document order wins, and
 * between sections the last answer holds rather than flickering to none.
 * Observed targets are the BLOCK WRAPPERS, which keep real geometry even
 * while `content-visibility: auto` skips their contents.
 *
 * Buttons, not hash links — jumping within one page is not a navigation, and
 * hash entries would stack history the Back button then chews through.
 * Jumps are INSTANT by design (not smooth): a contents jump in a statute
 * routinely travels dozens of screens, and animating that is disorienting
 * motion for its own sake — which also means there is nothing extra to still
 * under `prefers-reduced-motion`.
 */

export interface OutlineHandle {
  /** Everything the outline needs from the document host. */
  outline: AknOutlineDivision[];
  activeId: string | null;
  onJump: (id: string) => void;
}

/* ── The spy hook (owned by the document host, shared by rail + sheet) ───── */

/**
 * Track which anchored block is under the reading band. `version` bumps as
 * progressive mounting lands more blocks, so newly-mounted anchors join the
 * observation set (a handful of rebuilds per document, then it settles).
 */
export function useStatuteScrollSpy(ids: readonly string[], version: number): string | null {
  const [active, setActive] = useState<string | null>(null);
  const crossingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (ids.length === 0) return;
    const targets = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const root = document.getElementById(V2_SHELL_CONTENT_ID);

    // ONE answer function, shared by both signals below, so they can never
    // fight: AT THE BOTTOM of the scroller the LAST target wins — the reading
    // band sits in the upper quarter, so sections living in the final
    // screenful can otherwise never activate and the rail would highlight a
    // section screens above the reader at full scroll. Anywhere else, the
    // first band-crossing target in document order wins, and between targets
    // the last answer holds rather than flickering to none.
    const applyActive = () => {
      if (
        root &&
        root.scrollTop > 0 &&
        root.scrollTop + root.clientHeight >= root.scrollHeight - 4
      ) {
        setActive(ids[ids.length - 1]);
        return;
      }
      const current = ids.find((id) => crossingRef.current.has(id));
      if (current) setActive(current);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) crossingRef.current.add(entry.target.id);
          else crossingRef.current.delete(entry.target.id);
        }
        applyActive();
      },
      {
        root,
        // The reading band: the zone from 10% to 25% down the scroller.
        rootMargin: '-10% 0px -75% 0px',
      },
    );
    targets.forEach((el) => observer.observe(el));

    // The at-bottom check needs a scroll signal of its own: reaching the end
    // does not necessarily change any band intersection, so the observer
    // alone can go silent exactly where the fallback matters.
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        applyActive();
      });
    };
    root?.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      root?.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
    // `version` is the re-observe trigger: same ids, more of them mounted.
  }, [ids, version]);

  return active;
}

/** The division that owns `activeId` (itself, or one of its sections). */
function activeDivisionOf(
  outline: AknOutlineDivision[],
  activeId: string | null,
): string | null {
  if (!activeId) return outline[0]?.id ?? null;
  for (const division of outline) {
    if (division.id === activeId) return division.id;
    if (division.sections.some((section) => section.id === activeId)) {
      return division.id;
    }
  }
  return outline[0]?.id ?? null;
}

/* ── The wide-screen rail ────────────────────────────────────────────────── */

export function StatuteOutlineRail({ outline, activeId, onJump }: OutlineHandle) {
  const activeDivision = activeDivisionOf(outline, activeId);

  return (
    <nav
      aria-label="Contents"
      className="flex max-h-[calc(100dvh-6rem)] flex-col gap-2 overflow-y-auto pr-1"
    >
      <p className="doc-kicker">Contents</p>
      <ul className="flex flex-col border-l border-border/60">
        {outline.map((division) => {
          const isActiveDivision = activeDivision === division.id;
          const divisionCurrent = activeId === division.id;
          return (
            <li key={division.id} className="relative">
              {divisionCurrent ? <ActiveBar /> : null}
              <button
                type="button"
                onClick={() => onJump(division.id)}
                aria-current={divisionCurrent ? 'location' : undefined}
                className={cn(
                  'v2-interactive block w-full rounded-r-md py-1.5 pl-3.5 pr-2 text-left text-xs transition-colors',
                  isActiveDivision
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                  FOCUS_RING,
                )}
              >
                <span className="line-clamp-2">{division.label}</span>
              </button>

              {/* The active division's sections, expanded in place. Quiet
                  ease-in; the collapse is instant (nothing to watch leave). */}
              {isActiveDivision && division.sections.length > 0 ? (
                <ul className="flex flex-col pb-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
                  {division.sections.map((section) => {
                    const sectionCurrent = activeId === section.id;
                    return (
                      <li key={section.id} className="relative">
                        {sectionCurrent ? <ActiveBar /> : null}
                        <button
                          type="button"
                          onClick={() => onJump(section.id)}
                          aria-current={sectionCurrent ? 'location' : undefined}
                          className={cn(
                            'v2-interactive block w-full rounded-r-md py-1 pl-6 pr-2 text-left text-[11px] leading-snug transition-colors',
                            sectionCurrent
                              ? 'font-medium text-foreground'
                              : 'text-muted-foreground/80 hover:text-foreground',
                            FOCUS_RING,
                          )}
                        >
                          <span className="line-clamp-2">{section.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function ActiveBar() {
  return (
    <span
      aria-hidden
      className="absolute inset-y-1 -left-px w-0.5 rounded-full bg-primary"
    />
  );
}

/* ── The mobile affordance: floating pill + full-tree sheet ──────────────── */

export function StatuteContentsSheet({ outline, activeId, onJump }: OutlineHandle) {
  const [open, setOpen] = useState(false);
  const activeDivision = activeDivisionOf(outline, activeId);
  // The full tree is long; when the sheet opens, start the reader at the
  // division they are currently inside rather than at Part I.
  const activeRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    if (!open) return;
    // One frame so the sheet's content exists and has height.
    const frame = requestAnimationFrame(() => {
      activeRef.current?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const select = (id: string) => {
    setOpen(false);
    onJump(id);
  };

  return (
    <>
      {/* Sticky at the column's bottom edge (the CaseAskDock mechanic), so
          the map is one thumb-reach away for the whole read. Hidden at
          ≥96rem, where the rail takes over — the SAME threshold the rail
          computes from sidebar + column + gutter + rail widths (see the
          arithmetic in StatuteDocument), so the handoff is truthful: at
          every width exactly one contents affordance exists. */}
      <div className="pointer-events-none sticky bottom-6 z-10 -mx-1 flex justify-end min-[96rem]:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'v2-interactive pointer-events-auto inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-background/95 px-4 text-sm font-medium text-foreground shadow-lg backdrop-blur transition-colors hover:bg-secondary',
            FOCUS_RING,
          )}
        >
          <TableOfContents aria-hidden className="size-4" />
          Contents
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-sm">
          {/* px-7 (28px) aligns the TITLE'S text with the ENTRIES' text —
              nav px-4 (16px) + item button px-3 (12px) = 28px. The list's
              visible left rhythm is its text (item boxes only surface on
              hover), so text-to-text is the honest alignment. */}
          <SheetHeader className="px-7 pb-2">
            <SheetTitle>Contents</SheetTitle>
          </SheetHeader>
          <nav aria-label="Contents" className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            <ul className="flex flex-col gap-0.5">
              {outline.map((division) => (
                <li
                  key={division.id}
                  ref={activeDivision === division.id ? activeRef : undefined}
                >
                  <button
                    type="button"
                    onClick={() => select(division.id)}
                    aria-current={activeId === division.id ? 'location' : undefined}
                    className={cn(
                      'v2-interactive block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-secondary',
                      activeId === division.id
                        ? 'font-medium text-primary'
                        : 'text-foreground',
                      FOCUS_RING,
                    )}
                  >
                    {division.label}
                  </button>
                  {division.sections.length > 0 ? (
                    <ul className="flex flex-col gap-0.5 pb-1">
                      {division.sections.map((section) => (
                        <li key={section.id}>
                          <button
                            type="button"
                            onClick={() => select(section.id)}
                            aria-current={
                              activeId === section.id ? 'location' : undefined
                            }
                            className={cn(
                              'v2-interactive block w-full rounded-lg py-1.5 pl-7 pr-3 text-left text-[13px] leading-snug transition-colors hover:bg-secondary',
                              activeId === section.id
                                ? 'font-medium text-primary'
                                : 'text-muted-foreground',
                              FOCUS_RING,
                            )}
                          >
                            {section.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
