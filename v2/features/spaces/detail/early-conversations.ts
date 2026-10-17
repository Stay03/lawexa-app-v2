'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { Space } from '@/types/collab';
import { collabAccessState } from '@/v2/features/collab/model';
import { useV2Session } from '@/v2/runtime/session-context';
import { findCachedRow } from '@/v2/runtime/seed-detail';
import { spacesQueries } from '../queries';
import { startsConversationsEarly } from './early-conversations-model';

/**
 * Starts the Conversations tab's first page with the space's details (speed
 * step 5), when {@link startsConversationsEarly} says it can. Decided once per
 * space: when `spaceUuid` changes, and not again on later renders.
 *
 * CALLED FROM `CollabFrame`, NOT `SpaceScreen`. The collab layout is mounted
 * on the spaces list already, so it reads the space's details the moment the
 * address changes. `SpaceScreen` mounts only once the page's server payload
 * has arrived, about 1.2 s later on a slow phone link, together with the tab
 * itself: started there, this read and the tab's were one read at the same
 * late moment (timed runs, 17 October 2026: +1158 to +1206 ms after the
 * details read with every input of the decision true). Started here, it goes
 * out beside the details.
 *
 * The tab comes from the address as it is when the effect runs: the layout
 * has no `useSearchParams` of its own, and the router has written the new
 * address before passive effects run.
 */
export function useEarlyConversations(spaceUuid: string | null): void {
  const queryClient = useQueryClient();
  const session = useV2Session();
  const eligible = collabAccessState(session) === 'eligible';
  const viewerId = session.userId;
  useEffect(() => {
    if (spaceUuid === null) return;
    const early = startsConversationsEarly({
      eligible,
      cachedRole: findCachedRow<Space>(queryClient, spacesQueries.lists(), (row) => row.uuid === spaceUuid)
        ?.my_role,
      tabParam: new URLSearchParams(window.location.search).get('tab'),
    });
    if (!early) return;
    void queryClient.prefetchInfiniteQuery(spacesQueries.conversations(spaceUuid, { viewerId }));
  }, [eligible, queryClient, spaceUuid, viewerId]);
}
