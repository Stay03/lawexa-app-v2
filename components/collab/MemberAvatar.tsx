import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils/collab';
import type { SlimUser } from '@/types/collab';

interface MemberAvatarProps {
  /** Null renders a neutral placeholder (deleted / system author). */
  user: SlimUser | null;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

/** Slim-user avatar with graceful initials fallback. */
export function MemberAvatar({ user, size = 'default', className }: MemberAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name} />}
      <AvatarFallback>{user ? getInitials(user.name) : '–'}</AvatarFallback>
    </Avatar>
  );
}
