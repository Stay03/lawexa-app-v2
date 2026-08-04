'use client';

import { useQuery } from '@tanstack/react-query';
import { invitationsQueries } from './queries';

/**
 * usePendingInvitationCount — the number on the "Invitations" entry button on
 * `/spaces`, summed across the three inboxes.
 *
 * IT IS THE SAME THREE CACHE ENTRIES THE `/invitations` SCREEN READS, which is
 * the point: the badge and the screen can never disagree, and following the
 * button paints the inbox from an already-warm cache with no skeleton at all
 * (the owner feel directive — fluidity is cache-first paints). Answering an
 * invitation drops this number in the same frame the row leaves, because the
 * optimistic removal decrements `pagination.total`, which is what this counts.
 *
 * COUNTS `pagination.total`, NOT `data.length`: the inbox request asks for one
 * page, and a reader with more pending invitations than a page would otherwise
 * see a badge that undercounts the list it opens.
 *
 * THE COST, STATED: three list requests per visit to `/spaces`. That is the
 * honest price of a live count — there is no aggregate endpoint — and the
 * standard tier means a second visit inside the minute pays nothing.
 *
 * Returns 0 while the queries are pending or gated off, so the badge is never
 * a flash of a wrong number; the entry button renders without it and the badge
 * fades in when the count resolves. Phase-5 W4, 2026-08-04.
 */
export function usePendingInvitationCount({
  viewerId,
  enabled,
}: {
  viewerId: number | null;
  /** Gated on the collab access state — never fetch for a viewer the door
   *  has already refused. */
  enabled: boolean;
}): number {
  const organizations = useQuery({
    ...invitationsQueries.organizations({ viewerId }),
    enabled,
  });
  const spaces = useQuery({ ...invitationsQueries.spaces({ viewerId }), enabled });
  const channels = useQuery({ ...invitationsQueries.channels({ viewerId }), enabled });

  return (
    (organizations.data?.pagination.total ?? 0) +
    (spaces.data?.pagination.total ?? 0) +
    (channels.data?.pagination.total ?? 0)
  );
}
