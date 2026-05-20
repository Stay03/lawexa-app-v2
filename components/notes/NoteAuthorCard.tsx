'use client';

import { Star } from 'lucide-react';
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
 * Editorial footer byline — slim row with avatar, name, and join date.
 * No Card chrome; sits beneath a hairline rule.
 */
function NoteAuthorCard({
  author,
  animationDelay = 0,
  className,
}: NoteAuthorCardProps) {
  const joinDate = author.created_at
    ? new Date(author.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
      })
    : null;

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
    <footer
      className={cn(
        'animate-in fade-in-0 fill-mode-both duration-500 mt-6 pt-8',
        'border-t border-foreground/10',
        className
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <p className="note-editorial-eyebrow mb-3">Written by</p>
      <div className="flex items-center gap-4">
        <UserAvatar user={userForAvatar} className="h-12 w-12 ring-1 ring-foreground/10" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3
              className="truncate font-medium"
              style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
            >
              {author.name}
            </h3>
            {author.is_creator && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                title="Verified creator"
              >
                <Star className="h-2.5 w-2.5 fill-current" />
                Creator
              </span>
            )}
          </div>
          {joinDate && (
            <p className="text-sm italic text-muted-foreground">
              Joined {joinDate}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}

export { NoteAuthorCard };
