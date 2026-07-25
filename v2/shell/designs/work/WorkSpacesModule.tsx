'use client';

import { useQuery } from '@tanstack/react-query';
import { Boxes, Briefcase } from 'lucide-react';

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
import { WORK_SPACES_PARAMS } from './spaces-source';

/** How many space rows the home module shows before "All" takes over. */
const MAX_ROWS = 5;

/**
 * "Your work spaces" — the Work tab's headline module. Lists the caller's work
 * spaces (`?type=work`) with the §17 activity rollups: an unread dot from
 * `unread_channels_count` and a numeric mention badge from `mention_count`. Both
 * §17 fields are optional (the server omits them for non-members / when
 * membership is unknown) — read graceful (absent → no badge). Rows navigate to
 * the real v1 space route (`/spaces/{uuid}`).
 *
 * ROW HIERARCHY (owner: "'Personal · 4 members' reads redundant"): the secondary
 * line is now the ONE org/personal context slot — the organization name, or
 * "Personal" for a personal space — and the member count is dropped from the home
 * glance (it was the redundant half). The mention pill and unread dot carry the
 * activity signal.
 *
 * Reads the work-spaces query via the shared `WORK_SPACES_PARAMS` key. Only
 * mounted for signed-in users (WorkHome gates it), so no `enabled` guard is
 * needed here.
 */
export function WorkSpacesModule() {
  const query = useQuery(spacesQueries.list(WORK_SPACES_PARAMS));
  const spaces = query.data?.data ?? [];
  const visible = spaces.slice(0, MAX_ROWS);

  return (
    <Module
      title="Your work spaces"
      icon={Briefcase}
      action={{ href: '/spaces', label: 'All' }}
    >
      {/* No `rows` override: the shared median reservation is the one policy and
          it lives in `ModuleSkeleton` (see its docblock for why reserving at
          MAX_ROWS was tried and reverted). */}
      {query.isPending ? (
        <ModuleSkeleton />
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
        <ModuleList>
          {visible.map((space) => {
            const mentions = space.mention_count ?? 0;
            return (
              <ModuleRow
                key={space.uuid}
                href={`/spaces/${space.uuid}`}
                leading={<RowIconTile icon={Briefcase} />}
                title={space.name}
                unread={(space.unread_channels_count ?? 0) > 0}
                secondary={space.organization?.name ?? 'Personal'}
                badge={
                  <CountBadge count={mentions} label={`${mentions} mentions`} />
                }
              />
            );
          })}
        </ModuleList>
      )}
    </Module>
  );
}
