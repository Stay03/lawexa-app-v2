'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Radar } from 'lucide-react';

import type { RadarListParams } from '@/types/radar';
import { radarsQueries } from '@/v2/features/radars/queries';
import {
  CountBadge,
  Module,
  ModuleEmpty,
  ModuleError,
  ModuleList,
  ModuleRow,
  ModuleSkeleton,
  RowIconTile,
  formatRelativeTime,
} from '../modules';

/** How many radar rows the home module shows before "All" takes over. */
const MAX_ROWS = 4;

/** Active watches only — the relevant set for a home glance; newest as the
 *  server returns them (list order). */
const RADAR_PARAMS: RadarListParams = {
  status: 'active',
  per_page: MAX_ROWS + 4,
};

/**
 * Radar — a compact glance at the caller's active watches (name, latest-scan
 * line, and unread-report count). Reads the list shape only; `RadarListItem`
 * already carries everything shown, so there's no per-radar scans fetch. Radar
 * names generate asynchronously server-side, so whatever the payload gives is
 * rendered as-is (no polling). Rows navigate to the v1 radar route
 * (`/radars/{uuid}`).
 *
 * v1 surfaces Radar broadly to every signed-in user (main nav, no role gate),
 * so this module gates the same way — mounted whenever WorkHome is signed-in.
 */
export function RadarModule() {
  const [now] = useState(() => Date.now());
  const query = useQuery(radarsQueries.list(RADAR_PARAMS));
  const radars = query.data?.data ?? [];
  const visible = radars.slice(0, MAX_ROWS);

  return (
    <Module title="Radar" icon={Radar} action={{ href: '/radars', label: 'All' }}>
      {query.isPending ? (
        <ModuleSkeleton rows={2} />
      ) : query.isError ? (
        <ModuleError
          message="Couldn't load radars"
          onRetry={() => query.refetch()}
        />
      ) : radars.length === 0 ? (
        <ModuleEmpty
          icon={Radar}
          title="No radars yet"
          action={{ href: '/radars/new', label: 'Create radar' }}
        />
      ) : (
        <ModuleList>
          {visible.map((radar) => {
            const relative = formatRelativeTime(radar.last_scan_at, now);
            const activity = !relative
              ? 'Never scanned'
              : relative === 'now'
                ? 'Scanned just now'
                : `Scanned ${relative} ago`;
            return (
              <ModuleRow
                key={radar.uuid}
                href={`/radars/${radar.uuid}`}
                leading={<RowIconTile icon={Radar} />}
                title={radar.name}
                secondary={activity}
                badge={
                  <CountBadge
                    count={radar.unread_reports_count}
                    label={`${radar.unread_reports_count} new reports`}
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
