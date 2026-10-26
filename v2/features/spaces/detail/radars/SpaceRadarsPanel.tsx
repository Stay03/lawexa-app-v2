'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Plus, Radar } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RadarTabs, type RadarTab } from '@/v2/features/radars/RadarTabs';
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
 *
 * ACTIVE AND ARCHIVED (Tester, live, 26 October 2026): after archiving, the
 * pill said "No Radars in this space yet" with no way to the archived one.
 * A strip above the list switches between the space's live Radars (running
 * and paused, `GET /spaces/{uuid}/radars`) and its archived ones
 * (`?status=archived`), the personal Radar page's strip.
 */
export function SpaceRadarsPanel({ spaceUuid, canAdd }: { spaceUuid: string; canAdd: boolean }) {
  const session = useV2Session();
  const [status, setStatus] = useState<SpaceRadarStatus>('active');
  const query = useInfiniteQuery({
    ...spacesQueries.radars(spaceUuid, {
      viewerId: session.userId,
      status: status === 'archived' ? 'archived' : undefined,
    }),
    enabled: collabAccessState(session) === 'eligible',
  });
  const pages = query.data?.pages;
  const radars = useMemo(() => (pages ? uniqueRowsById(pages, (radar) => radar.uuid) : []), [pages]);
  // AN EMPTY ACTIVE LIST IS NOT AN EMPTY SPACE (techlead, 26 October 2026):
  // when every Radar is archived, "No Radars in this space yet" is untrue. The
  // archived list is asked once, only then, and the empty text says so.
  const activeEmpty = status === 'active' && query.isSuccess && radars.length === 0;
  const archivedProbe = useInfiniteQuery({
    ...spacesQueries.radars(spaceUuid, { viewerId: session.userId, status: 'archived' }),
    enabled: activeEmpty && collabAccessState(session) === 'eligible',
  });
  const hasArchived = (archivedProbe.data?.pages[0]?.data.length ?? 0) > 0;
  // Captured once, so no clock read runs in render (React Compiler purity).
  const [now] = useState(() => Date.now());

  return (
    <div className="flex flex-col gap-3">
      <RadarTabs
        tabs={STATUS_TABS}
        value={status}
        onChange={setStatus}
        ariaLabel="Show the space's active or archived Radars"
        panelId={PANEL_ID}
      />
      <div id={PANEL_ID} role="tabpanel" aria-labelledby={`${PANEL_ID}-tab-${status}`}>
        <PagedContent
          // A new strip choice is a new list: a fresh mount, so its rows enter once.
          key={status}
          tab="radars"
          query={query}
          count={radars.length}
          empty={<RadarsEmpty status={status} hasArchived={hasArchived} spaceUuid={spaceUuid} canAdd={canAdd} />}
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
      </div>
    </div>
  );
}

function RadarsEmpty({
  status,
  hasArchived,
  spaceUuid,
  canAdd,
}: {
  status: SpaceRadarStatus;
  /** On Active: the space has archived Radars, so it is not "yet" empty. */
  hasArchived: boolean;
  spaceUuid: string;
  canAdd: boolean;
}) {
  if (status === 'archived') {
    return (
      <CollabEmpty
        icon={Radar}
        title="No archived Radars"
        description="A Radar archived in this space shows here, with its reports."
      />
    );
  }
  return (
    <CollabEmpty
      icon={Radar}
      title={hasArchived ? 'No active Radars' : 'No Radars in this space yet'}
      description={
        hasArchived
          ? 'Every Radar in this space is archived. They and their reports are under Archived.'
          : canAdd
            ? // Arthur's words, 26 October 2026 (thread b2cacd2d).
              'A Radar tracks laws, regulators, and topics affecting matters in this space'
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
  );
}

type SpaceRadarStatus = 'active' | 'archived';

const STATUS_TABS: readonly RadarTab<SpaceRadarStatus>[] = [
  { id: 'active', label: 'Active' },
  { id: 'archived', label: 'Archived' },
];

const PANEL_ID = 'space-radars-panel';
