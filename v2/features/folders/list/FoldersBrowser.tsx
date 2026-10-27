'use client';

import { useCallback, useMemo, useState } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { Plus, Upload } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import { useV2Session } from '@/v2/runtime/session-context';
import { useUrlSearch } from '@/v2/runtime/use-url-search';
import { useSearchPosition } from '@/v2/search-position';
import { SearchField } from '@/v2/shell/SearchField';
import { ScreenDock, ScreenDockSearch } from '@/v2/shell/ScreenDock';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import { LIST_COLUMN_DOCKED } from '@/v2/shell/page-columns';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { foldersQueries } from '../queries';
import { folderRow, type FolderRowModel } from '../folder-row-model';
import { useHiddenFolderUuids } from '../folder-mutations';
import { FolderNameDialog, type FolderNameDialogIntent } from '../FolderNameDialog';
import type { FolderRecord } from '../types';
import type { SpaceItemTarget } from '@/v2/features/spaces/content-model';
import { MoveToSpaceDialog } from '@/v2/features/spaces/move/MoveToSpaceDialog';
import { FileListHead } from '../file-list/FileListRow';
import { FolderRow } from './FolderRow';
import { LooseFilesSection, useLooseFileUpload } from './LooseFilesSection';
import { fileKey, folderKey, useFoldersBulk } from './folders-bulk';
import {
  FoldersEmptyState,
  FoldersErrorState,
  FoldersListSkeleton,
  FoldersNextPageSkeleton,
  FoldersSignedOutState,
  FOLDERS_DATE_LABEL,
} from './states';
import { useGuestPassFailed } from '@/v2/runtime/guest-pass';
import { FoldersFallback } from './FoldersFallback';

/**
 * FoldersBrowser — the `/folders` body, and the `useSearchParams` consumer (so
 * it lives under the Suspense boundary in `FoldersScreen`).
 *
 * ── THE ROOT LEVEL, NOT "ALL FOLDERS" ───────────────────────────────────────
 * `my-folders` returns ROOT folders only unless `parent_id` names one — that is
 * the API's own grain, and it is why v2 browses the tree one level at a time
 * (decision 1) instead of pretending to hold the whole thing. This page is the
 * root level; every deeper level is a folder page.
 *
 * ── AND NOT "EVERYONE'S FOLDERS" ────────────────────────────────────────────
 * v1 opened on two tabs, My folders and Explore, and fired BOTH queries on
 * every visit. Explore listed strangers' folders — and, because the feed did
 * not filter by privacy the way the reader expects, the viewer's own PRIVATE
 * folders appeared in it too. It is gone (decision 3): the wire layer does not
 * even carry the endpoint, so there is no tab to fire and nothing to leak.
 *
 * ── THE URL IS THE STATE ────────────────────────────────────────────────────
 * `?search=` is written with the LOUD native-history write (`useUrlSearch`),
 * which this component reads back through `useSearchParams`. `/folders` is a
 * STATIC segment whose server page reads no `searchParams`, so a `router.push`
 * would pay an RSC round trip and re-show `loading.tsx` for a filter the client
 * already applied.
 *
 * ── GUESTS ARE NOT GATED ────────────────────────────────────────────────────
 * A guest token holds FULL folder access (create, nest, fill, rename, delete —
 * all probed on a guest account), so there is no create-account panel here and
 * no bounce. v1's sidebar auth-modal bounce was frontend-only fiction.
 */

/** Stable empty rows reference — a fresh `[]` per render would churn the memo. */
const NO_ROWS: readonly FolderRowModel[] = [];

/**
 * The centred reading column every state shares (`page-columns.ts`), so this
 * page, `/cases`, `/notes` and `/bookmarks` are one measure — the DOCKED
 * variant, because the search pill floats at the bottom here and a `sticky`
 * element needs a containing block a full screen tall.
 *
 * The screen's `h1` is drawn here, so the signed-out panel is under a page that
 * still says what it is and every state carries exactly one heading.
 */
/**
 * The page's column: the "Folders" heading, with the page's own actions on
 * its line when there are any (Stay, 20 October 2026, 00:54 UTC: the header is
 * "Folders" with New folder and Upload), then the page.
 */
function PageShell({ actions, children }: { actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={LIST_COLUMN_DOCKED}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <ScreenTitle className="mb-0 min-w-0 truncate" />
        {actions}
      </div>
      {children}
    </div>
  );
}

export function FoldersBrowser() {
  const { signedIn, userId: viewerId } = useV2Session();
  // A visitor who is not signed in gets a guest pass in a moment
  // (guest-pass.tsx); until then this is a load, not a sign-in wall.
  const guestPassFailed = useGuestPassFailed();
  const { committedSearch, inputValue, onInputChange, onClear } = useUrlSearch();
  const activeSearch = committedSearch.trim();
  // WHERE the field is drawn — the developer switch (`v2/search-position.ts`).
  const searchAtTop = useSearchPosition() === 'top';

  // Frozen at mount for the relative trail labels — the list refetches on every
  // visit (`REFETCH_ON_VISIT`), so the clock and the data move together, and no
  // `Date.now()` runs in render (React Compiler lint).
  const [now] = useState(() => Date.now());

  const [creating, setCreating] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FolderRowModel | null>(null);
  // MOVE TO SPACE (Spaces F3): every folder here is the reader's own. Held
  // after closing so the dialog's exit plays; each open bumps the key.
  const [moveTarget, setMoveTarget] = useState<{
    item: SpaceItemTarget;
    open: boolean;
    key: number;
  } | null>(null);

  // "Upload a file" (build 6): to the viewer's own files, in no folder, which
  // the section under the folders lists.
  const upload = useLooseFileUpload();

  const query = useInfiniteQuery({
    ...foldersQueries.level({
      parentUuid: null,
      search: activeSearch || undefined,
      viewerId,
    }),
    enabled: signedIn,
    // Keep the current results visible (dimmed) while a new SEARCH resolves.
    // Safe here because the tab-shaped hazard does not exist: this list has one
    // stream, so carried-over rows are always the same kind of thing.
    placeholderData: keepPreviousData,
  });

  // Folders whose delete is queued or in flight cannot be painted by anything —
  // not a refetch, not a rehydration (see `useHiddenFolderUuids`).
  const hidden = useHiddenFolderUuids();

  const pages = query.data?.pages;
  const { rows, spaceOf } = useMemo(() => {
    const spaces = new Map<string, FolderRecord['space']>();
    if (!pages) return { rows: NO_ROWS, spaceOf: spaces };
    const mapped: FolderRowModel[] = [];
    for (const page of pages) {
      for (const record of page.data) {
        if (hidden.has(record.uuid)) continue;
        mapped.push(folderRow(record));
        // The space each folder is in, for the move dialog: the row model
        // carries no space, and absent stays absent ("not known").
        spaces.set(record.uuid, record.space);
      }
    }
    return { rows: mapped, spaceOf: spaces };
  }, [pages, hidden]);

  // Bulk select (Arthur, 20 October 2026): the folders above and the files in
  // no folder below, ticked together. The files' ids come from the same query
  // the section reads (one cache entry, no second request).
  const looseQuery = useInfiniteQuery({ ...foldersQueries.looseFiles({ viewerId }), enabled: signedIn && !activeSearch });
  const folderUuids = useMemo(() => rows.map((row) => row.uuid), [rows]);
  const loosePages = looseQuery.data?.pages;
  const fileIds = useMemo(() => (loosePages ?? []).flatMap((page) => page.data.map((file) => file.id)), [loosePages]);
  const bulk = useFoldersBulk({ folderUuids, fileIds });
  const { toggle: toggleSelected, isSelected, selecting, startWith } = bulk;
  const toggleFolder = useCallback((uuid: string) => toggleSelected(folderKey(uuid)), [toggleSelected]);
  // A folder row's hover tick box, on a computer: select mode with it ticked.
  const startWithFolder = useCallback((uuid: string) => startWith(folderKey(uuid)), [startWith]);
  const toggleFile = useCallback((id: number) => toggleSelected(fileKey(id)), [toggleSelected]);
  const looseSelection = useMemo(
    () => (selecting ? { isSelected: (id: number) => isSelected(fileKey(id)), onToggle: toggleFile } : undefined),
    [selecting, isSelected, toggleFile],
  );

  const scrollRootRef = useShellScrollRoot();
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    hasNextPage: query.hasNextPage && !query.isPlaceholderData,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    rootRef: scrollRootRef,
    rootMargin: '320px',
  });

  // The setter is in the dependency list because the React Compiler's lint
  // insists on the dependencies it can INFER, and it does not assume a state
  // setter is stable. It is (React guarantees it), so this is identical at
  // runtime to an empty list and honest to the tool.
  const openRename = useCallback(
    (row: FolderRowModel) => setRenameTarget(row),
    [setRenameTarget],
  );
  // Stable per page of rows, so `FolderRow`'s `memo` holds.
  const openMove = useCallback(
    (row: FolderRowModel) =>
      setMoveTarget((previous) => ({
        item: { type: 'folder', id: row.uuid, name: row.name, space: spaceOf.get(row.uuid) },
        open: true,
        key: (previous?.key ?? 0) + 1,
      })),
    [spaceOf, setMoveTarget],
  );

  // The API's own reason, read once. A 4xx is a REFUSAL the server explained; a
  // 5xx or a network drop is not, and its message ("Network error…") is less
  // useful than the designed copy.
  const apiError = query.error ? extractApiError(query.error) : null;
  const explainedError =
    apiError && apiError.status >= 400 && apiError.status < 500
      ? apiError.message
      : undefined;

  // Every state decision reads the loaded set, never a projection.
  const showSkeleton = query.isPending;
  const showError = query.isError && rows.length === 0;
  const showEmpty = !showSkeleton && !showError && rows.length === 0;
  const showInlineError = query.isError && rows.length > 0;
  // Dim ONLY while a new search is actually resolving, so an errored, settled
  // query can never strand the list at reduced opacity.
  const dim = query.isPlaceholderData && query.isFetching;

  if (!signedIn && !guestPassFailed) return <FoldersFallback />;
  if (!signedIn) {
    return (
      <PageShell>
        <FoldersSignedOutState />
      </PageShell>
    );
  }

  // Static chrome: it renders on the first frame and never waits on data
  // (standards §8i). Built once and rendered in whichever position the
  // developer switch names, so the two placements cannot drift.
  const searchField = (
    <SearchField
      value={inputValue}
      onChange={onInputChange}
      onClear={onClear}
      busy={dim}
      placeholder="Search your folders..."
      label="Search your folders by name"
    />
  );

  const actions = (
    <div className="flex shrink-0 items-center gap-2">
      {selecting
        ? null
        : bulk.startButton(
            cn(
              'v2-interactive inline-flex min-h-11 shrink-0 items-center rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary',
              FOCUS_RING,
            ),
          )}
      <button
        type="button"
        onClick={upload.pick}
        className={cn(
          'v2-interactive inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary',
          FOCUS_RING,
        )}
      >
        <Upload aria-hidden className="size-4" />
        {/* One flex item, so the pill's gap never opens inside the label:
            "Upload" on a phone, "Upload a file" from `sm:` up. */}
        <span>
          Upload<span className="sr-only sm:not-sr-only"> a file</span>
        </span>
      </button>
      {upload.input}

      <button
        type="button"
        onClick={() => setCreating(true)}
        className={cn(
          // 44px, the touch floor and the height of the same pill on a
          // space's tabs (design round 2).
          'v2-interactive inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
          FOCUS_RING,
        )}
      >
        <Plus aria-hidden className="size-4" />
        {/* The label is the affordance on a desktop; on a phone the line
            holds the heading too, so the icon carries it and the accessible
            name comes from the visually-hidden word. */}
        <span className="sr-only sm:not-sr-only">New folder</span>
      </button>
    </div>
  );

  return (
    <PageShell actions={actions}>
      {searchAtTop ? <div className="mb-3">{searchField}</div> : null}

      {/* The ONE live region for this surface. The route fallback's
          announcement is gone by the time an in-page fetch happens and the
          skeleton itself is `aria-hidden`, so without this a first load and a
          search are both silent. Polite, text-only, and derived purely from
          render values, so it can never announce something that is not on
          screen. */}
      <span role="status" aria-live="polite" className="sr-only">
        {showSkeleton ? 'Loading your folders' : ''}
      </span>

      {showSkeleton ? (
        <FoldersListSkeleton />
      ) : showError ? (
        <FoldersErrorState
          message={explainedError}
          onRetry={() => void query.refetch()}
        />
      ) : showEmpty ? (
        <FoldersEmptyState
          search={activeSearch}
          onClearSearch={onClear}
          onNewFolder={() => setCreating(true)}
        />
      ) : (
        <div
          className={cn(
            'transition-opacity duration-200 motion-reduce:transition-none',
            dim && 'pointer-events-none opacity-60',
          )}
        >
          {showInlineError ? (
            <div
              role="alert"
              className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
            >
              <span>Couldn&rsquo;t refresh your folders — showing your last ones.</span>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void query.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : null}

          {/* "Name" and "Modified" over the columns, on a computer. */}
          <FileListHead dateLabel={FOLDERS_DATE_LABEL} />
          <ul className="mt-1 flex flex-col divide-y divide-border/40">
            {rows.map((row, index) => (
              <FolderRow
                key={row.uuid}
                row={row}
                index={index}
                now={now}
                onRename={openRename}
                onMove={openMove}
                markSpace
                selected={selecting ? isSelected(folderKey(row.uuid)) : undefined}
                onToggleSelect={selecting ? toggleFolder : undefined}
                onStartSelect={selecting ? undefined : startWithFolder}
              />
            ))}
          </ul>

          {/* The sentinel, with no end-cap: the files in no folder continue
              the list below it. */}
          <div ref={sentinelRef}>
            {query.isFetchingNextPage ? <FoldersNextPageSkeleton /> : null}
          </div>
        </div>
      )}

      {/* The viewer's files in no folder, under the folders (build 6). */}
      <LooseFilesSection
        viewerId={viewerId}
        now={now}
        enabled={!activeSearch}
        held={showSkeleton}
        selection={looseSelection}
      />
      {/* Room under the last row for the bar while it is up. */}
      {selecting ? <div aria-hidden className="h-36 md:h-24" /> : null}
      {bulk.bar}
      {bulk.dialogs}

      {/* Mounted only while open, so each dialog initialises from the folder it
          is actually naming (see `FolderNameDialog`). */}
      {creating ? (
        <FolderNameDialog
          open
          onOpenChange={setCreating}
          intent={CREATE_ROOT_FOLDER}
        />
      ) : null}
      {moveTarget ? (
        <MoveToSpaceDialog
          key={moveTarget.key}
          item={moveTarget.item}
          open={moveTarget.open}
          onOpenChange={(open) =>
            setMoveTarget((previous) => (previous ? { ...previous, open } : previous))
          }
        />
      ) : null}
      {renameTarget ? (
        <FolderNameDialog
          open
          onOpenChange={(open) => {
            if (!open) setRenameTarget(null);
          }}
          intent={{
            mode: 'rename',
            folder: {
              uuid: renameTarget.uuid,
              // The field starts EMPTY for a folder with no real name: the
              // fallback word is what we call it, not what it is called, and
              // pre-filling it would invite the reader to save our word as
              // their folder's name.
              name: renameTarget.hasName ? renameTarget.name : '',
            },
          }}
        />
      ) : null}

      {/* The floating search pill, LAST in the flow so `mt-auto` has nothing
          after it to fight. It is the only thing that floats here: "New folder"
          stays inline in the row above, which is where every v2 create action
          now lives — Notes, Radar and Spaces each spent a day with a floating
          button instead and the owner turned all three down. */}
      {searchAtTop ? null : (
        <ScreenDock>
          <ScreenDockSearch>{searchField}</ScreenDockSearch>
        </ScreenDock>
      )}
    </PageShell>
  );
}

/** Module-level so the create dialog's intent is one stable reference. */
const CREATE_ROOT_FOLDER: FolderNameDialogIntent = { mode: 'create' };
