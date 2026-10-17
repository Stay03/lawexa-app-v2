'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { Space } from '@/types/collab';
import { canOpenTeamChannels, collabAccessState } from '@/v2/features/collab/model';
import { useV2Session } from '@/v2/runtime/session-context';
import { findCachedRow } from '@/v2/runtime/seed-detail';
import { spaceKind } from '../model';
import { spacesQueries } from '../queries';
import { startsFeedEarly } from './early-feed-model';

/**
 * Starts the space home's All list with the space's details (speed step 5),
 * when {@link startsFeedEarly} says it can. Decided once per space: when
 * `spaceUuid` changes, and not again on later renders.
 *
 * CALLED FROM `CollabFrame`, NOT `SpaceScreen`. The collab layout is mounted
 * on the spaces list already, so it reads the space's details the moment the
 * address changes. `SpaceScreen` mounts only once the page's server payload
 * has arrived, about 1.2 s later on a slow phone link, together with the list
 * itself: started there, this read and the list's were one read at the same
 * late moment (timed runs, 17 October 2026: +1158 to +1206 ms after the
 * details read with every input of the decision true). Started here, it goes
 * out beside the details.
 *
 * The pill comes from the address as it is when the effect runs: the layout
 * has no `useSearchParams` of its own, and the router has written the new
 * address before passive effects run.
 */
export function useEarlyFeed(spaceUuid: string | null): void {
  const queryClient = useQueryClient();
  const session = useV2Session();
  const eligible = collabAccessState(session) === 'eligible';
  const viewerId = session.userId;
  const teamChannels = canOpenTeamChannels(session);
  useEffect(() => {
    if (spaceUuid === null) return;
    const cached = findCachedRow<Space>(queryClient, spacesQueries.lists(), (row) => row.uuid === spaceUuid);
    const early = startsFeedEarly({
      eligible,
      cachedRole: cached?.my_role,
      tabParam: new URLSearchParams(window.location.search).get('tab'),
    });
    if (!early || !cached) return;
    // The list's own ask, rooms included where they show (`spaceShowsChannels`,
    // which the home reads off the space), so the home finds this read.
    const rooms = spaceKind(cached) === 'team' && teamChannels;
    void queryClient.prefetchInfiniteQuery(spacesQueries.items(spaceUuid, { viewerId, rooms }));
  }, [eligible, queryClient, spaceUuid, viewerId, teamChannels]);
}
