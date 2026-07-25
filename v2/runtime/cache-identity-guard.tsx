'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * V2CacheIdentityGuard — drops the entire v2 query cache the moment the
 * server-verified viewer changes. Renders nothing.
 *
 * WHY THIS EXISTS (a privacy boundary, not an optimisation). Two properties of
 * the v2 runtime combine badly without it:
 *
 *  1. The browser QueryClient is a MODULE SINGLETON (`query-provider.tsx`), one
 *     per document. v2 has no sign-out of its own, so a user signs out in v1 —
 *     where `queryClient.clear()` resolves to the v1 ROOT provider and leaves the
 *     v2 cache untouched — and both v1's logout and login are SOFT navigations.
 *     No full page load occurs anywhere in an A-signs-out / B-signs-in flow, so
 *     the v2 singleton survives it holding A's data.
 *  2. Conversation lists, bookmarks, channels, quiz, radars, recently-viewed and
 *     spaces are keyed WITHOUT a viewer segment and now retain for 30 minutes
 *     (`GC_TIMES.list`). Only the conversation DETAIL key is viewer-partitioned.
 *
 * So B could land on the home and see A's conversation titles and previews, A's
 * bookmarks, spaces, radars, recently-viewed items and quiz scores — each for one
 * network round trip, at every surface, for up to 30 minutes.
 *
 * The guard makes the guarantee STRUCTURAL rather than a rule every future query
 * author must remember: partitioning a key is easy to forget, and the failure is
 * silent and invisible in review. Clearing on the identity edge cannot be
 * forgotten by a new feature, because the new feature does not have to do
 * anything.
 *
 * IT ALSO CLOSES THE `viewerId: null` POISONING PATH. `verifySession()` returns
 * null for a missing cookie, a stale cookie, a 401 AND a transient `/auth/me`
 * network error. During that guest window a request still carries the v1
 * localStorage bearer token, so a private transcript can return 200 and land in
 * the cache under the `{ viewerId: null }` partition. Clearing on the
 * null -> real transition (which `SessionSync`'s refresh then produces) removes
 * that entry instead of leaving it readable by the next guest for 30 minutes.
 *
 * MECHANISM. React's sanctioned "adjust state during render": the last-seen
 * identity is STATE (not a ref — writing a ref during render is a React-Compiler
 * lint error, and correctly so), seeded from the current `userId` so a normal
 * first paint never clears. `queryClient.clear()` is an external-store write, not
 * React state, so it is legal here and needs no effect — which matters, because
 * an effect would clear one commit LATE, after the stale data had already
 * painted. Every later transition — guest -> A, A -> guest, A -> B — drops
 * everything, and converges in one extra render (the guard is false next pass).
 *
 * COST. One cold fetch per identity transition, on a transition that already
 * re-renders the whole tree. That is the correct trade against showing one user
 * another user's data.
 */
export function V2CacheIdentityGuard({ userId }: { userId: number | null }) {
  const queryClient = useQueryClient();
  const [seen, setSeen] = useState<number | null>(userId);

  if (seen !== userId) {
    setSeen(userId);
    queryClient.clear();
  }

  return null;
}
