import { Search } from 'lucide-react';
import { ConversationsListSkeleton } from '@/v2/features/conversations/list/states';

/**
 * Route-level loading boundary for `/conversations` — and the REFERENCE
 * IMPLEMENTATION of the v2 loading convention (docs/v2-docs/foundation-standards.md
 * §8). It shows the rule in one screen:
 *
 *  • THE SEARCH FIELD IS STATIC CHROME, so it gets a reserved SHAPE, not a
 *    skeleton. It loads nothing: it is a controlled input whose value lives in
 *    `useConversationsSearch` and whose placeholder is a literal. It used to be a
 *    pulsing `Skeleton`, which told the user something was arriving there when
 *    nothing was. Now it is the field's own resting geometry — `h-11` (the 44px
 *    touch floor), `rounded-4xl`, the `border-input` hairline on `bg-input/30`,
 *    and the real leading search icon — perfectly still, so the hand-off to the
 *    live field changes nothing but its ability to accept text.
 *  • THE LIST IS GENUINELY DATA-DRIVEN, so it gets the real pulsing skeleton —
 *    and reuses `ConversationsListSkeleton`, the SAME component the page's own
 *    Suspense fallback and the list's pending state render, so boundary →
 *    fallback → resolved list is one continuous shape with zero jumps.
 *  • The whole thing is `aria-hidden` + `inert`: a Suspense fallback is deleted
 *    (not reconciled) the moment content arrives, so anything focusable in here
 *    would have its focus and caret destroyed mid-interaction. A single
 *    `role="status"` node outside the hidden subtree carries the announcement.
 *
 * The column geometry (`max-w-2xl`, `px-4 pb-16 pt-5 sm:pt-6`, `mb-4` under the
 * field) is the page's own, so nothing shifts on hand-off.
 */
export default function ConversationsLoading() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your conversations
      </span>
      <div
        aria-hidden
        inert
        className="mx-auto w-full max-w-2xl px-4 pb-16 pt-5 sm:pt-6"
      >
        {/* Reserved search field — the real chrome's shape, held still. */}
        <div className="relative mb-4">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <div className="h-11 w-full rounded-4xl border border-input bg-input/30" />
        </div>
        <ConversationsListSkeleton />
      </div>
    </>
  );
}
