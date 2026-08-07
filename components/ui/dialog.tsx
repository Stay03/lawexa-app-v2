"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn("data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-black/80 duration-100 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 isolate z-50", className)}
      {...props}
    />
  )
}

/**
 * THE HEIGHT CEILING IS NOT COSMETIC — IT IS THE DIFFERENCE BETWEEN A CRAMPED
 * DIALOG AND AN UNUSABLE ONE.
 *
 * Upstream shadcn answers the size question on ONE axis: `max-w-*`, and nothing
 * for height. That is a desktop default, and on a phone it fails in a way no
 * user can work around. A centred box (`top-1/2` + `-translate-y-1/2`) taller
 * than the viewport hangs off the top AND the bottom by equal amounts, and
 * NEITHER end can be reached: the box has no scroller of its own, the document
 * is locked (`v2/shell/shell.css` plus Radix's own scroll lock), and the box is
 * portalled to `document.body`, so it is not inside the app's one scroll region
 * either. Measured 2026-08-07: the space-edit form came to ~1,115px on a 360px
 * phone, putting Save, Cancel and the close X off-screen at once.
 *
 * So the ceiling is the primitive's job, not each caller's. Callers that need a
 * different shape still win — tailwind-merge lets a passed `max-h-*` or
 * `overflow-*` replace these, which is how the dialogs that already cap
 * themselves keep their own geometry.
 *
 * WHY `dvh` AND `--keyboard-inset` TOGETHER, NOT ONE OR THE OTHER. The two
 * platforms hide the bottom of the screen in two different ways, and only one
 * of them is visible to CSS lengths:
 *
 *  - ANDROID (our wrapped app) sets `interactiveWidget: 'resizes-content'`, so
 *    the keyboard SHRINKS the layout viewport. `dvh` tracks that by itself and
 *    `--keyboard-inset` is 0 — one term does the work.
 *  - iOS OVERLAYS the keyboard and the viewport never changes, so `dvh` learns
 *    nothing. `--keyboard-inset` (published by `v2/shell/use-keyboard-inset.ts`)
 *    is the only number that knows, and without it the bottom half of a centred
 *    dialog — the footer included — sits behind the keyboard.
 *
 * Subtracting the inset from the ceiling keeps the box short enough; moving the
 * centre up by HALF of it keeps that box centred in what remains VISIBLE rather
 * than in a viewport whose bottom the reader cannot see. Outside the v2 shell
 * the variable is undefined and both terms fall back to zero, so v1 is untouched.
 */
const DIALOG_VIEWPORT_FIT =
  "max-h-[calc(100dvh-2rem-var(--keyboard-inset,0px))] overflow-y-auto top-[calc(50%-var(--keyboard-inset,0px)/2)]"

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/5 grid max-w-[calc(100%-2rem)] gap-6 rounded-4xl p-6 text-sm ring-1 duration-100 sm:max-w-md fixed left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2",
          DIALOG_VIEWPORT_FIT,
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button variant="ghost" className="absolute top-4 right-4" size="icon-sm">
              <XIcon
              />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

/**
 * The dialog's content surface with NO shape of its own — same Radix machinery
 * as `DialogContent` (focus trap, Escape, `aria-modal`, the dismissable layer),
 * none of the centred-card geometry.
 *
 * It exists for the one dialog whose shape is not a card: the channel picture
 * viewer, which fills the screen. Expressing that through `DialogContent`'s
 * `className` would mean unpicking `grid`, `gap-6`, `p-6`, `rounded-4xl`,
 * `max-w-*` at two breakpoints, `top-1/2 left-1/2` and both translates one
 * conflicting utility at a time — a chain that reads as correct and silently
 * stops being it the day the card is re-tuned. Callers own the whole class
 * list, and must include their own positioning and `z-50`.
 *
 * Render it inside `DialogPortal` beside a `DialogOverlay`: the overlay is what
 * carries the scroll lock, so a surface without one does not have one.
 *
 * ITS SLOT IS ITS OWN. `data-slot="dialog-content"` names the centred card, and
 * two surfaces answering to one name would be indistinguishable to any rule or
 * test written against it later — which is exactly the sort of thing a slot
 * attribute exists to be.
 */
function DialogSurface({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Content
      data-slot="dialog-surface"
      className={className}
      {...props}
    />
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("gap-2 flex flex-col", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "gap-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-base leading-none font-medium", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground *:[a]:hover:text-foreground text-sm *:[a]:underline *:[a]:underline-offset-3", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
}
