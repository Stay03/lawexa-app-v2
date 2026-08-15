import { Skeleton } from '@/components/ui/skeleton';

/**
 * =============================================================================
 * THE CONVERSATION SCREEN'S LOADING SHAPES — ONE DEFINITION, THREE CONSUMERS
 * =============================================================================
 * `/c/{id}` is drawn while it resolves by three different things, and until this
 * module existed they did not agree on what the screen looks like:
 *
 *   1. `app/v2/c/[conversationId]/loading.tsx` — the ROUTE boundary. Next shows it
 *      before any of our React runs, on every navigation that is not served from
 *      the client router cache.
 *   2. `MessageList`'s history skeleton — shown when the transcript is genuinely
 *      still being fetched AND the engine holds nothing.
 *   3. `ConversationScreen`'s composer skeleton — shown while ownership/history
 *      resolve, so the floating pill never flashes the wrong affordance.
 *
 * (1) drew the transcript and NOTHING for the composer. (2) and (3) together drew
 * the transcript AND the composer. The owner saw the consequence directly: the
 * first visit to a conversation showed a grey text box, and every visit after it
 * showed only grey messages — because a warm transcript skips (2) and (3)
 * entirely, leaving (1) as the only thing on screen. Same screen, two silhouettes,
 * decided by cache state the user cannot see.
 *
 * The fix is not to synchronise three copies; it is to have one. Both shapes live
 * here and every consumer renders THESE, so the route boundary and the screen's
 * own resolving state are the same picture and the hand-off between them changes
 * nothing.
 *
 * SERVER-SAFE ON PURPOSE — no `'use client'`, no hooks, no imports beyond the
 * shared `Skeleton` primitive (itself a server component). `loading.tsx` is a
 * server component; if these shapes lived in `ConversationComposer.tsx` (a client
 * module with the whole prompt-input tree behind it) the route boundary would ship
 * that entire bundle just to draw a grey pill.
 *
 * MOTION — bars use the shared `Skeleton` primitive rather than hand-rolled
 * `animate-pulse` divs, so they inherit its `motion-reduce:animate-none` guard
 * (which applies on the first paint, before hydration) and any future change to
 * the primitive. They pulse in every consumer, route boundary included: one
 * appearance for a wait, whichever boundary draws it (standards section 8i).
 * =============================================================================
 */

/**
 * The transcript's resting geometry: two user bubbles and two answer blocks, in
 * the reading column's own `gap-6` rhythm. Deliberately a MEDIAN turn count — it
 * is what an opening screenful of a conversation looks like, so the settle onto
 * real messages is small in either direction.
 *
 * `aria-hidden`: the announcement rides a sibling `role="status"` node in each
 * consumer, never this subtree.
 */
export function TranscriptSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
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
  );
}

/**
 * The composer's resolving visual. Mirrors the empty composer exactly: a `mb-2`
 * jurisdiction chip floating above a single-input-row card (`+` · textarea · Send)
 * at the compact v1 scale — `size-8` controls, an `h-9` textarea,
 * `max-w-xs sm:max-w-md`.
 *
 * LOCKSTEP. Keep this in step with the real pill in `ConversationComposer.tsx` AND
 * with the `--v2-conv-dock-h` fallback in `MessageList`. The floating layer is
 * `absolute` (out of flow) over a transcript that reserves its own bottom padding,
 * so a mismatch causes no transcript CLS — but the pill grows upward from
 * `bottom-0`, so a height change still shifts the pill's own top edge.
 */
export function ComposerSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xs px-4 pb-3 pt-2 sm:max-w-md" aria-hidden>
      {/* Meta row — the jurisdiction chip, floating ABOVE the pill (mb-2). */}
      <div className="mb-2 px-1">
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
      {/* The pill — the PromptInput card holding ONLY the single input row, at the
          compact v1-floating-prompt scale (size-8 controls, h-9 textarea). */}
      <div className="border-border bg-muted/50 rounded-3xl border p-2">
        <div className="flex items-end gap-1.5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className="h-9 flex-1 rounded-2xl" />
          <Skeleton className="size-8 shrink-0 rounded-full" />
        </div>
      </div>
    </div>
  );
}
