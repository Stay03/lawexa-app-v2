"use client"

import * as React from "react"
import { HoverCard as HoverCardPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function HoverCard({
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root data-slot="hover-card" {...props} />
}

function HoverCardTrigger({
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return (
    <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
  )
}

function HoverCardContent({
  className,
  align = "center",
  sideOffset = 8,
  collisionPadding = 16,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          // Surface — hairline chrome on the popover token, rounded, clips its
          // own rounded corners so an internal scroll area stays inside the radius.
          "bg-popover text-popover-foreground border-border z-50 origin-(--radix-hover-card-content-transform-origin) overflow-hidden rounded-2xl border shadow-lg outline-hidden " +
            // Symmetric open/close motion (owner #24). Both directions animate off
            // Radix `data-state`; gated with `motion-safe:` so reduced-motion users
            // get an instant, still open/close (Radix Presence then unmounts on the
            // synchronous close — no lingering exit animation).
            "motion-safe:data-open:animate-in motion-safe:data-closed:animate-out " +
            "motion-safe:data-open:fade-in-0 motion-safe:data-closed:fade-out-0 " +
            "motion-safe:data-open:zoom-in-95 motion-safe:data-closed:zoom-out-95 " +
            "motion-safe:duration-200 " +
            "motion-safe:data-[side=bottom]:slide-in-from-top-1 motion-safe:data-[side=top]:slide-in-from-bottom-1 " +
            "motion-safe:data-[side=left]:slide-in-from-right-1 motion-safe:data-[side=right]:slide-in-from-left-1",
          className
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  )
}

export { HoverCard, HoverCardTrigger, HoverCardContent }
