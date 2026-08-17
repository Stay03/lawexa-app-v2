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
 * Phone, sized to what is IN it: a sheet on the bottom edge rather than a whole
 * screen.
 *
 * ── WHY THERE ARE TWO PHONE SHAPES ─────────────────────────────────────────
 * The owner, 17 August 2026, on a panel holding one username: "is this not
 * wasted space and unaesthetic design?" He was right. A full screen is the
 * correct answer for a list of 250 countries, and the wrong one for a single
 * line of text — it leaves most of the screen empty with the confirm button
 * stranded a long way from the field it belongs to.
 *
 * So the shape follows the content instead of being fixed. `fill` stays the
 * default because it is what a long list needs and what every existing caller
 * already expects.
 *
 * THE BOTTOM EDGE IS THE KEYBOARD'S, NOT THE VIEWPORT'S. `bottom` is the
 * keyboard inset rather than 0, for the same reason the shell subtracts it: an
 * engine that OVERLAYS the keyboard leaves the visual viewport short while
 * `100dvh` stays full, and a sheet pinned to a literal 0 would sit behind the
 * keys — which is precisely the sheet a reader is trying to type into. On an
 * engine that resizes instead, the inset is 0 and this reads as `bottom-0`.
 *
 * The cap keeps a long-but-not-endless body honest: at `max-h` the header and
 * footer stay put and the middle scrolls, because they are `shrink-0` around a
 * `min-h-0 flex-1` region that was already built to do exactly that.
 */
const SURFACE_PHONE_CONTENT =
  'fixed left-0 right-0 bottom-[var(--keyboard-inset,0px)] z-50 flex max-h-[calc(100dvh-var(--keyboard-inset,0px)-2rem)] flex-col overflow-hidden rounded-t-3xl bg-background text-sm outline-none';

/**
 * Desktop: the centred card, geometry matched to `DialogContent` so a converted
 * dialog looks the same as it did on the surface nobody is watching. The
 * default width is `md:max-w-lg`; a caller that needs another passes it and
 * tailwind-merge replaces this one.
 */
const SURFACE_DESKTOP =
  'md:left-1/2 md:right-auto md:bottom-auto md:top-[calc(50%-var(--keyboard-inset,0px)/2)] md:h-auto md:max-h-[calc(100dvh-4rem-var(--keyboard-inset,0px))] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:overflow-hidden md:rounded-4xl md:shadow-lg md:ring-1 md:ring-foreground/5';

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
  size = 'fill',
  guardUnsaved = false,
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
  /** Desktop width, and nothing else — the phone shape comes from `size`. */
  className?: string;
  /**
   * How tall the PHONE shape is. `fill` is a whole screen, which is what a long
   * list wants and what every caller before 17 August 2026 assumed. `content`
   * is a sheet on the bottom edge, as tall as what is inside it, for a surface
   * holding one control. The desktop card is unaffected either way — it has
   * always sized to its content.
   */
  size?: 'fill' | 'content';
  /**
   * Refuse to close on a tap OUTSIDE, because there is unsaved typing in here.
   *
   * @arthur, 17 August 2026: "clicking outside the text box exits the entry
   * immediately making me lose what I typed in it". A phone panel is a small
   * target on a big screen, so the area that silently throws work away is far
   * larger than the area that keeps it. Nobody taps beside a box on purpose.
   *
   * Escape and the Cancel button still close it. Those are deliberate — a
   * reader who presses either has SAID they are abandoning the edit. A stray
   * thumb has not.
   */
  guardUnsaved?: boolean;
  children: ReactNode;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogSurface
          ref={surfaceRef}
          className={cn(
            size === 'content' ? SURFACE_PHONE_CONTENT : SURFACE_PHONE,
            SURFACE_DESKTOP,
            SURFACE_MOTION,
            className,
          )}
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
          /* Only the OUTSIDE tap is refused, and only while there is something
             to lose. Escape stays live: it is a decision, not a slip. */
          onPointerDownOutside={
            guardUnsaved ? (event) => event.preventDefault() : undefined
          }
          onInteractOutside={
            guardUnsaved ? (event) => event.preventDefault() : undefined
          }
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
          {/* ── THE HANDLE, ON THE SHEET ONLY ────────────────────────────
              A bottom sheet is dragged down to dismiss, and the handle is the
              only thing that says so. The owner asked for it, then asked for it
              to be nicer: it is wider and softer than the first pass, and it
              owns the space above the title rather than crowding it. A full
              screen has nothing to drag, so it does not get one. */}
          {size === 'content' ? (
            <div
              aria-hidden
              className="mx-auto mt-2.5 mb-1 h-1 w-8 shrink-0 rounded-full bg-foreground/20 md:hidden"
            />
          ) : null}

          {/* The notch padding belongs to the FULL-SCREEN shape, which starts
              under the status bar. A sheet on the bottom edge has nothing above
              it, so the same padding there is just a gap.

              THE RULE UNDER THE TITLE IS FULL-SCREEN ONLY. On a sheet 200px
              tall, a line under the title and another above the button chop it
              into three bands — the owner's "too boring and basic". Space does
              the separating there instead. */}
          <header
            className={cn(
              'shrink-0 bg-background md:border-b-0 md:pt-6 md:pb-4',
              size === 'fill'
                ? 'border-b pt-[env(safe-area-inset-top,0px)]'
                : 'md:border-b-0',
            )}
          >
            {/* ── THE SHEET CENTRES ITS TITLE, AND THAT IS NOT DECORATION ──
                With Cancel on the left and the title beside it, the two read as
                one phrase: "Cancel Full name". The shell's own bar solved this
                long ago with a three-column grid whose middle column is the
                title, so the same idiom is used here rather than a new one.
                A full screen keeps the flex row: its title follows a chevron,
                which nobody reads as a sentence. */}
            <div
              className={cn(
                'items-center gap-2 md:flex md:h-auto md:px-6 md:pr-12',
                size === 'fill'
                  ? 'flex h-14 px-2'
                  : 'grid h-11 grid-cols-[1fr_auto_1fr] px-4',
              )}
            >
              {/* ── THE WAY OUT SAYS WHAT IT DOES ──────────────────────────
                  A full screen keeps its chevron: you came from somewhere and
                  you are going back there.

                  A SHEET GETS THE WORD "CANCEL" INSTEAD, and that is not a
                  style choice. Done is the only labelled control on this
                  surface and it KEEPS what you typed; every way to discard —
                  tapping outside, swiping down, hardware Back — is invisible.
                  Somebody who has typed something they did not mean had no
                  button that said so. An arrow would not have said it either:
                  an arrow means the previous screen, not "throw this away". */}
              <DialogClose asChild>
                {size === 'fill' ? (
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
                ) : (
                  <button
                    type="button"
                    /* `justify-self-start` IS THE WHOLE FIX. The row is a
                       three-column grid so the title can be centred, which
                       makes this button's cell a full `1fr` wide — and a
                       button centres its own text, so "Cancel" floated in the
                       middle of that empty column instead of sitting at the
                       edge. Photographed by the owner, 17 August 2026: "is
                       there where you put the cancel button??"

                       I had filmed this sheet BEFORE the title was centred and
                       only measured it afterwards. The measurements all passed
                       — the button was present, enabled and correctly wired.
                       None of them could see where it was. */
                    className={cn(
                      'v2-interactive -ml-2 shrink-0 justify-self-start rounded-full px-2 py-1 text-sm text-muted-foreground md:hidden',
                      FOCUS_RING,
                    )}
                  >
                    Cancel
                  </button>
                )}
              </DialogClose>

              <DialogTitle
                className={cn(
                  'min-w-0 truncate text-base leading-none font-medium md:flex-1 md:text-left md:whitespace-normal',
                  size === 'fill' ? 'flex-1' : 'text-center',
                )}
              >
                {title}
              </DialogTitle>

              {/* The trailing cell. It holds the optional action, and on the
                  sheet it is rendered EMPTY rather than omitted, because the
                  centred title above is centred by the grid having three
                  columns — drop this and the title shifts off centre. */}
              {action ? (
                <div className="shrink-0 justify-self-end md:hidden">
                  {action}
                </div>
              ) : size === 'content' ? (
                <div aria-hidden className="md:hidden" />
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
            <footer
              className={cn(
                'flex shrink-0 flex-col-reverse gap-2 bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:flex-row md:justify-end md:border-t-0 md:px-6 md:py-4 md:pb-4',
                size === 'fill' && 'border-t',
              )}
            >
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
