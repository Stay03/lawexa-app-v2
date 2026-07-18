'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Briefcase } from 'lucide-react';

import { cn } from '@/lib/utils';
import { spacesQueries } from '@/v2/features/spaces/queries';
import {
  CountBadge,
  ModuleEmpty,
  ModuleError,
  ModuleRowSkeleton,
  ROW_CLASS,
  UnreadDot,
  WorkModule,
} from './primitives';
import { WORK_SPACES_PARAMS } from './spaces-source';

/** How many space rows the home module shows before "All" takes over. */
const MAX_ROWS = 5;

/**
 * "Your work spaces" — the Work tab's headline module. Lists the caller's work
 * spaces (`?type=work`) with their org context, member count, and the §17
 * activity rollups: an unread dot from `unread_channels_count` and a numeric
 * mention badge from `mention_count`. Both §17 fields are optional (the server
 * omits them for non-members / when membership is unknown) — rendered
 * gracefully when absent. Rows navigate to the real v1 space route
 * (`/spaces/{uuid}`), which lists that space's channels.
 *
 * Shares its spaces query with "Jump back in" via `WORK_SPACES_PARAMS`, so the
 * two modules cost one fetch. Only mounted for signed-in users (WorkHome gates
 * it), so no `enabled` guard is needed here.
 */
export function WorkSpacesModule() {
  const query = useQuery(spacesQueries.list(WORK_SPACES_PARAMS));
  const spaces = query.data?.data ?? [];
  const visible = spaces.slice(0, MAX_ROWS);

  return (
    <WorkModule title="Your work spaces" action={{ href: '/spaces', label: 'All' }}>
      {query.isPending ? (
        <ModuleRowSkeleton rows={3} />
      ) : query.isError ? (
        <ModuleError
          message="Couldn't load your spaces"
          onRetry={() => query.refetch()}
        />
      ) : spaces.length === 0 ? (
        <ModuleEmpty
          icon={Boxes}
          title="No work spaces yet"
          action={{ href: '/spaces', label: 'Browse spaces' }}
        />
      ) : (
        <ul className="flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          {visible.map((space) => {
            const hasUnread = (space.unread_channels_count ?? 0) > 0;
            const org = space.organization?.name ?? 'Personal';
            const members = space.active_members_count;
            return (
              <li key={space.uuid}>
                <Link href={`/spaces/${space.uuid}`} className={ROW_CLASS}>
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors group-hover:text-foreground"
                  >
                    <Briefcase className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'truncate text-sm',
                          hasUnread
                            ? 'font-semibold text-foreground'
                            : 'font-medium text-foreground/90',
                        )}
                      >
                        {space.name}
                      </span>
                      {hasUnread ? <UnreadDot /> : null}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {org} · {members} {members === 1 ? 'member' : 'members'}
                    </span>
                  </span>
                  <CountBadge
                    count={space.mention_count ?? 0}
                    label={`${space.mention_count} mentions`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </WorkModule>
  );
}
