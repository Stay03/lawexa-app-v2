import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils/collab';
import type { SlimUser } from '@/types/collab';

/**
 * MemberAvatar — THE person mark for every collab surface: space, channel and
 * organization rosters, the invite pickers, message author runs, and the
 * "invited by" line on an invitation row. Built on the shared
 * `components/ui/avatar` primitive (the sanctioned layer), with `getInitials`
 * from the pure util module.
 *
 * NO PRESENCE DOT, EVER. Presence is a quiet "N online" count in a channel
 * header and nowhere else — green dots on avatars are the "butts in seats"
 * pressure the research names as a design failure (design-research DIRECTION 7,
 * binding; 37signals). Phase-5 W4, 2026-08-04.
 *
 * ONE COPY SINCE W5. W2 and W4 each shipped an identical wrapper because they
 * ran in parallel and neither wave could edit the other's tree. This is the
 * survivor; the channels feature's `ui/avatars.tsx` re-exports it, so its
 * consumers kept their import path and the duplicate implementation is gone.
 */

/**
 * The least a face needs: something to draw, and something to fall back to.
 *
 * Every `SlimUser` satisfies it — and so does the presence room's
 * `{uuid, name, avatar_url}`, which carries no `username` and must not be
 * typed as though it did. Asking for the two fields this actually reads is
 * what lets both stand in front of it honestly.
 */
export type PersonMark = Pick<SlimUser, 'name' | 'avatar_url'>;

export function MemberAvatar({
  user,
  size = 'default',
  className,
}: {
  /** `null` renders a neutral placeholder (a deleted account). */
  user: PersonMark | null;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      {user?.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
      <AvatarFallback>{user ? getInitials(user.name) : '–'}</AvatarFallback>
    </Avatar>
  );
}
