'use client';

import { useRef, type ReactNode } from 'react';
import { ChevronLeft, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogSurface,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * ResponsiveOverlay — a full screen on a phone, the familiar centred card on a
 * desktop, from one element.
 *
 * Mobile overhaul phase 7. The long forms in this app were centred boxes at
 * every width: inset 16px on each side, floating over a page you can still half
 * see, with a scroll region inside a scroll region. `DialogContent` caps its own
 * height and scrolls (added 7 August after Arthur photographed a ~1,115px space
 * form on a 360px phone with Save, Cancel and the close X all off-screen at
 * once), so the primary action is REACHABLE. Reachable is not the same as right.
 *
 * ── WHY THIS IS NOT A ROUTE ────────────────────────────────────────────────
 * The main plan said these become routed screens. They do not need to be, and
 * the reason is worth keeping: every one of them is already bound to
 * `useUrlOverlay`, which pushes exactly one stamped history entry on open and
 * pops its own entry on close. Hardware Back already closes them, and after
 * phase 6 so does the edge swipe, because the edge swipe IS hardware Back.
 *
 * A real route would add a path the reader cannot see, twelve route files,
 * twelve loading boundaries for phase 8 to write, and a second mechanism doing
 * the job the first one already does — with two ways for them to disagree. The
 * gap was never routing. It was geometry.
 *
 * ── ONE ELEMENT, TWO SHAPES, NO JAVASCRIPT BREAKPOINT ──────────────────────
 * The shape changes at `md:` in CSS, and there is deliberately no
 * `useMediaQuery` anywhere near it:
 *
 *  - A JS breakpoint has no answer during the server render, so the first paint
 *    is a guess and the correction is a visible flash.
 *  - Swapping between two different Content elements on resize REMOUNTS the
 *    subtree, which throws away every keystroke already typed into the form.
 *    A phone rotating from portrait to landscape crosses 48rem.
 *
 * One element whose classes change is free of both, at the cost of two shapes
 * living in one class list. They are labelled below.
 *
 * ── IT COMPOSES `DialogSurface`, NOT `DialogContent` ───────────────────────
 * `DialogSurface` is the Radix machinery — focus trap, Escape, `aria-modal`,
 * the dismissable layer — with no geometry of its own, which is exactly what a
 * second geometry needs. Reaching the same shape through `DialogContent`'s
 * `className` would mean unpicking `grid`, `gap-6`, `p-6`, `rounded-4xl`, two
 * `max-w` breakpoints, `top-1/2 left-1/2` and both translates, one conflicting
 * utility at a time: a chain that reads as correct and silently stops being it
 * the day the card is re-tuned. `components/ui` is not touched, so v1 ships
 * unchanged.
 *
 * ── THREE THINGS THAT MUST NOT BE "TIDIED" ─────────────────────────────────
 * 1. `Dialog open={open}` IS ALWAYS RENDERED. Returning `null` while closed
 *    looks like an optimisation and kills Radix Presence, so the overlay would
 *    vanish in one frame instead of playing its exit. The house motion rule
 *    forbids anything appearing or disappearing abruptly.
 * 2. `DialogOverlay` STAYS EVEN ON A PHONE, where it is invisible behind an
 *    opaque full-screen surface. It is what carries the scroll lock; a surface
 *    portalled without one does not have one, and the page behind scrolls.
 * 3. THE PHONE HEIGHT IS `dvh` MINUS `--keyboard-inset`, NOT `inset-0`. The two
 *    platforms hide the bottom of the screen differently and only one is
 *    visible to CSS lengths: Android resizes the layout viewport, so `dvh`
 *    tracks the keyboard by itself and the inset is 0; iOS OVERLAYS it, the
 *    viewport never changes, and `--keyboard-inset` (published by
 *    `v2/shell/use-keyboard-inset.ts`) is the only number that knows. Pinned to
 *    `bottom-0` the footer sits behind the iOS keyboard, which is where the
 *    Save button lives.
 */

/**
 * Phone: pinned to the top edge, full width, as tall as the visible viewport.
 * `left-0 right-0` rather than `inset-x-0` so the desktop override below is one
 * plain property against another and does not depend on how a shorthand and its
 * longhand happen to be ordered.
 */
const SURFACE_PHONE =
  'fixed left-0 right-0 top-0 z-50 flex h-[calc(100dvh-var(--keyboard-inset,0px))] flex-col bg-background text-sm outline-none';

/**
 * Desktop: the centred card, geometry matched to `DialogContent` so a converted
 * dialog looks the same as it did on the surface nobody is watching. The
 * default width is `md:max-w-lg`; a caller that needs another passes it and
 * tailwind-merge replaces this one.
 */
const SURFACE_DESKTOP =
  'md:left-1/2 md:right-auto md:top-[calc(50%-var(--keyboard-inset,0px)/2)] md:h-auto md:max-h-[calc(100dvh-4rem-var(--keyboard-inset,0px))] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:overflow-hidden md:rounded-4xl md:shadow-lg md:ring-1 md:ring-foreground/5';

/**
 * Phone rises from the bottom edge; desktop keeps the card's zoom. The `md:`
 * reset of the slide is required — without it the card would arrive translated.
 */
const SURFACE_MOTION =
  'data-open:animate-in data-closed:animate-out data-open:fade-in-0 data-closed:fade-out-0 data-open:slide-in-from-bottom-10 data-closed:slide-out-to-bottom-10 duration-200 md:duration-150 md:data-open:slide-in-from-bottom-0 md:data-closed:slide-out-to-bottom-0 md:data-open:zoom-in-95 md:data-closed:zoom-out-95';

export function ResponsiveOverlay({
  open,
  onOpenChange,
  title,
  description,
  action,
  footer,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Required: it renders as `DialogTitle`, which is what names the dialog for a
   * screen reader. A dialog without one is unlabelled and Radix says so.
   */
  title: ReactNode;
  /** Renders under the title. Optional; when absent, `aria-describedby` is
   *  explicitly cleared so Radix does not warn about a description it will
   *  never find. */
  description?: ReactNode;
  /** One control on the trailing edge of the phone bar — a Save, usually. On a
   *  desktop the footer already carries it, so this is phone-only. */
  action?: ReactNode;
  /** The button row. Full-width stacked on a phone, right-aligned on a desktop.
   *  Omitted entirely rather than rendered empty when there is nothing in it. */
  footer?: ReactNode;
  /** Desktop width, and nothing else — the phone shape is always full screen. */
  className?: string;
  children: ReactNode;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogSurface
          ref={surfaceRef}
          className={cn(SURFACE_PHONE, SURFACE_DESKTOP, SURFACE_MOTION, className)}
          /* ── A FORM SCREEN OPENS WITH NOTHING FOCUSED ──────────────────
             Radix focuses the first focusable element on open. In a card that
             is the first field, which is what a desktop wants. In this shape
             the first focusable is the BACK CHEVRON, because a phone bar puts
             it on the leading edge — so a reader opening a form to fill it in
             arrives with the Close button lit, and a screen reader announces
             the way out before the thing itself. Filmed on 2026-08-14.

             So on a phone the auto-focus is declined and focus is placed on
             the surface: nothing is lit, no keyboard springs up uninvited, and
             the reader taps the field they actually want — which is what a
             native form screen does. Above `md:` Radix's own behaviour stands
             and the first field is focused exactly as before.

             READING `matchMedia` HERE IS NOT A RENDER-TIME BREAKPOINT. It runs
             once, in an event, after mount. There is no server answer to get
             wrong, no hydration to diverge, and no remount if the window is
             later resized — by then the focus has long since happened. That is
             the whole reason the shape itself is CSS and only this is not. */
          onOpenAutoFocus={(event) => {
            if (!window.matchMedia('(max-width: 47.999rem)').matches) return;
            event.preventDefault();
            surfaceRef.current?.focus();
          }}
          /* THE SPREAD IS THE POINT, not a ternary returning `undefined`.
             Radix points `aria-describedby` at the id its own
             `DialogDescription` will carry, then warns if nothing ever renders
             one. Passing the attribute EXPLICITLY as `undefined` is how a
             caller says "there is no description" — and in a JSX spread an
             explicit `undefined` overrides the value beneath it, which is
             exactly what removes the attribute. So when there IS a description
             nothing may be passed at all, or the linkage Radix just made would
             be undone by the act of silencing a warning that was not firing. */
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          {/* ── THE BAR, WHICH IS ALSO THE TITLE BLOCK ────────────────────
              On a phone this is the screen's own bar: back on the leading
              edge, the name, one optional action. It pads itself out of the
              notch, because a full-screen surface starts under it.

              On a desktop the row loses its back chevron and its fixed height
              and becomes the title block the card has always had, with the
              close X in the corner. Same DOM, so the `DialogTitle` is rendered
              ONCE — two of them would share one Radix-provided id. */}
          <header className="shrink-0 border-b bg-background pt-[env(safe-area-inset-top,0px)] md:border-b-0 md:pt-6 md:pb-4">
            <div className="flex h-14 items-center gap-2 px-2 md:h-auto md:px-6 md:pr-12">
              <DialogClose asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className={cn(
                    'v2-interactive -ml-1 flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground md:hidden',
                    FOCUS_RING,
                  )}
                >
                  <ChevronLeft aria-hidden className="size-5" />
                </button>
              </DialogClose>

              <DialogTitle className="min-w-0 flex-1 truncate text-base leading-none font-medium md:whitespace-normal">
                {title}
              </DialogTitle>

              {action ? (
                <div className="shrink-0 md:hidden">{action}</div>
              ) : null}
            </div>

            {description ? (
              <DialogDescription className="px-4 pb-3 md:px-6 md:pt-2 md:pb-0">
                {description}
              </DialogDescription>
            ) : null}
          </header>

          {/* `overscroll-contain` for the same reason phase 6 put it on every
              horizontal scroller: without it a flick past the end of the form
              scrolls whatever is behind. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-6 md:px-6 md:pt-0 md:pb-6">
            {children}
          </div>

          {footer ? (
            /* Stacked and full width on a phone, which is where a thumb is, and
               padded out of the home indicator. `flex-col-reverse` puts the
               LAST child on top, so callers pass Cancel then the primary action
               and get the right order on both shapes — the same contract
               `DialogFooter` already has. */
            <footer className="flex shrink-0 flex-col-reverse gap-2 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:flex-row md:justify-end md:px-6 md:py-4 md:pb-4">
              {footer}
            </footer>
          ) : null}

          {/* Desktop only: the phone has its back chevron. */}
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-4 right-4 hidden md:inline-flex"
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
