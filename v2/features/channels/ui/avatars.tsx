import { Sparkles } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';

/**
 * avatars — the channel feature's author marks. No green presence dots on
 * avatars, ever: presence is a quiet count in the header only (design-research
 * DIRECTION 7, binding). Phase-5 W2, 2026-08-04.
 *
 * `MemberAvatar` IS RE-EXPORTED, NOT REDEFINED (W5). W2 shipped its own copy
 * because `v2/features/channels/**` and the spaces/organizations surfaces were
 * owned by parallel waves and neither could edit the other's tree; the two
 * copies were identical. That constraint is gone, the component now lives in
 * the shared collab home with the rest of the membership kit, and this line
 * keeps every consumer's single `../ui/avatars` import working.
 */

export { MemberAvatar } from '@/v2/features/collab/membership/MemberAvatar';

/** Branded avatar for Lawexa (`is_ai`) author runs — a Sparkles mark on the
 *  gold tint, matching `MemberAvatar`'s size/className shape. */
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
