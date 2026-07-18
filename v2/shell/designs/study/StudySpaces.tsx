'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { spacesQueries } from '@/v2/features/spaces/queries';
import type { Space } from '@/types/collab';
import {
  FOCUS_RING,
  ModuleCard,
  ModuleError,
  ModuleSkeletonRows,
} from './parts';

/**
 * StudySpaces — the Study tab's spaces module (owner #34). Reads the SHARED
 * spaces endpoint filtered to `type: 'study'` (the same `spacesQueries.list` the
 * Work tab reads with `type: 'work'`), so both tabs badge their spaces from ONE
 * call. Rows carry the §17 activity rollups when the caller's membership is known
 * — an unread dot (`unread_channels_count`) and a numeric @mention badge
 * (`mention_count`) — both optional fields, read graceful (absent → no badge).
 *
 * Rendered by StudyHome only for signed-in users; rows navigate to the real v1
 * space route (`/spaces/{uuid}`). Skeleton → content cross-fade, a distinct error
 * (never error-as-empty), and a designed empty state that invites the first space.
 */

const MAX_ROWS = 4;

export function StudySpaces() {
  const spacesQuery = useQuery(spacesQueries.list({ type: 'study' }));
  const spaces = (spacesQuery.data?.data ?? []).slice(0, MAX_ROWS);

  return (
    <ModuleCard title="Study spaces" icon={GraduationCap} action={{ label: 'All', href: '/spaces' }}>
      {spacesQuery.isError ? (
        <ModuleError onRetry={() => spacesQuery.refetch()}>
          Couldn&apos;t load your spaces.
        </ModuleError>
      ) : spacesQuery.isPending ? (
        <ModuleSkeletonRows rows={3} />
      ) : spaces.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">No study spaces yet.</p>
          <Link
            href="/spaces"
            className={cn(
              'v2-interactive rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
              FOCUS_RING,
            )}
          >
            Browse spaces
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col px-2 pb-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          {spaces.map((space) => (
            <li key={space.uuid}>
              <SpaceRow space={space} />
            </li>
          ))}
        </ul>
      )}
    </ModuleCard>
  );
}

function SpaceRow({ space }: { space: Space }) {
  // §17 rollups are optional — a space listed without membership context omits
  // them, so default to "no activity" rather than rendering a phantom badge.
  const hasUnread = (space.unread_channels_count ?? 0) > 0;
  const mentions = space.mention_count ?? 0;
  const org = space.organization?.name ?? 'Personal';

  return (
    <Link
      href={`/spaces/${space.uuid}`}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/60',
        FOCUS_RING,
      )}
    >
      <span
        aria-hidden
        className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-foreground"
      >
        <GraduationCap className="size-4" />
        {/* Unread dot — quiet activity signal; the ring lifts it off the icon
            tile in both themes. */}
        {hasUnread ? (
          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary ring-2 ring-card" />
        ) : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              'truncate text-sm text-foreground',
              hasUnread ? 'font-semibold' : 'font-medium',
            )}
          >
            {space.name}
          </span>
          {space.is_private ? (
            <Lock className="size-3 shrink-0 text-muted-foreground" aria-hidden />
          ) : null}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {space.type_label} · {org}
        </span>
      </span>

      {/* Mention badge — the direct-@you count; a mute never suppresses it, so it
          can show even when the unread dot doesn't. */}
      {mentions > 0 ? (
        <span
          className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground"
          aria-label={`${mentions} unread ${mentions === 1 ? 'mention' : 'mentions'}`}
        >
          {mentions > 99 ? '99+' : mentions}
        </span>
      ) : null}
    </Link>
  );
}
