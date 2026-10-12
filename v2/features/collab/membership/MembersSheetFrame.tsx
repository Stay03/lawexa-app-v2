'use client';

import { useEffect, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

/**
 * MembersSheetFrame — the chrome both W4 member sheets share: a right-side
 * panel with a bordered header (title + a quiet count line), a scrolling
 * roster body, and a pinned footer for the one destructive self-action
 * ("Leave"). The space sheet and the organization sheet differ in their
 * mutations and their copy, never in their shape — this frame is what
 * guarantees that, and it matches the channel members sheet's geometry
 * (`gap-0 p-0 sm:max-w-sm`, `px-4 py-4` body) so all three read as one
 * component family.
 *
 * The footer is a separate slot rather than the last child of the body on
 * purpose: "Leave" must stay reachable without scrolling a hundred-person
 * roster, and it must never sit between two member rows. Phase-5 W4,
 * study A2/A8 KEEP — 2026-08-04.
 *
 * `onBack` turns the header into a step inside the sheet (the space sheet's
 * invite links and waiting list, design round 1): a back control before the
 * title returns to the roster without closing the panel.
 *
 * ── FOCUS LANDS ON THE BODY, NOT ON A CONTROL (design round 2) ─────────────
 * Radix moves focus to the first tabbable element on open. For a Viewer, who
 * has no invite button and no row menus, that was the footer's "Leave space",
 * so a keyboard reader was one Enter away from the leave confirm on every
 * open. The panel is named by its title, so focus goes to the scrolling body
 * instead (`tabIndex={-1}`, reached by script only), on open and again on each
 * step change, whose old control has just left the page.
 */
export function MembersSheetFrame({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
  footer,
  onBack,
  backLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** The quiet count line under the title, e.g. "4 members in Firm HQ". */
  subtitle: string;
  children: React.ReactNode;
  /** Pinned bottom slot — the self-action (leave), never a roster row. */
  footer?: React.ReactNode;
  /** A step inside the sheet: the back control's action. */
  onBack?: () => void;
  /** Its accessible name, e.g. "Back to members". */
  backLabel?: string;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  // A new step replaces the control that opened it, so focus would fall to
  // the document; it goes to the step's body, as it does on open. `title` is
  // what names the step, so it is what re-runs this.
  useEffect(() => {
    if (open) bodyRef.current?.focus();
  }, [open, title]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Variant-matched width, or these are dead classes — see `SpaceDrawer`.
          `sm:max-w-sm` happened to match what the primitive already sets, but
          `w-full` did not, so on a phone this drew at three quarters. */}
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-sm"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          bodyRef.current?.focus();
        }}
      >
        <SheetHeader className="border-b">
          {onBack ? (
            <div className="-ml-2 flex min-w-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                className="v2-interactive shrink-0 text-muted-foreground"
                aria-label={backLabel ?? 'Back'}
                onClick={onBack}
              >
                <ChevronLeft aria-hidden className="size-4" />
              </Button>
              <SheetTitle className="min-w-0 truncate">{title}</SheetTitle>
            </div>
          ) : (
            <SheetTitle>{title}</SheetTitle>
          )}
          {/* A real `SheetDescription`, not a styled `<p>`: Radix wires it to
              the dialog's `aria-describedby`, so the panel announces "Members
              — 4 members in Firm HQ" instead of a bare title, and Radix stops
              warning about a described-by-nothing dialog. */}
          <SheetDescription>{subtitle}</SheetDescription>
        </SheetHeader>

        <div
          ref={bodyRef}
          tabIndex={-1}
          className="v2-quiet-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 outline-none"
        >
          {children}
        </div>

        {footer ? <div className="border-t p-4">{footer}</div> : null}
      </SheetContent>
    </Sheet>
  );
}
