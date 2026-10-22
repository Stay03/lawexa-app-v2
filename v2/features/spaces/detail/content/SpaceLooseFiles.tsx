'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import type { SpaceFile, SpaceItem } from '@/types/collab';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { uniqueRowsById } from '../../model';
import { spacesQueries } from '../../queries';
import { LobbySection } from '../lobby-parts';
import { renderFeedRow, type FeedRowMenus } from './feed-rows';
import { SpaceContentNextPageSkeleton, SpaceLooseFilesSkeleton } from './states';

/**
 * SpaceLooseFiles — the space's files in none of its folders, under the
 * folders on the Folders pill (Stay, 22 October 2026: "Space files at the
 * top level, like your Folders page"). The Folders page lists the viewer's
 * own loose files under their folders (`LooseFilesSection`, build 6); this is
 * the same list for a space (`GET /spaces/{uuid}/files?unfiled=1`, backend
 * e76a5957), drawn in the feed's one row (`feed-rows`), so a file reads here
 * as it does on the Files pill, and a tap opens the same card, whose ⋮ adds
 * "Move to folder" for whoever may add to the space.
 *
 * ITS OWN HEADING, unlike the Folders page's list: the folders above sit
 * under day headings, so a run of files with none would read as the last
 * day's. NOTHING SHOWS WHEN NOTHING IS LOOSE, and nothing shows while the
 * folders are still loading (`held`), so the pill never draws a second
 * skeleton under the first. A refusal (4xx: a reader the server refuses, or
 * a server without the list) hides the section; only a blip offers Try again.
 *
 * Its own query and sentinel, so the folders' list keeps its own states.
 */

/** The heading over the files in none of the space's folders. */
export const SPACE_LOOSE_FILES_TITLE = 'Files not in a folder';

/** Stable empty rows, so a pending list does not mint a new array per render. */
const NO_FILES: readonly SpaceFile[] = [];

export function SpaceLooseFiles({
  spaceUuid,
  viewerId,
  enabled,
  held,
  now,
  menus,
}: {
  spaceUuid: string;
  viewerId: number | null;
  /** The content read gate (`useContentReadGate`). */
  enabled: boolean;
  /** The folders above are still loading: the files load too, but wait to show. */
  held: boolean;
  /** The feed's frozen clock, for the rows' times. */
  now: number;
  /** The feed's row rules: the card a file's row opens. */
  menus: FeedRowMenus;
}) {
  const query = useInfiniteQuery({ ...spacesQueries.looseFiles(spaceUuid, { viewerId }), enabled });
  const pages = query.data?.pages;
  // Each file once across pages: the list pages by offset while members
  // upload (`uniqueRowsById`'s reason).
  const files = useMemo(() => (pages ? uniqueRowsById(pages, (file) => file.id) : NO_FILES), [pages]);

  // The pane this list scrolls in, found from the list's own element and set
  // before the sentinel's effect reads it (`PagedContent`'s way).
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    paneRef.current = anchorRef.current?.closest<HTMLElement>('[data-v2-scroller]') ?? null;
    return () => {
      paneRef.current = null;
    };
  }, []);
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    rootRef: paneRef,
    rootMargin: '320px',
  });

  // A 4xx is the server refusing this reader the list, or not having it:
  // nothing to retry, so the section stays away rather than show an error.
  const status = query.error ? extractApiError(query.error).status : 0;
  const refused = status >= 400 && status < 500;
  const showList = enabled && !held && !refused && (query.isPending || query.isError || files.length > 0);

  // The feed's file row, which opens the file's card.
  const row = (file: SpaceFile) => {
    const entry: SpaceItem = { type: 'file', sort_at: file.created_at, item: file };
    return renderFeedRow({ entry, now, menus, key: `file:${file.id}` });
  };

  // The anchor is always in the tree, so the pane is found once at mount
  // whether or not the list shows yet.
  return (
    <div ref={anchorRef}>
      {showList ? (
        <div className="mt-5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          {query.isPending ? (
            <SpaceLooseFilesSkeleton />
          ) : query.isError && files.length === 0 ? (
            <div role="alert" className="flex items-center justify-between gap-3 px-3 py-4 text-sm text-muted-foreground">
              <span>Couldn&rsquo;t load the files not in a folder.</span>
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => void query.refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <LobbySection title={SPACE_LOOSE_FILES_TITLE}>
              <ul className="flex flex-col">{files.map(row)}</ul>
              <div ref={sentinelRef} className="pt-1">
                {query.isFetchingNextPage ? <SpaceContentNextPageSkeleton /> : null}
              </div>
            </LobbySection>
          )}
        </div>
      ) : null}
    </div>
  );
}
