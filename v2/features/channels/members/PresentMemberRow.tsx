import { MemberAvatar } from '../ui/avatars';
import type { RosterRow } from './roster-groups';

/**
 * PresentMemberRow — someone standing in the room that the fetched roster page
 * does not contain.
 *
 * There are two honest ways to be in this state, and both are ordinary:
 *
 *  - The roster fetches one page of a hundred. In a bigger channel, a person who
 *    is here right now can simply be further down the list than the page we
 *    have.
 *  - In a THREAD the roster is the follower list, while the presence room admits
 *    every member of the parent channel. So a person can be genuinely here and
 *    genuinely not a follower.
 *
 * It shows exactly what presence knows: the face and the name. No role chip,
 * because we do not know their role, and no management menu, because the verbs
 * need a member record to act on. Inventing either would be worse than the gap.
 */
export function PresentMemberRow({
  row,
  isSelf = false,
}: {
  row: RosterRow;
  isSelf?: boolean;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 py-2">
      <MemberAvatar
        user={{ name: row.name, avatar_url: row.avatarUrl }}
        size="sm"
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{row.name}</span>
          {isSelf && <span className="text-xs text-muted-foreground">You</span>}
        </div>
      </div>
    </div>
  );
}
