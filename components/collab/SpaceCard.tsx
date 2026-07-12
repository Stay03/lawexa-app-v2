import Link from 'next/link';
import { Briefcase, GraduationCap, Lock, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Space } from '@/types/collab';

interface SpaceCardProps {
  space: Space;
}

/** A single space in the spaces list — links through to its channels. */
export function SpaceCard({ space }: SpaceCardProps) {
  const Icon = space.type === 'study' ? GraduationCap : Briefcase;

  return (
    <Link
      href={`/spaces/${space.uuid}`}
      className={cn(
        'group flex flex-col rounded-xl border bg-card p-5 transition-colors',
        'hover:border-primary/30 hover:bg-muted/30'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-muted p-2.5 text-muted-foreground transition-colors group-hover:text-foreground">
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{space.name}</h3>
            {space.is_private && (
              <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>{space.type_label}</span>
            <span aria-hidden>·</span>
            {space.organization ? (
              <span className="inline-flex items-center gap-1 truncate">
                {space.organization.name}
              </span>
            ) : (
              <span>Personal</span>
            )}
          </p>
        </div>

        {space.my_role && space.my_role !== 'member' && (
          <Badge variant="secondary" className="shrink-0 capitalize">
            {space.my_role}
          </Badge>
        )}
      </div>

      {space.description && (
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
          {space.description}
        </p>
      )}

      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {space.active_members_count}{' '}
          {space.active_members_count === 1 ? 'member' : 'members'}
        </span>
      </div>
    </Link>
  );
}
