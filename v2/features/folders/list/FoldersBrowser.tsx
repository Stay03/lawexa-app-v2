'use client';

import { useCallback, useMemo, useState } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

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
import { FolderRow } from './FolderRow';
import {
  FoldersEmptyState,
  FoldersErrorState,
  FoldersListSkeleton,
  FoldersNextPageSkeleton,
  FoldersSignedOutState,
} from './states';

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
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={LIST_COLUMN_DOCKED}>
      <ScreenTitle />
      {children}
    </div>
  );
}

export function FoldersBrowser() {
  const { signedIn, userId: viewerId } = useV2Session();
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
  const { rows, hiddenLoaded } = useMemo(() => {
    if (!pages) return { rows: NO_ROWS, hiddenLoaded: 0 };
    const mapped: FolderRowModel[] = [];
    let dropped = 0;
    for (const page of pages) {
      for (const record of page.data) {
        if (hidden.has(record.uuid)) {
          dropped += 1;
          continue;
        }
        mapped.push(folderRow(record));
      }
    }
    return { rows: mapped, hiddenLoaded: dropped };
  }, [pages, hidden]);

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

  // ONE HONEST COUNT: the server's total for this level, less the rows a queued
  // delete has already taken off the screen. Nothing else on this page claims a
  // number, so there is nothing for it to contradict.
  const serverTotal = pages?.[0]?.pagination.total;
  const total =
    typeof serverTotal === 'number' ? Math.max(0, serverTotal - hiddenLoaded) : null;

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

  return (
    <PageShell>
      {searchAtTop ? <div className="mb-3">{searchField}</div> : null}

      <div className="mb-3 flex min-h-9 items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs text-muted-foreground tabular-nums">
          {total === null
            ? ''
            : activeSearch
              ? `${total} ${total === 1 ? 'match' : 'matches'}`
              : `${total} ${total === 1 ? 'folder' : 'folders'}`}
        </p>

        <button
          type="button"
          onClick={() => setCreating(true)}
          className={cn(
            'v2-interactive inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
            FOCUS_RING,
          )}
        >
          <Plus aria-hidden className="size-4" />
          {/* The label is the affordance on a desktop; on a phone the row has
              to hold the count too, so the icon carries it and the accessible
              name comes from the visually-hidden word. */}
          <span className="sr-only sm:not-sr-only">New folder</span>
        </button>
      </div>

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

          <ul className="flex flex-col divide-y divide-border/60">
            {rows.map((row, index) => (
              <FolderRow
                key={row.uuid}
                row={row}
                index={index}
                now={now}
                onRename={openRename}
              />
            ))}
          </ul>

          {/* Sentinel + end-cap: while more pages exist this sits at the end of
              the scroll region; once fully loaded the quiet end-cap replaces
              it. */}
          <div ref={sentinelRef} className="pt-1">
            {query.isFetchingNextPage ? (
              <FoldersNextPageSkeleton />
            ) : !query.hasNextPage ? (
              <p className="py-6 text-center text-xs text-muted-foreground/70">
                No more folders
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* Mounted only while open, so each dialog initialises from the folder it
          is actually naming (see `FolderNameDialog`). */}
      {creating ? (
        <FolderNameDialog
          open
          onOpenChange={setCreating}
          intent={CREATE_ROOT_FOLDER}
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
