'use client';

import { Suspense } from 'react';

import { useSearchPosition } from '@/v2/search-position';
import { SearchFieldShape } from '@/v2/shell/SearchField';
import { LIST_COLUMN_DOCKED } from '@/v2/shell/page-columns';
import { ScreenDock, ScreenDockSearch } from '@/v2/shell/ScreenDock';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import { useV2Session } from '@/v2/runtime/session-context';
import { ConversationsList } from './ConversationsList';
import { ConversationsListSkeleton } from './states';

/**
 * ConversationsScreen — the `/conversations` client root.
 *
 * One job, above the `useSearchParams` Suspense boundary so it does not depend
 * on the URL: wrapping the `useSearchParams` consumer in a `Suspense` boundary
 * (§E keep / Next requirement), with a fallback that mirrors the loading state
 * so the hand-off to real content is seamless.
 *
 * IT NO LONGER PUBLISHES A HEADER TITLE. It used to publish a static
 * "Conversations" to the bar's centre slot on mount. `/conversations` is a
 * TOP-LEVEL screen, and the bar on one of those carries no title at all — the
 * title lives in the page body now (`ScreenTitle`, fed by
 * `top-level-route.ts`). The effect and its cleanup were removed rather than
 * left dormant, because a screen that still published one would put its own
 * name on the pixels twice.
 *
 * `signedIn` is READ FROM CONTEXT rather than taken as a prop. It is the same
 * server-verified `!!session` value as before — the v2 layout computes it once
 * from `verifySession()` and publishes it — but sourcing it here means the
 * `/conversations` page shell no longer has to `await` `/auth/me` before it can
 * render, which is what put a Laravel round trip behind the route skeleton on
 * every navigation. (The skeleton itself is now gone on a return trip too — the
 * page exports `unstable_dynamicStaleTime`, so the router serves the segment from
 * its cache instead of re-fetching it.) The flag is
 * resolved on this component's first render (SSR on a hard load, in-memory
 * context on a soft nav), so `ConversationsList` never sees it flip.
 */
export function ConversationsScreen() {
  const { signedIn } = useV2Session();

  return (
    <Suspense fallback={<ConversationsFallback />}>
      <ConversationsList signedIn={signedIn} />
    </Suspense>
  );
}

/**
 * Suspense fallback — the title, the search field and the list skeleton in the
 * reading column. The field is STATIC CHROME, so it is a still reserved SHAPE,
 * not a pulse: it waits on no request (its value lives in
 * `useConversationsSearch`, its placeholder is a literal). This mirrors
 * `app/v2/conversations/loading.tsx` exactly, so route boundary → this fallback
 * → the live field is one continuous still shape and never reads static →
 * pulsing → content (standards §8).
 *
 * The field's shape is reserved WHERE IT WILL LAND — the floating dock by
 * default, the flow if the developer switch says so — so the hand-off is a
 * resolve in place rather than a move across the screen.
 */
function ConversationsFallback() {
  const searchAtTop = useSearchPosition() === 'top';
  return (
    <>
      <span role="status" className="sr-only">
        Loading your conversations
      </span>
      {/* `aria-hidden` + `inert` per standards §8(ii): a Suspense fallback is
          DELETED (not reconciled) when content arrives, so anything focusable in
          here would lose focus and caret mid-interaction. The announcement rides
          the sibling `role="status"` node, which is never inert. */}
      <div aria-hidden inert className={LIST_COLUMN_DOCKED}>
        <ScreenTitle />
        {searchAtTop ? <SearchFieldShape className="mb-4" /> : null}
        <ConversationsListSkeleton />
        {searchAtTop ? null : (
          <ScreenDock>
            <ScreenDockSearch>
              <SearchFieldShape />
            </ScreenDockSearch>
          </ScreenDock>
        )}
      </div>
    </>
  );
}
