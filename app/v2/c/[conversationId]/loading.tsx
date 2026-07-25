import { Skeleton } from '@/components/ui/skeleton';

/**
 * Route-level loading boundary for `/c/[conversationId]`, following the v2
 * loading convention (docs/v2-docs/foundation-standards.md §8).
 *
 * WHAT IT COVERS. The page no longer awaits the session — identity comes from
 * `<V2SessionProvider>` in the v2 layout — so this boundary now covers only the
 * RSC round trip for the route segment, not a wait on Laravel. The route stays
 * dynamic (the layout reads cookies) and `staleTimes` is unset, so the boundary
 * is still REACHED on every soft navigation; what changed is its duration.
 *
 * Transcript geometry only. The composer is NOT drawn here: it is an absolute
 * overlay owned by `ConversationScreen`, which renders its own composer-shaped
 * skeleton at the pill's exact geometry while ownership and history resolve — so
 * duplicating it here would double the bar for one frame.
 *
 * `aria-hidden` + `inert` per §8(ii): a Suspense fallback is DELETED (not
 * reconciled) the moment content arrives, so anything focusable or stateful in
 * here would have its focus and caret destroyed mid-interaction. A single
 * `role="status"` node outside the hidden subtree carries the announcement.
 *
 * Bars use the shared `Skeleton` primitive rather than hand-rolled `animate-pulse`
 * divs, so they inherit the v2 reduced-motion rule in `shell.css` and any future
 * change to the primitive.
 */
export default function Loading() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <span role="status" className="sr-only">
        Loading this conversation
      </span>
      <div
        aria-hidden
        inert
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6"
      >
        <div className="flex justify-end">
          <Skeleton className="h-10 w-2/3 rounded-3xl" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-11/12 rounded" />
          <Skeleton className="h-4 w-4/5 rounded" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-10 w-1/2 rounded-3xl" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-3/4 rounded" />
        </div>
      </div>
    </div>
  );
}
