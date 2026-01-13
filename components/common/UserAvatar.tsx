import { cn } from '@/lib/utils';
import type { User } from '@/types/auth';

interface UserAvatarProps {
  user: User | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

function UserAvatar({ user, className, size = 'md' }: UserAvatarProps) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.name}
        className={cn(
          'rounded-full object-cover',
          sizes[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-primary font-medium text-primary-foreground',
        sizes[size],
        className
      )}
    >
      {initials}
    </div>
  );
}

export default UserAvatar;
export { UserAvatar };
