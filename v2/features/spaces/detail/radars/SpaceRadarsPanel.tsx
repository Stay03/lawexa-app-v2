'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Plus, Radar } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CollabEmpty } from '@/v2/features/collab/kit/CollabEmpty';
import { collabAccessState } from '@/v2/features/collab/model';
import { useV2Session } from '@/v2/runtime/session-context';
import { FeedLine } from '../content/feed-rows';
import { PagedContent } from '../content/paged-content';
import { uniqueRowsById } from '../../model';
import { spacesQueries } from '../../queries';
import { newSpaceRadarHref, radarRowModel } from './radar-rows';

/**
 * SpaceRadarsPanel — the Radars pill (Radar in Spaces, first part, 26 October
 * 2026): the space's Radars, one row each in the feed's row (`FeedLine`). A
 * row's name says whether it runs, line 2 its schedule and who made it, the
 * time its newest report, and the count under the time this reader's unread
 * reports (read state is per member). A row opens the Radar's own screen;
 * no row has a menu (Stay, 18 October 2026), its actions are on that screen.
 *
 * Every member reads the list. An Owner or Contributor gets "New Radar" in
 * the empty state; the pill bar's gold + is theirs too (`SpaceContentPanel`).
 */
export function SpaceRadarsPanel({ spaceUuid, canAdd }: { spaceUuid: string; canAdd: boolean }) {
  const session = useV2Session();
  const query = useInfiniteQuery({
    ...spacesQueries.radars(spaceUuid, { viewerId: session.userId }),
    enabled: collabAccessState(session) === 'eligible',
  });
  const pages = query.data?.pages;
  const radars = useMemo(() => (pages ? uniqueRowsById(pages, (radar) => radar.uuid) : []), [pages]);
  // Captured once, so no clock read runs in render (React Compiler purity).
  const [now] = useState(() => Date.now());

  return (
    <PagedContent
      tab="radars"
      query={query}
      count={radars.length}
      empty={
        <CollabEmpty
          icon={Radar}
          title="No Radars in this space yet"
          description={
            canAdd
              ? 'A Radar checks for new law on a schedule and posts each report here, for everyone in this space.'
              : 'Contributors and the owner add Radars here. Each report shows in this space.'
          }
          action={
            canAdd ? (
              <Button asChild size="sm">
                <Link href={newSpaceRadarHref(spaceUuid)}>
                  <Plus aria-hidden className="size-4" />
                  New Radar
                </Link>
              </Button>
            ) : undefined
          }
        />
      }
    >
      <ul className="flex flex-col">
        {radars.map((radar) => {
          const row = radarRowModel(radar, spaceUuid, now);
          return (
            <FeedLine
              key={radar.uuid}
              line={{
                icon: Radar,
                warm: row.unread > 0,
                strong: row.unread > 0,
                quiet: radar.status === 'archived',
                title: row.title,
                status: row.state ?? undefined,
                meta: row.meta,
                time: row.time,
                count: {
                  value: row.unread,
                  label: `${row.unread} unread ${row.unread === 1 ? 'report' : 'reports'} from ${row.title}`,
                },
              }}
              render={(className, content) => (
                <Link href={row.href} className={className}>
                  {content}
                </Link>
              )}
            />
          );
        })}
      </ul>
    </PagedContent>
  );
}
