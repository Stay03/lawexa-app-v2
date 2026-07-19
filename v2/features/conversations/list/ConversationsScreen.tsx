'use client';

import { Suspense, useEffect } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
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
 */
export function ConversationsScreen({ signedIn }: { signedIn: boolean }) {
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

/** Suspense fallback — the search field + list skeleton in the reading column. */
function ConversationsFallback() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-5 sm:pt-6">
      <Skeleton className="mb-4 h-11 w-full rounded-4xl" />
      <ConversationsListSkeleton />
    </div>
  );
}
