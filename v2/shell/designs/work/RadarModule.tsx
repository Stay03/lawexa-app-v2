'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Radar } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { RadarListParams } from '@/types/radar';
import { radarsQueries } from '@/v2/features/radars/queries';
import {
  CountBadge,
  ModuleEmpty,
  ModuleError,
  ModuleRowSkeleton,
  ROW_CLASS,
  WorkModule,
  formatRelativeTime,
} from './primitives';

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
 * so this module gates the same way — mounted whenever WorkHome is signed-in,
 * no role restriction. Empty state stays quiet ("No radars yet").
 */
export function RadarModule() {
  const [now] = useState(() => Date.now());
  const query = useQuery(radarsQueries.list(RADAR_PARAMS));
  const radars = query.data?.data ?? [];
  const visible = radars.slice(0, MAX_ROWS);

  return (
    <WorkModule title="Radar" action={{ href: '/radars', label: 'All' }}>
      {query.isPending ? (
        <ModuleRowSkeleton rows={2} />
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
        <ul className="flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          {visible.map((radar) => {
            const hasUnread = radar.unread_reports_count > 0;
            const relative = radar.last_scan_at
              ? formatRelativeTime(radar.last_scan_at, now)
              : null;
            const activity =
              relative === null
                ? 'Never scanned'
                : relative === 'now'
                  ? 'Scanned just now'
                  : `Scanned ${relative} ago`;
            return (
              <li key={radar.uuid}>
                <Link href={`/radars/${radar.uuid}`} className={ROW_CLASS}>
                  <Radar
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground/70"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={cn(
                        'truncate text-sm',
                        hasUnread
                          ? 'font-semibold text-foreground'
                          : 'font-medium text-foreground/90',
                      )}
                    >
                      {radar.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {activity}
                    </span>
                  </span>
                  <CountBadge
                    count={radar.unread_reports_count}
                    label={`${radar.unread_reports_count} new reports`}
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
