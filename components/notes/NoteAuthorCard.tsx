'use client';

import { Calendar, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/common/UserAvatar';
import { cn } from '@/lib/utils';
import type { NoteUser } from '@/types/note';
import type { User } from '@/types/auth';

interface NoteAuthorCardProps {
  author: NoteUser;
  animationDelay?: number;
  className?: string;
}

/**
 * Card displaying note author information
 */
function NoteAuthorCard({
  author,
  animationDelay = 0,
  className,
}: NoteAuthorCardProps) {
  // Format join date if available
  const joinDate = author.created_at
    ? new Date(author.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
      })
    : null;

  // Convert NoteUser to User type for UserAvatar component
  const userForAvatar: User = {
    id: author.id,
    name: author.name,
    email: author.email ?? null,
    role: (author.role as User['role']) ?? 'user',
    is_creator: author.is_creator ?? null,
    is_verified: author.is_verified ?? false,
    auth_provider: (author.auth_provider as User['auth_provider']) ?? 'email',
    avatar_url: author.avatar_url ?? null,
    profile: null,
    created_at: author.created_at ?? new Date().toISOString(),
  };

  return (
    <Card
      className={cn(
        'animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-300',
        className
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <CardContent className="flex items-center gap-4 pt-6">
        {/* Avatar */}
        <UserAvatar
          user={userForAvatar}
          className="h-12 w-12"
        />

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">{author.name}</h3>
            {author.is_creator && (
              <Badge variant="default" className="gap-1 text-[10px]">
                <Star className="h-3 w-3" />
                Creator
              </Badge>
            )}
          </div>
          {joinDate && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Joined {joinDate}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export { NoteAuthorCard };
