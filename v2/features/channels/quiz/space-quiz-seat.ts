import type { MembershipSubject } from '@/v2/features/spaces/model';
import { viewerContentRole } from '@/v2/features/spaces/model';
import type { SpaceQuizSeat } from './use-space-live-quiz';

/**
 * The Space page's seat for its live quiz, from the membership the Space frame
 * settles: the Space's own `my_role` when the detail stamps it, else the
 * member list (`CollabFrame`). `GET /spaces/{uuid}` may leave `my_role` out,
 * and reading only that made a Space's OWNER a non-member: the quiz they had
 * just hosted there showed as a banner with Join, its `?game=` was stripped,
 * and Join could not open the lobby until the Space was read again (Arthur's
 * live quiz test, 14 November 2026).
 *
 * Undefined while the answer is not in yet, a Space not read or a role that
 * waits on the member list: `useGameMode` then holds `?game=` instead of
 * stripping it from a member whose role has not landed.
 */
export function spaceQuizSeat({
  space,
  membership,
  rosterPending,
}: {
  space: { uuid: string; name: string } | null;
  membership: MembershipSubject;
  rosterPending: boolean;
}): SpaceQuizSeat | undefined {
  if (!space) return undefined;
  if (membership.my_role == null && rosterPending) return undefined;
  return {
    uuid: space.uuid,
    name: space.name,
    isMember: membership.my_role != null,
    contentRole: viewerContentRole(membership),
  };
}
