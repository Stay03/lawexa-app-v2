'use client';

import { useQuery } from '@tanstack/react-query';
import { Link2, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/stores/authStore';
import type { Space } from '@/types/collab';
import { useCollabSpaceScope } from '@/v2/features/collab/shell/space-scope';
import {
  RosterErrorState,
  RosterSkeleton,
} from '@/v2/features/collab/membership/RosterRow';
import { SpaceJoinRequestsPanel } from '@/v2/features/invites/JoinRequestsPanel';
import { useSpaceJoinRequests } from '@/v2/features/invites/queries';
import { useV2Session } from '@/v2/runtime/session-context';
import {
  canAskToContribute,
  isSharedSpace,
  splitRoster,
} from '../../model';
import { spacesQueries } from '../../queries';
import { invitedRows } from './people-model';
import { ContributeAsk, RoleRequestsSection } from './RoleRequests';
import { useSpaceRosterRow } from './use-roster-row';

/**
 * The People tab (Stay, 15 October 2026: "inside the space, there should be a
 * people tab which should list members, there should have the list of members
 * and those pending to join in"). The members moved here from the top of the
 * space, and Invite with them.
 *
 * - Everyone sees the members (the count is the header's, not repeated here).
 * - Whoever may manage the space's people (`scope.canManage`: the Owner of a
 *   shared space; the owner and admins of a team space) also gets Invite
 *   people and Invite links, and two more lists when they have anyone in
 *   them: "Invite sent" (invited, not accepted yet) and "Needs your
 *   approval" (came through a link that needs approval; let them in or
 *   decline on the row). Stay renamed both on 15 October 2026 (they were
 *   "Invited" and "Asked to join").
 * - On a shared space (Arthur's joining changes, 16 October 2026): the Owner
 *   picks Contributor or Viewer on each "Needs your approval" row, and sees
 *   "Wants to contribute" above it, the Viewers who asked to contribute, to
 *   allow or decline. A Viewer gets "Ask to contribute" where the Owner has
 *   Invite, and "Request sent" with "Withdraw request" while it is open.
 *
 * The roster is the frame's own members query (same key, so this paints from
 * the warm cache and asks for nothing new); this mounts it again for its own
 * pending and error states. Invite, the links and handing ownership over stay
 * in the members sheet, which owns the `?invite=` param on space routes; the
 * buttons here open the sheet on that step (`scope.openInvite`,
 * `scope.openInviteLinks`).
 */
export function SpacePeoplePanel({ space }: { space: Space }) {
  const scope = useCollabSpaceScope();
  const session = useV2Session();
  const viewerUuid = useAuthStore((state) => state.user?.uuid ?? null);
  const canManage = scope?.canManage ?? false;
  const shared = isSharedSpace(space);
  const viewerMayAsk = scope ? canAskToContribute(scope.membership) : false;

  const membersQuery = useQuery(spacesQueries.members(space.uuid, { viewerId: session.userId }));
  // The invites not accepted yet (`?status=pending`), asked for only by whoever
  // may read them; anyone else is refused with a 403, so they never ask.
  const pendingQuery = useQuery({
    ...spacesQueries.members(space.uuid, { viewerId: session.userId, status: 'pending' }),
    enabled: canManage,
  });
  const requests = useSpaceJoinRequests(space.uuid, canManage);
  // No Viewer or Contributor under each name here (Stay, 17 October 2026);
  // the row's menu still changes it.
  const rosterRow = useSpaceRosterRow({ space, viewerUuid, canManage, shared, showRoles: false });

  const roster = splitRoster(membersQuery.data?.data ?? []);
  const joined = roster.joined;
  const invited = canManage ? invitedRows(roster.invited, pendingQuery.data?.data ?? []) : [];
  const waiting = requests.data?.data.length ?? 0;
  // The reader's own row carries their open ask, if any (RoleRequests).
  const ownRow = joined.find((member) => member.user.uuid === viewerUuid) ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* No count line: the space's header already says how many members it
          has (Arthur, 17 October 2026, item 1: "Keep one"). */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {canManage && scope ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="v2-interactive" onClick={scope.openInviteLinks}>
              <Link2 aria-hidden className="size-4" />
              Invite links
            </Button>
            <Button size="sm" className="v2-interactive" onClick={scope.openInvite}>
              <UserPlus aria-hidden className="size-4" />
              Invite people
            </Button>
          </div>
        ) : viewerMayAsk && membersQuery.isSuccess ? (
          <ContributeAsk spaceUuid={space.uuid} ownRow={ownRow} />
        ) : null}
      </div>

      {membersQuery.isPending ? (
        <RosterSkeleton />
      ) : membersQuery.isError ? (
        <RosterErrorState onRetry={() => void membersQuery.refetch()} />
      ) : (
        <section aria-labelledby="space-people-members">
          <h2 id="space-people-members" className="sr-only">
            Members
          </h2>
          <div className="divide-y divide-border/60">{joined.map((member) => rosterRow(member))}</div>
        </section>
      )}

      {invited.length > 0 ? (
        // Fades in: on a cold cache the list can land after the members.
        <section
          aria-labelledby="space-people-invited"
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
        >
          <h2 id="space-people-invited" className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Invite sent
          </h2>
          <div className="divide-y divide-border/60">{invited.map((member) => rosterRow(member, true))}</div>
        </section>
      ) : null}

      {canManage && shared ? <RoleRequestsSection spaceUuid={space.uuid} /> : null}

      {canManage && waiting > 0 ? (
        <section
          aria-labelledby="space-people-requests"
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
        >
          <h2 id="space-people-requests" className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Needs your approval
          </h2>
          <SpaceJoinRequestsPanel spaceUuid={space.uuid} />
        </section>
      ) : null}
    </div>
  );
}
