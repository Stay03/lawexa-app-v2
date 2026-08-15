import { cn } from "@/lib/utils"

/**
 * The shared loading bar. It pulses, because a wait should look like a wait
 * wherever it appears: a route fallback, a Suspense fallback, or a query still
 * pending on a live screen. One appearance for a wait, everywhere. See
 * docs/v2-docs/foundation-standards.md section 8(i).
 *
 * The reduced-motion guard lives HERE, in the primitive, and not only in the
 * `html.v2-document-lock .animate-pulse` rule in `v2/shell/shell.css`. That rule
 * depends on a class `DocumentLock` adds inside an effect, so it cannot apply
 * until hydration, and on a hard navigation a route fallback is on screen for
 * the whole time before that. `motion-reduce:` is plain CSS and applies on the
 * very first paint.
 *
 * Why `motion-reduce:animate-none` rather than `motion-safe:animate-pulse`: `cn`
 * runs tailwind-merge, which drops an earlier `animate-pulse` when a caller
 * passes its own `animate-*` class. A `motion-safe:`-prefixed pulse sits in a
 * different merge group, so it would survive a caller's override and leave raw
 * stylesheet order to pick the winner. This form keeps a caller's override
 * working and still costs a reduced-motion reader nothing.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted rounded-xl animate-pulse motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export { Skeleton }
