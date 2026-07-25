'use client';

import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Lock } from 'lucide-react';

import { spacesQueries } from '@/v2/features/spaces/queries';
import {
  CountBadge,
  Module,
  ModuleEmpty,
  ModuleError,
  ModuleList,
  ModuleRow,
  ModuleSkeleton,
  RowIconTile,
} from '../modules';

/**
 * StudySpaces — the Study tab's spaces module (owner #34). Reads the SHARED
 * spaces endpoint filtered to `type: 'study'` (the same `spacesQueries.list` the
 * Work tab reads with `type: 'work'`), so both tabs badge their spaces from ONE
 * call. Rows carry the §17 activity rollups when the caller's membership is known
 * — an unread dot (`unread_channels_count`) and a numeric @mention badge
 * (`mention_count`) — both optional fields, read graceful (absent → no badge).
 *
 * ROW HIERARCHY: identical anatomy to the Work space row (owner: give org context
 * ONE quiet slot) — the secondary line is the organization name (or "Personal"),
 * the redundant `type_label` ("Study", already the tab and the module title) is
 * dropped, and a private space shows a lock beside its name.
 *
 * Rendered by StudyHome only for signed-in users; rows navigate to the real v1
 * space route (`/spaces/{uuid}`).
 */

const MAX_ROWS = 4;

export function StudySpaces() {
  const spacesQuery = useQuery(spacesQueries.list({ type: 'study' }));
  const spaces = (spacesQuery.data?.data ?? []).slice(0, MAX_ROWS);

  return (
    <Module
      title="Study spaces"
      icon={GraduationCap}
      action={{ href: '/spaces', label: 'All' }}
    >
      {spacesQuery.isError ? (
        <ModuleError
          message="Couldn't load your spaces"
          onRetry={() => spacesQuery.refetch()}
        />
      ) : spacesQuery.isPending ? (
        // Shared median reservation — see `ModuleSkeleton`.
        <ModuleSkeleton />
      ) : spaces.length === 0 ? (
        <ModuleEmpty
          icon={GraduationCap}
          title="No study spaces yet"
          action={{ href: '/spaces', label: 'Browse spaces' }}
        />
      ) : (
        <ModuleList>
          {spaces.map((space) => {
            const mentions = space.mention_count ?? 0;
            return (
              <ModuleRow
                key={space.uuid}
                href={`/spaces/${space.uuid}`}
                leading={<RowIconTile icon={GraduationCap} />}
                title={space.name}
                unread={(space.unread_channels_count ?? 0) > 0}
                titleAside={
                  space.is_private ? (
                    <Lock
                      aria-label="Private"
                      className="size-3 shrink-0 text-muted-foreground"
                    />
                  ) : null
                }
                secondary={space.organization?.name ?? 'Personal'}
                badge={
                  <CountBadge
                    count={mentions}
                    label={`${mentions} unread ${mentions === 1 ? 'mention' : 'mentions'}`}
                  />
                }
              />
            );
          })}
        </ModuleList>
      )}
    </Module>
  );
}
