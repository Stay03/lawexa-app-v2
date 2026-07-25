import {
  TranscriptSkeleton,
  ComposerSkeleton,
} from '@/v2/features/conversations/conversation/skeletons';

/**
 * Route-level loading boundary for `/c/[conversationId]`, following the v2
 * loading convention (docs/v2-docs/foundation-standards.md §8).
 *
 * WHAT IT COVERS. The page awaits nothing but its own params — identity comes from
 * `<V2SessionProvider>` in the v2 layout — so this boundary covers only the RSC
 * round trip for the route segment, never a wait on Laravel. The route is dynamic
 * (the layout reads cookies), but the page now exports `unstable_dynamicStaleTime`,
 * so a return trip inside that window is served from the client router cache and
 * NEVER reaches this file. It is the cold-open shape, which is what a route
 * boundary is for.
 *
 * ONE SILHOUETTE, NOT TWO. This draws the SAME transcript and the SAME composer
 * shape that `MessageList` and `ConversationScreen` draw while they resolve — both
 * imported from `v2/features/conversations/conversation/skeletons`. It used to draw
 * the transcript alone, which is why the composer appeared as a grey pill on a cold
 * open and not at all on a warm one: the warm path skips the screen's own skeletons
 * and leaves this file as the only thing on screen. Same screen, same picture, in
 * every cache state.
 *
 * GEOMETRY IS THE SCREEN'S OWN, copied so nothing shifts on hand-off: the reading
 * column (`max-w-2xl`, `px-4 pt-6`) inside the scroll region, the transcript's
 * reserved bottom padding for the floating pill (`--v2-conv-dock-h`, with the same
 * `7rem` pre-measure fallback MessageList uses), and the composer as an ABSOLUTE
 * bottom layer with `v2-safe-bottom` — exactly as `ConversationScreen` lays it out.
 *
 * `aria-hidden` + `inert` per §8(ii): a Suspense fallback is DELETED (not
 * reconciled) the moment content arrives, so anything focusable or stateful in here
 * would have its focus and caret destroyed mid-interaction. A single `role="status"`
 * node outside the hidden subtree carries the announcement.
 */
export default function Loading() {
  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <span role="status" className="sr-only">
        Loading this conversation
      </span>
      <div aria-hidden inert className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-6 pb-[calc(var(--v2-conv-dock-h,7rem)+1rem)]">
          <TranscriptSkeleton />
        </div>
      </div>
      <div aria-hidden inert className="absolute inset-x-0 bottom-0 z-10">
        <div className="v2-safe-bottom">
          <ComposerSkeleton />
        </div>
      </div>
    </div>
  );
}
