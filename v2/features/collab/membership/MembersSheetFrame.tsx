'use client';

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
 */
export function MembersSheetFrame({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** The quiet count line under the title, e.g. "4 members in Firm HQ". */
  subtitle: string;
  children: React.ReactNode;
  /** Pinned bottom slot — the self-action (leave), never a roster row. */
  footer?: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          {/* A real `SheetDescription`, not a styled `<p>`: Radix wires it to
              the dialog's `aria-describedby`, so the panel announces "Members
              — 4 members in Firm HQ" instead of a bare title, and Radix stops
              warning about a described-by-nothing dialog. */}
          <SheetDescription>{subtitle}</SheetDescription>
        </SheetHeader>

        <div className="v2-quiet-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {children}
        </div>

        {footer ? <div className="border-t p-4">{footer}</div> : null}
      </SheetContent>
    </Sheet>
  );
}
