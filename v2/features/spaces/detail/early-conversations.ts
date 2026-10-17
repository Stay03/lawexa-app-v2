'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { Space } from '@/types/collab';
import { collabAccessState } from '@/v2/features/collab/model';
import { useV2Session } from '@/v2/runtime/session-context';
import { findCachedRow } from '@/v2/runtime/seed-detail';
import { spacesQueries } from '../queries';
import { startsConversationsEarly } from './early-conversations-model';

/**
 * Starts the Conversations tab's first page with the space's details (speed
 * step 5), when {@link startsConversationsEarly} says it can. Decided once, at
 * mount.
 */
export function useEarlyConversations(spaceUuid: string, tabParam: string | null): void {
  const queryClient = useQueryClient();
  const session = useV2Session();
  const [early] = useState(() =>
    startsConversationsEarly({
      eligible: collabAccessState(session) === 'eligible',
      cachedRole: findCachedRow<Space>(queryClient, spacesQueries.lists(), (row) => row.uuid === spaceUuid)
        ?.my_role,
      tabParam,
    }),
  );
  const viewerId = session.userId;
  useEffect(() => {
    if (!early) return;
    void queryClient.prefetchInfiniteQuery(spacesQueries.conversations(spaceUuid, { viewerId }));
  }, [early, queryClient, spaceUuid, viewerId]);
}
