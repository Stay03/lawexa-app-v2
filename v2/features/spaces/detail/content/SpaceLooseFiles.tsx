'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { SpaceFile } from '@/types/collab';
import { FileViewers } from '@/v2/features/files/FileViewers';
import { useFileViewer } from '@/v2/features/files/use-file-viewer';
import { listViewable } from '@/v2/features/files/viewable';
import { FileEntryRow } from '@/v2/features/folders/file-list/FileEntryRow';
import { formatEntryDate } from '@/v2/features/folders/file-list/entry-look';
import { looseFileRow, UNNAMED_FILE } from '@/v2/features/folders/loose-file-row-model';
import { LooseFilesSkeleton } from '@/v2/features/folders/list/states';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { uniqueRowsById } from '../../model';
import { spacesQueries } from '../../queries';
import { SpaceFileMenu, type SpaceFileActions } from './SpaceFileMenu';

/**
 * SpaceLooseFiles — the space's files in none of its folders, under the
 * folders on the Folders pill, drawn EXACTLY as the Folders page draws the
 * viewer's own loose files (`LooseFilesSection`): no heading, the same file
 * row (`FileEntryRow`: the kind's glyph, the name, the date on a computer),
 * the same dividers continuing the folders' list, and the same tap (Stay, 22
 * October 2026: "Why didn't you make it consistent with folders as is
 * already?"). A picture, a video or a recording opens in the list's viewer;
 * any other file opens in a new tab. The row's ⋯ holds the space's verbs for
 * the file (`SpaceFileMenu`), "Move to folder" first for whoever may add.
 *
 * The list is `GET /spaces/{uuid}/files?unfiled=1` (backend e76a5957). NOTHING
 * SHOWS WHEN NOTHING IS LOOSE, and nothing shows while the folders are still
 * loading (`held`), so the pill never draws a second skeleton under the
 * first. A refusal (4xx: a reader the server refuses, or a server without the
 * list) hides the section; only a blip offers Try again.
 */
export function SpaceLooseFiles({
  spaceUuid,
  viewerId,
  enabled,
  held,
  afterFolders,
  now,
  actionsFor,
  fileSelect,
}: {
  /** Bulk select from the Folders pill's + (`useSpaceFilesBulk`): while it
   *  runs, each row is its tick box and a tap ticks it. */
  fileSelect?: { isSelected: (id: number) => boolean; toggle: (id: number) => void };
  spaceUuid: string;
  viewerId: number | null;
  /** The content read gate (`useContentReadGate`). */
  enabled: boolean;
  /** The folders above are still loading: the files load too, but wait to show. */
  held: boolean;
  /** Folders are listed above, so the files continue their list under a rule.
   *  With none, the rule stood alone under the pills (backend's check, 23
   *  October 2026). */
  afterFolders: boolean;
  /** The pill's frozen clock, for the date column. */
  now: number;
  /** What a file's ⋯ holds for this reader. */
  actionsFor: (file: SpaceFile) => SpaceFileActions;
}) {
  const query = useInfiniteQuery({ ...spacesQueries.looseFiles(spaceUuid, { viewerId }), enabled });
  const pages = query.data?.pages;
  // Each file once across pages: the list pages by offset while members
  // upload (`uniqueRowsById`'s reason).
  const { files, pictures } = useMemo(() => {
    const unique = pages ? uniqueRowsById(pages, (file) => file.id) : [];
    return { files: unique, pictures: listViewable(unique, UNNAMED_FILE) };
  }, [pages]);
  const viewer = useFileViewer();
  const { view } = viewer;
  const openView = useCallback(
    (file: SpaceFile) => {
      const row = looseFileRow(file);
      if (row.view) view({ id: row.id, name: row.title, kind: row.view, mimeType: file.mime_type, size: file.size });
    },
    [view],
  );

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

  // The anchor is always in the tree, so the pane is found once at mount
  // whether or not the list shows yet.
  return (
    <div ref={anchorRef}>
      {showList ? (
        // NO HEADING: the files continue the folders' list (the Folders page's
        // "clean file system", Stay, 20 October 2026). The top rule continues
        // the list's dividers.
        <section aria-label="Files in no folder" className={cn(afterFolders && 'border-t border-border/40')}>
          {query.isPending ? (
            <LooseFilesSkeleton />
          ) : query.isError && files.length === 0 ? (
            <div role="alert" className="flex items-center justify-between gap-3 px-2 py-4 text-sm text-muted-foreground">
              <span>Couldn&rsquo;t load the space&rsquo;s files.</span>
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => void query.refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-border/40">
                {files.map((file, index) => {
                  const row = looseFileRow(file);
                  return (
                    <FileEntryRow
                      key={file.id}
                      fileId={row.id}
                      kind={row.kind}
                      name={row.title}
                      named={row.hasTitle}
                      date={formatEntryDate(row.createdAt, now)}
                      index={index}
                      onView={row.view ? () => openView(file) : undefined}
                      menu={<SpaceFileMenu file={file} look="row" {...actionsFor(file)} />}
                      select={
                        fileSelect
                          ? { checked: fileSelect.isSelected(file.id), onToggle: () => fileSelect.toggle(file.id) }
                          : undefined
                      }
                    />
                  );
                })}
              </ul>
              <div ref={sentinelRef} className="pt-1">
                {query.isFetchingNextPage ? <LooseFilesSkeleton rows={2} /> : null}
              </div>
            </>
          )}
        </section>
      ) : null}
      <FileViewers viewer={viewer} pictures={pictures} place="space" />
    </div>
  );
}
