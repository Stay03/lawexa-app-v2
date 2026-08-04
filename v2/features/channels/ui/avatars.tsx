import { Sparkles } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils/collab';
import type { SlimUser } from '@/types/collab';

/**
 * avatars — the channel feature's member + Lawexa avatars, a v2 port of v1's
 * `MemberAvatar` / `LawexaAvatar` (v1 feature components are boundary-blocked;
 * the `Avatar` primitive underneath is the shared `components/ui` layer).
 * Phase-5 W2, 2026-08-04. No green presence dots on avatars — presence is a
 * quiet count in the header only (design-research DIRECTION 7, binding).
 */

export function MemberAvatar({
  user,
  size = 'default',
  className,
}: {
  /** `null` renders a neutral placeholder (deleted / system author). */
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

/** Branded avatar for Lawexa (`is_ai`) author runs — a Sparkles mark on the
 *  gold tint, matching {@link MemberAvatar}'s size/className shape. */
export function LawexaAvatar({
  size = 'default',
  className,
}: {
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback className="bg-primary/10 text-primary">
        <Sparkles className="size-4" aria-hidden />
      </AvatarFallback>
    </Avatar>
  );
}
