'use client';

import { Suspense, useEffect } from 'react';
import { Search } from 'lucide-react';

import { useV2Session } from '@/v2/runtime/session-context';
import { setHeaderContext, clearHeaderContext } from '@/v2/shell/header-context';
import { ConversationsList } from './ConversationsList';
import { ConversationsListSkeleton } from './states';

/**
 * ConversationsScreen — the `/conversations` client root.
 *
 * Two jobs, both above the `useSearchParams` Suspense boundary so neither
 * depends on the URL:
 *
 *  1. PUBLISHES the header centre-slot title. On a non-home route the header
 *     shows the route's published context (owner #43); this page publishes a
 *     static "Conversations" on mount and clears it on unmount (an external-store
 *     write — not React setState — so it is React-Compiler-clean in an effect,
 *     the same seam the conversation controller uses). `setHeaderContext` is
 *     idempotent, so the publish is safe to run once. NOTE (verified first-hand):
 *     `/conversations` is not in the header's `expectsContext` set (only `/c/*`
 *     is), so the centre shows NO skeleton — correct, because the title is a
 *     known static string, not late-resolving; it simply cross-fades in (200ms)
 *     the moment this effect publishes. No header change is required.
 *
 *  2. Wraps the `useSearchParams` consumer in a `Suspense` boundary (§E keep /
 *     Next requirement), with a fallback that mirrors the loading state so the
 *     hand-off to real content is seamless.
 *
 * `signedIn` is READ FROM CONTEXT rather than taken as a prop. It is the same
 * server-verified `!!session` value as before — the v2 layout computes it once
 * from `verifySession()` and publishes it — but sourcing it here means the
 * `/conversations` page shell no longer has to `await` `/auth/me` before it can
 * render, which is what put a Laravel round trip behind the route skeleton on
 * every navigation (the skeleton itself remains — the route is still dynamic —
 * but now covers an I/O-free Next round trip). The flag is
 * resolved on this component's first render (SSR on a hard load, in-memory
 * context on a soft nav), so `ConversationsList` never sees it flip.
 */
export function ConversationsScreen() {
  const { signedIn } = useV2Session();

  useEffect(() => {
    setHeaderContext({ title: 'Conversations', confidential: false });
    return () => clearHeaderContext();
  }, []);

  return (
    <Suspense fallback={<ConversationsFallback />}>
      <ConversationsList signedIn={signedIn} />
    </Suspense>
  );
}

/**
 * Suspense fallback — the search field + list skeleton in the reading column.
 * The field is STATIC CHROME, so it is a still reserved SHAPE, not a pulse: it
 * waits on no request (its value lives in `useConversationsSearch`, its
 * placeholder is a literal). This mirrors `app/v2/conversations/loading.tsx`
 * exactly, so route boundary → this fallback → the live field is one continuous
 * still shape and never reads static → pulsing → content (standards §8).
 */
function ConversationsFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your conversations
      </span>
      {/* `aria-hidden` + `inert` per standards §8(ii): a Suspense fallback is
          DELETED (not reconciled) when content arrives, so anything focusable in
          here would lose focus and caret mid-interaction. The announcement rides
          the sibling `role="status"` node, which is never inert. */}
      <div
        aria-hidden
        inert
        className="mx-auto w-full max-w-2xl px-4 pb-16 pt-5 sm:pt-6"
      >
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
