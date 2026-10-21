'use client';

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import { FileViewers } from '@/v2/features/files/FileViewers';
import { useFileViewer } from '@/v2/features/files/use-file-viewer';
import { listPictures } from '@/v2/features/files/viewable';
import { FILES_ACCEPT, uploadPrecheck } from '@/v2/features/spaces/content-model';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { FolderPicker } from '../picker/FolderPicker';
import { foldersQueries } from '../queries';
import { useUploadLooseFile } from '../file-mutations';
import { looseFileRow, UNNAMED_FILE, type LooseFileRowModel } from '../loose-file-row-model';
import { DeleteLooseFileDialog } from './DeleteLooseFileDialog';
import { LooseFileRow } from './LooseFileRow';
import { LooseFilesSkeleton } from './states';

/**
 * LooseFilesSection — the viewer's files in no folder, listed after the
 * folders as the rest of one file list (build 6: the Folders page is the top
 * level for the viewer's own things, and replaces the old Files page). The
 * files are the viewer's own uploads in none of their own live folders
 * (`GET /files?unfiled=1`), newest first.
 *
 * NOTHING SHOWS WHEN THERE IS NOTHING LOOSE. The first upload brings the
 * files in.
 *
 * A PICTURE OPENS OVER THE LIST, a video or a recording in a player (Stay, 21
 * October 2026); the viewer swipes through the list's loaded pictures
 * (`FileViewers`). Any other file keeps its tab.
 *
 * Its own query, sentinel and dialogs, so the folder list above it keeps its
 * own states and none of this code reaches the page's loading frame.
 */
export function LooseFilesSection({
  viewerId,
  now,
  enabled,
  held,
  selection,
}: {
  viewerId: number | null;
  /** The browser's frozen clock, for "added N ago". */
  now: number;
  /** Off while a search filters the folders: this list has no search. */
  enabled: boolean;
  /** The folders are still loading: the files load too, but wait to show, so
   *  the page never draws a second skeleton under the first. */
  held: boolean;
  /** Bulk select (the Folders page's `useFoldersBulk`): the rows tick instead of opening. */
  selection?: { isSelected: (id: number) => boolean; onToggle: (id: number) => void };
}) {
  const query = useInfiniteQuery({ ...foldersQueries.looseFiles({ viewerId }), enabled });

  const [moving, setMoving] = useState<{ fileId: number; open: boolean; key: number } | null>(null);
  const [deleting, setDeleting] = useState<LooseFileRowModel | null>(null);

  const pages = query.data?.pages;
  const { rows, pictures } = useMemo(() => {
    const files = (pages ?? []).flatMap((page) => page.data);
    return { rows: files.map(looseFileRow), pictures: listPictures(files, UNNAMED_FILE) };
  }, [pages]);
  const viewer = useFileViewer();
  const { view } = viewer;

  const scrollRootRef = useShellScrollRoot();
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    rootRef: scrollRootRef,
    rootMargin: '320px',
  });

  // Stable, so each row's `memo` holds. The setters are listed for the React
  // Compiler's lint, which does not assume a setter is stable.
  const openMove = useCallback(
    (row: LooseFileRowModel) =>
      setMoving((previous) => ({ fileId: row.id, open: true, key: (previous?.key ?? 0) + 1 })),
    [setMoving],
  );
  const openDelete = useCallback((row: LooseFileRowModel) => setDeleting(row), [setDeleting]);
  const openView = useCallback(
    (row: LooseFileRowModel) => {
      if (row.view) view({ id: row.id, name: row.title, kind: row.view });
    },
    [view],
  );

  // A 4xx is the server refusing this viewer the list (a guest's access to
  // `/files` is unprobed), not a blip: there is nothing to retry, so the
  // section stays away rather than show an error under the folders.
  const status = query.error ? extractApiError(query.error).status : 0;
  const refused = status >= 400 && status < 500;
  // The list leaves when a search is on or nothing is loose. The dialogs stay
  // either way: filing the last loose file empties the list while its picker
  // is still open, and the picker's Undo has to outlive it.
  const showList =
    enabled && !held && !refused && (query.isPending || query.isError || rows.length > 0);

  return (
    <>
      {showList ? (
        // NO HEADING: the files continue the folders' list, one line each, the
        // way a file manager lists a folder's folders and then its files (Stay,
        // 20 October 2026, 00:54 UTC: "a clean file system"). The top rule
        // continues the list's dividers.
        <section aria-label="Files in no folder" className="border-t border-border/40">
          {query.isPending ? (
            <LooseFilesSkeleton />
          ) : query.isError && rows.length === 0 ? (
            <div role="alert" className="flex items-center justify-between gap-3 px-2 py-4 text-sm text-muted-foreground">
              <span>Couldn&rsquo;t load your files.</span>
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => void query.refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-border/40">
                {rows.map((row, index) => (
                  <LooseFileRow
                    key={row.id}
                    row={row}
                    index={index}
                    now={now}
                    onView={openView}
                    onMove={openMove}
                    onDelete={openDelete}
                    selected={selection?.isSelected(row.id)}
                    onToggleSelect={selection?.onToggle}
                  />
                ))}
              </ul>
              <div ref={sentinelRef} className="pt-1">
                {query.isFetchingNextPage ? <LooseFilesSkeleton rows={2} /> : null}
              </div>
            </>
          )}
        </section>
      ) : null}

      {/* Held after closing so the picker's exit plays; each open bumps the key. */}
      {moving ? (
        <FolderPicker
          key={moving.key}
          target={{ type: 'file', contentId: moving.fileId }}
          title="Move to folder"
          open={moving.open}
          onOpenChange={(open) => setMoving((previous) => (previous ? { ...previous, open } : previous))}
        />
      ) : null}
      {deleting ? (
        <DeleteLooseFileDialog
          file={{ id: deleting.id, name: deleting.title }}
          open
          onOpenChange={(open) => {
            if (!open) setDeleting(null);
          }}
        />
      ) : null}
      {/* Mounted with the dialogs, so a viewer open on the last loose file as
          it is filed away can still play its exit. */}
      <FileViewers viewer={viewer} pictures={pictures} place="files" />
    </>
  );
}

/**
 * "Upload a file" on the Folders page: the picked files go to the viewer's own
 * files, in no folder, and appear in the list under the folders. Each file
 * is checked against the upload rules first, and its toast walks from
 * "Uploading" to its outcome in place.
 */
export function useLooseFileUpload(): { pick: () => void; input: ReactNode } {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadLooseFile();
  const uploadAsync = upload.mutateAsync;

  const send = (file: File) => {
    const refusal = uploadPrecheck(file, 'a folder');
    if (refusal) {
      toast.error(refusal);
      return;
    }
    const id = toast.loading(`Uploading “${file.name}”`);
    uploadAsync(file).then(
      () => toast.success(`Uploaded “${file.name}”`, { id }),
      (error: unknown) =>
        toast.error(`Couldn’t upload “${file.name}”. ${extractApiError(error).message}`, { id }),
    );
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept={FILES_ACCEPT}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(event) => {
        for (const file of Array.from(event.target.files ?? [])) send(file);
        // Cleared so choosing the same file again still fires a change.
        event.target.value = '';
      }}
    />
  );

  return { pick: () => inputRef.current?.click(), input };
}
