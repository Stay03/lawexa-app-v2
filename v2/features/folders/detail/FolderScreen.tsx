'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import { useV2Session } from '@/v2/runtime/session-context';
import { quietReplaceUrlParams } from '@/v2/runtime/url-params';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { FOCUS_RING, formatRelativeTime } from '@/v2/shell/designs/modules';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { foldersQueries } from '../queries';
import {
  folderCountsLabel,
  folderDepth,
  folderHref,
  folderRow,
  type FolderRowModel,
} from '../folder-row-model';
import {
  FOLDER_ITEM_NOUN,
  folderItemRow,
  type FolderItemRowModel,
} from '../item-row-model';
import { folderItemKey, usePendingFolderItemRemovals } from '../item-mutations';
import { useHiddenFolderUuids } from '../folder-mutations';
import { FolderPublicMark, FolderTile } from '../folder-bits';
import { FolderActionsMenu } from '../FolderActionsMenu';
import { FolderNameDialog } from '../FolderNameDialog';
import { FolderRow } from '../list/FolderRow';
import { FoldersSignedOutState } from '../list/states';
import { FolderBreadcrumb } from './FolderBreadcrumb';
import { FolderItemRow } from './FolderItemRow';
import { ItemTypeTabs } from './ItemTypeTabs';
import { parseFolderItemTab, type FolderItemTab } from './item-tabs';
import { folderStreamState } from './stream-state';
import {
  FolderDeletingState,
  FolderDetailSkeleton,
  FolderEmptyState,
  FolderErrorState,
  FolderItemsErrorState,
  FolderNextPageSkeleton,
  FolderNotFoundState,
  FolderStreamSkeleton,
  HiddenItemsNote,
  SubfolderGapNote,
} from './states';

/**
 * FolderScreen — `/folders/[uuid]`: one folder, and everything in it.
 *
 * ── ONE STREAM, SUBFOLDERS FIRST (decision 5) ───────────────────────────────
 * v1 rendered `children` (unpaginated, from the detail payload) mashed into the
 * paginated items list, then let a client-side "Folders" tab filter the result
 * — a fiction past page one — while a stat line above contradicted both. Here
 * the two sources keep their own natures and are read in the order a person
 * opens a drawer in: the subfolders ARE the tree, so they come first, complete,
 * from `children`; the items follow, paginated, in the server's own
 * newest-filed order.
 *
 * ── THE TYPE FILTER ASKS THE SERVER, AND ONLY APPEARS WHEN IT HELPS ─────────
 * `?type=` is a real server filter (measured), so a filtered view is complete
 * rather than "complete within what happens to be loaded". The strip is drawn
 * only once the unfiltered stream has actually shown more than one type — a
 * filter over a folder holding nothing but cases is furniture — and always
 * while a filter is active, so there is never a filtered view with no way back.
 *
 * ── WHAT THE PAGE KNOWS, AND WHERE THAT KNOWLEDGE STOPS ─────────────────────
 * Two derived facts read the LOADED PAGES ONLY, and neither pretends otherwise:
 * which types the folder holds (so the strip can appear) and how many rows the
 * mapper dropped (so the note can explain the header count). A type that first
 * occurs on page three brings its tab with it when page three loads; a drop on
 * an unloaded page is not counted until it arrives. The alternative — a
 * per-type count endpoint — does not exist on this wire, and guessing from a
 * total would be a claim rather than a count.
 *
 * ── URL STATE IS WRITTEN QUIETLY, AND THAT IS LOAD-BEARING ──────────────────
 * This page sits under a DYNAMIC `[uuid]` segment served through the v2 rewrite
 * proxy — exactly the geometry where a LOUD history write makes Next 16's
 * restore machinery walk a broken param tree and refetch `/folders/undefined`
 * in waves, forever (`url-params.ts` carries the autopsy). So the tab lives in
 * LOCAL STATE with the URL as a quiet mirror: read once on mount, written with
 * the quiet twin, adopted back on popstate.
 *
 * ── WHO SEES WHAT ───────────────────────────────────────────────────────────
 * Every folder endpoint 401s without a token, so a visitor with no session gets
 * the designed sign-in state. A GUEST is not gated in any way: guests own real
 * folders (create, nest, fill, rename, delete — all probed on a guest token).
 * Another account's folder answers 404, the same as one that never existed, and
 * the not-found state does not pretend to know which.
 */

/** Stable empty references — a fresh `[]` per render would churn the memos. */
const NO_ITEM_ROWS: readonly FolderItemRowModel[] = [];
const NO_FOLDER_ROWS: readonly FolderRowModel[] = [];

const PANEL_ID = 'folder-contents-panel';

export function FolderScreen({ uuid }: { uuid: string }) {
  return (
    <Suspense fallback={<FolderDetailFallback />}>
      <FolderBody uuid={uuid} />
    </Suspense>
  );
}

function FolderBody({ uuid }: { uuid: string }) {
  const { signedIn, userId: viewerId } = useV2Session();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Quiet-URL state — initialised from the URL once, then locally owned.
  const [tab, setTabState] = useState<FolderItemTab>(() =>
    parseFolderItemTab(searchParams.get('type')),
  );
  const setTab = useCallback((next: FolderItemTab) => {
    setTabState(next);
    quietReplaceUrlParams({ type: next === 'all' ? null : next });
  }, []);
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      setTabState(parseFolderItemTab(params.get('type')));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Frozen at mount for the relative labels — no `Date.now()` in render.
  const [now] = useState(() => Date.now());

  const [creatingSubfolder, setCreatingSubfolder] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{
    uuid: string;
    name: string;
  } | null>(null);

  const folderQuery = useQuery({
    ...foldersQueries.detail({ uuid, viewerId }),
    enabled: signedIn,
  });

  // ALWAYS MOUNTED, on every tab. It is the All view, and it is also the only
  // evidence for whether this folder holds more than one type — which is what
  // decides whether the filter strip is worth drawing at all.
  const allItemsQuery = useInfiniteQuery({
    ...foldersQueries.items({ uuid, viewerId }),
    enabled: signedIn,
  });

  // When `tab` is 'all' this resolves to the SAME query key as above, disabled —
  // one cache entry, no second request.
  const filteredItemsQuery = useInfiniteQuery({
    ...foldersQueries.items({
      uuid,
      type: tab === 'all' ? undefined : tab,
      viewerId,
    }),
    enabled: signedIn && tab !== 'all',
  });

  const itemsQuery = tab === 'all' ? allItemsQuery : filteredItemsQuery;

  // Folders whose delete is queued or in flight cannot be painted by anything.
  const hidden = useHiddenFolderUuids();
  // Items whose removal from THIS folder is in flight — read ONCE for the whole
  // page, not once per row, so a hundred rows still cost one subscription.
  const pendingRemovals = usePendingFolderItemRemovals(uuid);

  const allPages = allItemsQuery.data?.pages;
  const typesPresent = useMemo(() => {
    const seen = new Set<FolderItemRowModel['type']>();
    if (!allPages) return seen;
    for (const page of allPages) {
      for (const item of page.data) {
        const row = folderItemRow(item);
        if (row) seen.add(row.type);
      }
    }
    return seen;
  }, [allPages]);

  const activePages = itemsQuery.data?.pages;
  const { itemRows, hiddenChats, hiddenFolderItems, hiddenUnknown } = useMemo(() => {
    if (!activePages) {
      return {
        itemRows: NO_ITEM_ROWS,
        hiddenChats: 0,
        hiddenFolderItems: 0,
        hiddenUnknown: 0,
      };
    }
    const mapped: FolderItemRowModel[] = [];
    let chats = 0;
    let folderItems = 0;
    let unknown = 0;
    for (const page of activePages) {
      for (const item of page.data) {
        const row = folderItemRow(item);
        if (row) {
          // A removal in flight is NOT a drop: the row is on its way out at the
          // reader's own request, and counting it as "not shown" would make the
          // footnote below announce their own click back to them. It is simply
          // not rendered — the invalidating refetch that still contains it
          // therefore cannot paint it back (the bookmarks flicker, killed the
          // same way).
          if (!pendingRemovals.has(folderItemKey(row.type, row.contentId))) {
            mapped.push(row);
          }
          continue;
        }
        // A DROP, counted by exactly which kind it is — the footnote makes three
        // different claims and merging them makes each one false (see
        // `HiddenItemsNote`).
        if (item.type === 'conversation') chats += 1;
        else if (item.type === 'folder') folderItems += 1;
        else unknown += 1;
      }
    }
    return {
      itemRows: mapped,
      hiddenChats: chats,
      hiddenFolderItems: folderItems,
      hiddenUnknown: unknown,
    };
  }, [activePages, pendingRemovals]);

  const folder = folderQuery.data?.data;
  const children = folder?.children;
  const { childRows, hiddenChildren } = useMemo(() => {
    if (!children) return { childRows: NO_FOLDER_ROWS, hiddenChildren: 0 };
    const mapped: FolderRowModel[] = [];
    let queuedForDelete = 0;
    for (const child of children) {
      if (hidden.has(child.uuid)) {
        queuedForDelete += 1;
        continue;
      }
      mapped.push(folderRow(child));
    }
    return { childRows: mapped, hiddenChildren: queuedForDelete };
  }, [children, hidden]);

  const scrollRootRef = useShellScrollRoot();
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    hasNextPage: itemsQuery.hasNextPage,
    isFetchingNextPage: itemsQuery.isFetchingNextPage,
    fetchNextPage: itemsQuery.fetchNextPage,
    rootRef: scrollRootRef,
    rootMargin: '320px',
  });

  const openRename = useCallback(
    (row: FolderRowModel) =>
      setRenameTarget({ uuid: row.uuid, name: row.hasName ? row.name : '' }),
    [],
  );

  // Publish the folder's name to the header centre once it is known — through
  // the ROW MODEL, so a folder saved with a blank name reads "Untitled folder"
  // in the header exactly as it does in the h1, instead of leaving the header
  // empty (L6). `folderRow` is pure, so calling it here costs nothing.
  const headerTitle = folder ? folderRow(folder).name : null;
  useEffect(() => {
    if (!headerTitle) return;
    setHeaderContext({ title: headerTitle, confidential: false });
  }, [headerTitle]);
  useEffect(() => () => clearHeaderContext(), []);

  if (!signedIn) {
    return (
      <div className={LIST_COLUMN}>
        <FoldersSignedOutState />
      </div>
    );
  }

  // BACK, INTO A FOLDER YOU JUST DELETED. The route is still in history, and
  // `REFETCH_ON_VISIT` would repaint it completely alive — Delete menu and all
  // — until the queued request lands and flipped it to "isn't here". While the
  // uuid is in the hidden set the honest screen is the one that says so.
  if (hidden.has(uuid)) {
    return (
      <div className={LIST_COLUMN}>
        <FolderDeletingState />
      </div>
    );
  }

  if (folderQuery.isPending) {
    return (
      <div className={LIST_COLUMN}>
        <FolderDetailSkeleton />
      </div>
    );
  }

  if (folderQuery.isError || !folder) {
    const apiError = folderQuery.error ? extractApiError(folderQuery.error) : null;
    // 404 covers "never existed", "deleted" and "someone else's private
    // folder" — the server does not distinguish them and neither does this.
    const missing = apiError?.status === 404 || apiError?.status === 403;
    return (
      <div className={LIST_COLUMN}>
        {missing ? (
          <FolderNotFoundState />
        ) : (
          <FolderErrorState
            message={
              apiError && apiError.status >= 400 && apiError.status < 500
                ? apiError.message
                : undefined
            }
            onRetry={() => void folderQuery.refetch()}
          />
        )}
      </div>
    );
  }

  const row = folderRow(folder);
  const parent = folder.parent ?? null;
  const trail = formatRelativeTime(row.trailAt, now);
  const showTabs = typesPresent.size > 1 || tab !== 'all';
  const showSubfolders = tab === 'all';

  const itemsError = itemsQuery.error ? extractApiError(itemsQuery.error) : null;
  const itemsErrorMessage =
    itemsError && itemsError.status >= 400 && itemsError.status < 500
      ? itemsError.message
      : undefined;

  // WHICH STREAM STATE IS TRUE — one pure decision, made in `stream-state.ts`
  // (which carries the full argument, including the dead end this used to be).
  const {
    hasRows,
    showSkeleton: showStreamSkeleton,
    showError: showStreamError,
    showEmpty,
  } = folderStreamState({
    itemRowCount: itemRows.length,
    childRowCount: childRows.length,
    showSubfolders,
    droppedCount: hiddenChats + hiddenFolderItems + hiddenUnknown,
    isPending: itemsQuery.isPending,
    isError: itemsQuery.isError,
    hasNextPage: itemsQuery.hasNextPage,
    isFetchingNextPage: itemsQuery.isFetchingNextPage,
  });

  // ── THE HEADER COUNT, MADE TO AGREE WITH THE ROWS ────────────────────────
  // Three ways it used to contradict them, and what each one costs:
  //  - a subfolder queued for delete is off the screen but still counted, so
  //    the server's `children_count` is corrected by the rows this page has
  //    actually withheld (the list page's own `hiddenLoaded` subtraction);
  //  - under a type filter no subfolder renders at all and the items shown are
  //    one type, so the whole-folder sentence is replaced by the FILTERED
  //    total the server itself reports for that type;
  //  - a dropped type is still in `items_count`, which the note below explains
  //    rather than the header quietly subtracting a number that would then
  //    change as the reader scrolls.
  const filteredTotal = itemsQuery.data?.pages[0]?.pagination.total;
  const countLabel =
    tab === 'all'
      ? folderCountsLabel(
          folder.items_count,
          Math.max(0, folder.children_count - hiddenChildren),
        )
      : filteredTotal === undefined
        ? null
        : `${filteredTotal} ${FOLDER_ITEM_NOUN[tab]}${filteredTotal === 1 ? '' : 's'}`;

  return (
    <div className={LIST_COLUMN}>
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        <FolderBreadcrumb folder={folder} />

        <header className="mt-3 flex items-start gap-3 border-b border-border/60 pb-5">
          <FolderTile tint={row.tint} size="header" />

          <div className="min-w-0 flex-1">
            <h1
              className={cn(
                'text-xl font-semibold tracking-tight',
                row.hasName ? 'text-foreground' : 'italic text-muted-foreground',
              )}
            >
              {row.name}
            </h1>

            {/* ONE COUNT, and it describes what the stream below is showing —
                see `countLabel` for the three ways it used to disagree. */}
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {/* Each separator is owned by the part that FOLLOWS it, so a
                  missing count (a filtered tab whose total is still in flight)
                  can never leave the line opening on a dot. */}
              {countLabel ? (
                <span className="tabular-nums">{countLabel}</span>
              ) : null}
              {row.isPublic ? (
                <>
                  {countLabel ? <Dot /> : null}
                  <FolderPublicMark />
                </>
              ) : null}
              {trail ? (
                <>
                  {countLabel || row.isPublic ? <Dot /> : null}
                  <span className="tabular-nums">
                    {row.trailKind} {trail}
                  </span>
                </>
              ) : null}
            </p>

            {/* A legacy field: v2 has no description control, so this is only
                ever shown, never written. */}
            {folder.description ? (
              <p className="mt-2 max-w-prose text-sm text-muted-foreground">
                {folder.description}
              </p>
            ) : null}
          </div>

          <FolderActionsMenu
            folder={{
              uuid: folder.uuid,
              name: row.name,
              itemsCount: folder.items_count,
              childrenCount: folder.children_count,
            }}
            onRename={() =>
              setRenameTarget({
                uuid: folder.uuid,
                name: row.hasName ? row.name : '',
              })
            }
            // The route is about to stop existing, so go up one level — to the
            // parent when there is one, otherwise to the library.
            onDeleted={() =>
              router.push(parent ? folderHref(parent.uuid) : '/folders')
            }
          />
        </header>

        <div className="mt-4 flex items-center justify-between gap-3">
          {showTabs ? (
            <ItemTypeTabs value={tab} onChange={setTab} panelId={PANEL_ID} />
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={() => setCreatingSubfolder(true)}
            className={cn(
              'v2-interactive inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary',
              FOCUS_RING,
            )}
          >
            <Plus aria-hidden className="size-4" />
            <span className="sr-only sm:not-sr-only">New subfolder</span>
          </button>
        </div>

        {/* The ONE live region for this surface — polite, text-only, and
            derived purely from render values, so it can never announce
            something that is not on screen. */}
        <span role="status" aria-live="polite" className="sr-only">
          {showStreamSkeleton ? 'Loading this folder' : ''}
        </span>

        {/* `role="tabpanel"` is claimed ONLY while the strip exists: a panel
            with no tablist owning it is a promise to a screen reader that
            nothing on the page keeps. The id stays either way, so the strip's
            `aria-controls` always resolves the moment it appears. */}
        <div
          id={PANEL_ID}
          role={showTabs ? 'tabpanel' : undefined}
          aria-labelledby={showTabs ? `${PANEL_ID}-tab-${tab}` : undefined}
          className="mt-2"
        >
          {/* A failed REFRESH of a stream that still has rows: the folder, the
              trail and the subfolders all stay usable behind it. */}
          {itemsQuery.isError && itemRows.length > 0 ? (
            <div
              role="alert"
              className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
            >
              <span>Couldn&rsquo;t refresh this folder — showing what loaded.</span>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void itemsQuery.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : null}

          {/* ONE list, TWO sources — and the SUBFOLDERS DO NOT WAIT FOR THE
              ITEMS. They arrived with the folder itself (`children` rides on
              the detail payload), so holding them behind the items skeleton
              would hide rows this screen already has in order to look busy.
              The tree paints, and the skeleton below it covers only what is
              genuinely still in flight. */}
          {hasRows ? (
            <ul className="flex flex-col divide-y divide-border/60">
              {/* The tree first, complete: `children` is unpaginated. */}
              {showSubfolders
                ? childRows.map((child, index) => (
                    <FolderRow
                      key={child.uuid}
                      row={child}
                      index={index}
                      now={now}
                      onRename={openRename}
                    />
                  ))
                : null}

              {itemRows.map((item, index) => (
                <FolderItemRow
                  key={`${item.type}-${item.itemId}`}
                  row={item}
                  folderUuid={uuid}
                  index={(showSubfolders ? childRows.length : 0) + index}
                  now={now}
                />
              ))}
            </ul>
          ) : null}

          {showStreamSkeleton ? (
            <FolderStreamSkeleton rows={hasRows ? 2 : 5} />
          ) : showStreamError ? (
            <FolderItemsErrorState
              message={itemsErrorMessage}
              onRetry={() => void itemsQuery.refetch()}
            />
          ) : showEmpty ? (
            <FolderEmptyState
              tab={tab}
              onShowAll={tab === 'all' ? undefined : () => setTab('all')}
            />
          ) : null}

          {/* ── THE NOTES AND THE SENTINEL SIT OUTSIDE THAT CHAIN ────────────
              Both used to hang off its final `else`, which is precisely where
              they were needed least. The note exists to explain a stream with
              nothing in it, and the sentinel is the only thing that can fetch
              the page where the real rows live — so a folder whose first page
              maps entirely to dropped types would have shown neither, and its
              second page could never have loaded. They belong to every settled
              state, and each one already renders nothing when it has nothing
              to say. */}
          {!showStreamSkeleton && !showStreamError ? (
            <>
              {showSubfolders ? (
                <SubfolderGapNote
                  // The RAW array length, not the rendered row count: a
                  // subfolder hidden by its own undo window is not a gap in
                  // the payload, and must not raise this note for six seconds.
                  // No array at all (a shape no probe produced) means there is
                  // nothing to compare, so nothing is claimed.
                  shown={children?.length ?? folder.children_count}
                  counted={folder.children_count}
                />
              ) : null}

              <HiddenItemsNote
                chats={hiddenChats}
                folderItems={hiddenFolderItems}
                unknown={hiddenUnknown}
              />

              {/* Sentinel + end-cap: while more pages exist this sits at the
                  end of the scroll region; once fully loaded the quiet end-cap
                  replaces it. */}
              <div ref={sentinelRef} className="pt-1">
                {itemsQuery.isFetchingNextPage ? (
                  <FolderNextPageSkeleton />
                ) : !itemsQuery.hasNextPage && itemRows.length > 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground/70">
                    Nothing more in this folder
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Mounted only while open, so each dialog initialises from the folder it
          is actually naming (see `FolderNameDialog`). */}
      {creatingSubfolder ? (
        <FolderNameDialog
          open
          onOpenChange={setCreatingSubfolder}
          intent={{
            mode: 'create',
            parent: {
              uuid: folder.uuid,
              name: row.name,
              depth: folderDepth(folder.slug_path),
            },
          }}
        />
      ) : null}
      {renameTarget ? (
        <FolderNameDialog
          open
          onOpenChange={(open) => {
            if (!open) setRenameTarget(null);
          }}
          intent={{ mode: 'rename', folder: renameTarget }}
        />
      ) : null}
    </div>
  );
}

/** The header meta line's separator — decorative, never a word to a reader. */
function Dot() {
  return (
    <span aria-hidden className="text-muted-foreground/40">
      ·
    </span>
  );
}

/**
 * The route fallback — the folder page's own skeleton, held still, in the
 * shared column. `app/v2/folders/loading.tsx` (the SEGMENT boundary, which is
 * what covers every list → folder click) imports this component rather than
 * redrawing it, so the two can never drift. The `[uuid]` segment needs no
 * boundary of its own: the one above it is already this exact shape.
 */
export function FolderDetailFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading this folder
      </span>
      {/* `aria-hidden` + `inert` per standards §8ii: a Suspense fallback is
          DELETED, not reconciled, when content arrives — so anything focusable
          in here would lose focus and caret mid-interaction. */}
      <div aria-hidden inert className={LIST_COLUMN}>
        <FolderDetailSkeleton still />
      </div>
    </>
  );
}
