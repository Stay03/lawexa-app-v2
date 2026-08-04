import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils/collab';
import type { SlimUser } from '@/types/collab';

/**
 * MemberAvatar — the person mark for every W4 surface: space and organization
 * rosters, the invite picker, and the "invited by" line on an invitation row.
 * Built on the shared `components/ui/avatar` primitive (the sanctioned layer),
 * with `getInitials` from the pure util module.
 *
 * NO PRESENCE DOT, EVER. Presence is a quiet "N online" count in a channel
 * header and nowhere else — green dots on avatars are the "butts in seats"
 * pressure the research names as a design failure (design-research DIRECTION 7,
 * binding; 37signals). Phase-5 W4, 2026-08-04.
 *
 * WHY THIS FILE EXISTS ALONGSIDE the channels feature's own `ui/avatars.tsx`:
 * W4's file ownership stops at the channels boundary (the parallel wave owns
 * every file under `v2/features/channels/**`), so the spaces/organizations/
 * invitations surfaces carry their own copy of this ten-line wrapper rather
 * than reaching across a boundary that is being edited concurrently. Both
 * resolve to the same primitive and the same initials helper, so they cannot
 * drift visually; folding them into one shared collab module is a W5 tidy-up.
 */
export function MemberAvatar({
  user,
  size = 'default',
  className,
}: {
  /** `null` renders a neutral placeholder (a deleted account). */
  user: SlimUser | null;
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
