'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Blocks, FolderOutput, Pencil, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import { useV2Session } from '@/v2/runtime/session-context';
import { quietReplaceUrlParams } from '@/v2/runtime/url-params';
import {
  clearScreenContext,
  setScreenContext,
  type ScreenAction,
  type ScreenBack,
} from '@/v2/shell/screen-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { foldersQueries } from '../queries';
import {
  folderDepth,
  folderHref,
  folderRow,
  type FolderRowModel,
} from '../folder-row-model';
import {
  folderItemRow,
  type FolderItemFileRow,
  type FolderItemRowModel,
} from '../item-row-model';
import type { ViewerImage } from '@/v2/features/channels/feed/image-target';
import { FileViewers } from '@/v2/features/files/FileViewers';
import { useFileViewer } from '@/v2/features/files/use-file-viewer';
import { viewerImage } from '@/v2/features/files/viewable';
import { folderItemKey, usePendingFolderItemRemovals, type FolderItemTarget } from '../item-mutations';
import {
  useDeleteFolderWithUndo,
  useHiddenFolderUuids,
  type DeletableFolder,
} from '../folder-mutations';
import { useFolderPeek } from '../folder-peek';
import { FOLDER_HEADING_TYPE } from '../folder-bits';
import { FileListHead } from '../file-list/FileListRow';
import './folder-arrive.css';
import { FolderNameDialog } from '../FolderNameDialog';
import { FolderPicker } from '../picker/FolderPicker';
import { MoveToSpaceDialog } from '@/v2/features/spaces/move/MoveToSpaceDialog';
import { canRemoveFromSpace } from '@/v2/features/spaces/content-model';
import { canAddContent } from '@/v2/features/spaces/model';
import { RemoveFromSpaceDialog } from '@/v2/features/spaces/detail/content/RemoveFromSpaceDialog';
import { spacesQueries } from '@/v2/features/spaces/queries';
import { FolderRow } from '../list/FolderRow';
import { useFolderItemsBulk } from './folder-items-bulk';
import { SpaceFolderLine } from '../space-mark';
import { FoldersSignedOutState } from '../list/states';
import { FolderBreadcrumb } from './FolderBreadcrumb';
import {
  FolderAddButtons,
  FolderAddMenu,
  SpaceFilesDialog,
  useFolderUpload,
  type AddChoices,
} from './FolderAdd';
import { FolderDetailFallback } from './FolderDetailFallback';
import { LibraryPicker } from './LibraryPicker';
import { FolderItemRow } from './FolderItemRow';
import { ItemTypeTabs } from './ItemTypeTabs';
import { useScrolledTitle } from './use-scrolled-title';
import { parseFolderItemTab, type FolderItemTab } from './item-tabs';
import { folderStreamState } from './stream-state';
import {
  FolderDeletingState,
  FolderEmptyState,
  FolderErrorState,
  FolderItemsErrorState,
  FolderNextPageSkeleton,
  FolderNotFoundState,
  FolderStreamSkeleton,
  HiddenItemsNote,
  SubfolderGapNote,
} from './states';
import { useGuestPassFailed } from '@/v2/runtime/guest-pass';
import { useTabTitle } from '@/v2/shell/use-tab-title';

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
 * mapper dropped (so the note can say what is not shown). A type that first
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
const NO_PICTURES: readonly ViewerImage[] = [];
const NO_FOLDER_ROWS: readonly FolderRowModel[] = [];
const NO_SCREEN_ACTIONS: readonly ScreenAction[] = [];

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
  // A visitor who is not signed in gets a guest pass in a moment
  // (guest-pass.tsx); until then this is a load, not a sign-in wall.
  const guestPassFailed = useGuestPassFailed();
  const router = useRouter();
  const pathname = usePathname() ?? '';
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
  // Move to space (Spaces F3). Held after closing so the dialog's exit plays;
  // each open bumps the key, so it starts clean.
  const [move, setMove] = useState({ open: false, key: 0 });
  // Files from this space and the library picker (item 8), held the same way.
  const [spaceFiles, setSpaceFiles] = useState({ open: false, key: 0 });
  const [library, setLibrary] = useState({ open: false, key: 0 });
  // The folder's picture viewer and player (Stay, 21 October 2026: "should
  // work in folders and space folders"); `FileViewers` draws them.
  const viewer = useFileViewer();
  const { view } = viewer;
  // Move a file to another folder (Stay, 22 October 2026): the picker on this
  // folder's own list (the space's folders in a space folder), which files it
  // there and takes it out of here. Held the same way; stable, so the rows'
  // `memo` holds.
  const [moveToFolder, setMoveToFolder] = useState<{
    target: FolderItemTarget;
    open: boolean;
    key: number;
  } | null>(null);
  const openMoveToFolder = useCallback(
    (item: FolderItemRowModel) =>
      setMoveToFolder((previous) => ({
        target: { type: item.type, contentId: item.contentId },
        open: true,
        key: (previous?.key ?? 0) + 1,
      })),
    [],
  );

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
  const { itemRows, pictures, hiddenChats, hiddenFolderItems, hiddenUnknown } = useMemo(() => {
    if (!activePages) {
      return {
        itemRows: NO_ITEM_ROWS,
        pictures: NO_PICTURES,
        hiddenChats: 0,
        hiddenFolderItems: 0,
        hiddenUnknown: 0,
      };
    }
    const mapped: FolderItemRowModel[] = [];
    // The stream's viewable files, in its order: what the viewer swipes through.
    const shownPictures: ViewerImage[] = [];
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
            if (item.type === 'file' && row.type === 'file' && row.view && row.view !== 'pdf') {
              shownPictures.push(viewerImage(item.content, row.title, row.view));
            }
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
      pictures: shownPictures,
      hiddenChats: chats,
      hiddenFolderItems: folderItems,
      hiddenUnknown: unknown,
    };
  }, [activePages, pendingRemovals]);

  const folder = folderQuery.data?.data;
  const children = folder?.children;
  const childRows = useMemo(() => {
    if (!children) return NO_FOLDER_ROWS;
    return children.filter((child) => !hidden.has(child.uuid)).map((child) => folderRow(child));
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
  // A file row that shows here: a picture in the viewer, media in the player.
  const openView = useCallback(
    (row: FolderItemFileRow) => {
      if (row.view) view({ id: row.contentId, name: row.title, kind: row.view });
    },
    [view],
  );

  // The folder's name through the ROW MODEL, so a folder saved with a blank
  // name reads "Untitled folder" in the bar exactly as it does in the h1 (L6).
  // `folderRow` is pure, so memoising it here costs one object.
  const headerRow = useMemo(() => (folder ? folderRow(folder) : null), [folder]);
  useTabTitle(headerRow?.name);
  // The name is the page's heading at every width; the phone bar carries it
  // only once that heading has scrolled away (item 7, `use-scrolled-title.ts`).
  const headingRef = useScrolledTitle(headerRow?.name ?? null);
  // The tapped row's tile and name (`folder-peek.ts`, speed step 5), drawn by
  // the loading frame where the header puts them. They stay still when the
  // folder arrives; everything else fades (`folder-arrive.css`). Decided once,
  // at mount.
  const peek = useFolderPeek(uuid);
  const [arrival] = useState(() => (folderQuery.isPending && peek !== null ? 'peeked' : 'fade'));

  /**
   * ── THE FOLDER'S OWN CONTROLS LIVE IN THE BAR NOW (phase 7) ───────────────
   *
   * This page carried a kebab at y124, in its header block, under a shell bar
   * that already had one at the top right: two identical glyphs, two different
   * menus, and nothing on the outside to say which held Delete. Rename and
   * Delete are published to the bar's single overflow instead
   * (`v2/shell/screen-context.ts`).
   *
   * DELETE STILL CANNOT SHIP WITHOUT ITS UNDO. `FolderActionsMenu` used to own
   * that guarantee by owning the press; the guarantee actually lives in
   * `useDeleteFolderWithUndo`, which is what is called here — the undo window
   * opens BEFORE the request, so nothing has been sent while it is open. The
   * list row keeps the menu component unchanged; only this page folds.
   *
   * MOVE TO SPACE JOINS THEM FOR THE FOLDER'S OWNER (Spaces F3). A member of a
   * space can open another member's folder here, and moving it is not theirs
   * to do, so the row waits for `folder.user` to name the viewer.
   *
   * THIS MENU IS THE FOLDER'S ONE MENU NOW (Stay, 18 October 2026: no "…" on a
   * space's rows; each item's actions live in its own page's ⋮). So it holds
   * everything the space row's menu did, by the same rules: Rename and Delete
   * for the folder's creator only (another member of the space was offered
   * both and refused with a 403), the move worded "Change space" for a folder
   * in a space, and "Remove from space" for the space's Owner.
   *
   * THE WAY BACK IS PUBLISHED WITH THEM, because a nested folder's parent is a
   * fact about the payload and not about the address. `null` until the folder
   * lands, which leaves the route default (`/folders`) standing rather than
   * leaving the reader with no way up during the fetch.
   */
  const parentFolder = folder?.parent ?? null;
  const back = useMemo<ScreenBack | null>(
    () =>
      parentFolder
        ? {
            href: folderHref(parentFolder.uuid),
            label: `Back to ${parentFolder.name}`,
          }
        : null,
    [parentFolder],
  );
  const deleteFolder = useDeleteFolderWithUndo();
  // The space a folder sits in, for whether this reader is its Owner (who may
  // take any folder out of it). The folder's own `space` block names it only.
  const folderSpace = folder?.space ?? null;
  const spaceQuery = useQuery({
    ...spacesQueries.detail(folderSpace?.uuid ?? '', { viewerId }),
    enabled: signedIn && folderSpace !== null,
  });
  const spaceDetail = folderSpace ? (spaceQuery.data?.data ?? null) : null;
  const ownsSpace = spaceDetail !== null && canRemoveFromSpace(spaceDetail);
  // Remove from space, held after closing so the dialog's exit plays.
  const [removing, setRemoving] = useState({ open: false, key: 0 });
  // Who may add to the folder and take items out of it
  // (`FolderService::canManageItems`): outside a space, its creator; in a
  // space, the space's Owner and every Contributor (Stay, 18 October 2026:
  // "a space is a cowork place so any contributor can contribute"). A Viewer
  // only reads. Renaming, moving and deleting the folder stay with its
  // creator (`owned`, below). While the space's own answer is on its way the
  // controls wait rather than appear and vanish.
  const canManageItems =
    viewerId !== null &&
    (folderSpace === null ? folder?.user?.id === viewerId : spaceDetail !== null && canAddContent(spaceDetail));
  const upload = useFolderUpload({
    uuid,
    name: headerRow?.name ?? '',
    space: folder?.space ?? null,
  });
  // Bulk select (Arthur, 20 October 2026): the folder's items, for those who
  // may take them out (`canManageItems`).
  const bulk = useFolderItemsBulk({ folderUuid: uuid, items: itemRows });
  const { toggle: toggleSelected, isSelected, selecting, startWith } = bulk;
  const toggleItem = useCallback(
    (row: FolderItemRowModel) => toggleSelected(`${row.type}:${row.contentId}`),
    [toggleSelected],
  );
  // A row's tick on hover, on a computer: select mode with it ticked (Arthur,
  // 29 October 2026, 07:05Z, thread 8aa04be0: "why is there no tick in the
  // space folder"). Only the Select button began it here before, so no row
  // of any folder, a Space's or the reader's own, showed a tick on hover.
  const startWithItem = useCallback(
    (row: FolderItemRowModel) => startWith(`${row.type}:${row.contentId}`),
    [startWith],
  );
  const actions = useMemo<readonly ScreenAction[]>(() => {
    if (!folder || !headerRow) return NO_SCREEN_ACTIONS;
    const target: DeletableFolder = {
      uuid: folder.uuid,
      name: headerRow.name,
      itemsCount: folder.items_count,
      childrenCount: folder.children_count,
    };
    // The dialog opens on the REAL name, so a folder saved blank offers an
    // empty field to type into rather than the words "Untitled folder".
    const editableName = headerRow.hasName ? headerRow.name : '';
    const owned = viewerId !== null && folder.user?.id === viewerId;
    const ownerActions: ScreenAction[] = owned
      ? [
          {
            id: 'rename',
            label: 'Rename',
            icon: Pencil,
            onSelect: () => setRenameTarget({ uuid: target.uuid, name: editableName }),
          },
          {
            id: 'move-to-space',
            // A folder already in a space changes space (Arthur, item 6).
            label: folder.space ? 'Change space' : 'Move to space',
            icon: Blocks,
            onSelect: () => setMove((previous) => ({ open: true, key: previous.key + 1 })),
          },
        ]
      : [];
    const spaceActions: ScreenAction[] =
      folder.space && ownsSpace
        ? [
            {
              id: 'remove-from-space',
              label: 'Remove from space',
              icon: FolderOutput,
              onSelect: () => setRemoving((previous) => ({ open: true, key: previous.key + 1 })),
            },
          ]
        : [];
    const deleteAction: ScreenAction[] = owned
      ? [
          {
            id: 'delete',
            label: 'Delete folder',
            icon: Trash2,
            destructive: true,
            onSelect: () => {
              deleteFolder(target);
              // The route is about to stop existing, so go up one level — to the
              // parent when there is one, otherwise to the library.
              router.push(parentFolder ? folderHref(parentFolder.uuid) : '/folders');
            },
          },
        ]
      : [];
    return [...ownerActions, ...spaceActions, ...deleteAction];
  }, [folder, headerRow, parentFolder, deleteFolder, router, viewerId, ownsSpace]);

  useEffect(() => {
    setScreenContext({ pathname, back, actions });
  }, [pathname, back, actions]);
  useEffect(() => () => clearScreenContext(), []);

  if (!signedIn && !guestPassFailed) return <FolderDetailFallback />;
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

  // The route's loading shape, a tapped row's tile and name included, so the
  // hand-off from the boundary to this wait moves nothing.
  if (folderQuery.isPending) return <FolderDetailFallback />;

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
  const space = folder.space ?? null;
  // The ways into this folder (items 8 and 9), for whoever may add.
  const addChoices: AddChoices | null = canManageItems
    ? {
        newSubfolder: () => setCreatingSubfolder(true),
        fromSpace: space ? () => setSpaceFiles((previous) => ({ open: true, key: previous.key + 1 })) : null,
        upload: upload.pick,
        library: () => setLibrary((previous) => ({ open: true, key: previous.key + 1 })),
      }
    : null;
  // Select, for whoever may manage the items, once there are items to pick.
  const showSelect = canManageItems && itemRows.length > 0 && !selecting;
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

  return (
    <div className={LIST_COLUMN}>
      <div
        className={
          arrival === 'peeked'
            ? 'v2-folder-arrive-peeked'
            : 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300'
        }
      >
        <FolderBreadcrumb folder={folder} />

        {/* THE HEADER IS THE FOLDER'S NAME AND ITS ADD (folder page B, Stay, 20
            October 2026, 00:49 UTC). No tile, no counts, no Public mark and no
            times: the list below says what the folder holds. The name is the
            page's heading at every width (Arthur, item 7) and wraps to two
            lines rather than being cut; the phone bar stays empty while it is
            on screen (`useScrolledTitle`). Rename and Delete are in the bar's
            one menu. `sm:mt-3`: below `sm:` the trail above renders nothing.

            ON A PHONE THE NAME HAS THE WHOLE WIDTH (Tester, 25 October 2026:
            "Adebayo v Kestrel Haulage..." was cut short beside Select and
            Add). Below `sm:` the header is one column: the name, then the
            Space it is in, then Select and Add on their own row. From `sm:`
            the name and the buttons share the first row, as before, and the
            Space line runs under both. */}
        <header className="grid grid-cols-1 items-start gap-x-3 gap-y-2 pb-3 sm:mt-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <h1
            ref={headingRef}
            title={row.name}
            className={cn(
              'line-clamp-2 min-w-0 flex-1 break-words',
              FOLDER_HEADING_TYPE,
              row.hasName ? 'text-foreground' : 'italic text-muted-foreground',
            )}
          >
            {row.name}
          </h1>
          {/* A folder in a Space says which one, under its name, as a link to the
              Space (Stay picked C1, 20 October 2026). */}
          {folder.space ? (
            <SpaceFolderLine space={folder.space} className="mt-0 mb-0 sm:col-span-2 sm:row-start-2" />
          ) : null}
          {/* Only those who may add (items 8 and 9). */}
          {showSelect || addChoices ? (
            <div className="flex items-center gap-3 sm:col-start-2 sm:row-start-1">
              {showSelect
                ? bulk.startButton(
                    cn(
                      'v2-interactive inline-flex min-h-9 shrink-0 items-center rounded-full border border-border px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary',
                      FOCUS_RING,
                    ),
                  )
                : null}
              {addChoices ? <FolderAddMenu choices={addChoices} /> : null}
            </div>
          ) : null}
        </header>

        {/* A legacy field: v2 has no description control, so this is only
            ever shown, never written. */}
        {folder.description ? (
          <p className="-mt-1 mb-3 max-w-prose text-sm text-muted-foreground">
            {folder.description}
          </p>
        ) : null}

        {/* The type strip, only once the folder holds more than one type. */}
        {showTabs ? (
          <div className="mb-3">
            <ItemTypeTabs value={tab} onChange={setTab} panelId={PANEL_ID} />
          </div>
        ) : null}
        {addChoices ? upload.input : null}
        {/* Room under the last row for the bar while it is up. */}
        {selecting ? <div aria-hidden className="h-36 md:h-24" /> : null}
        {bulk.bar}
        {bulk.dialogs}

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
            <>
              {/* "Name" and "Added" over the columns, on a computer, with the
                  select-all tick for whoever may take items out. */}
              <FileListHead selectAll={canManageItems && itemRows.length > 0 ? bulk.headSelectAll : undefined} />
              <ul className="mt-1 flex flex-col divide-y divide-border/40">
                {/* The tree first, complete: `children` is unpaginated. */}
                {showSubfolders
                  ? childRows.map((child, index) => (
                      <FolderRow
                        key={child.uuid}
                        row={child}
                        index={index}
                        now={now}
                        onRename={openRename}
                        selecting={selecting}
                      />
                    ))
                  : null}

                {itemRows.map((item, index) => (
                  <FolderItemRow
                    key={`${item.type}-${item.itemId}`}
                    row={item}
                    folderUuid={uuid}
                    canRemove={canManageItems}
                    onMoveToFolder={openMoveToFolder}
                    index={(showSubfolders ? childRows.length : 0) + index}
                    now={now}
                    onView={openView}
                    selected={selecting ? isSelected(`${item.type}:${item.contentId}`) : undefined}
                    onToggleSelect={selecting ? toggleItem : undefined}
                    onStartSelect={canManageItems && !selecting ? startWithItem : undefined}
                  />
                ))}
              </ul>
            </>
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
              add={addChoices ? <FolderAddButtons choices={addChoices} /> : null}
              inSpace={space !== null}
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

      {/* The folder's picture viewer and player, over the list. */}
      <FileViewers viewer={viewer} pictures={pictures} place="folder" />

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
      {spaceFiles.key > 0 && space ? (
        <SpaceFilesDialog
          key={spaceFiles.key}
          open={spaceFiles.open}
          onOpenChange={(open) => setSpaceFiles((previous) => ({ ...previous, open }))}
          folder={{ uuid: folder.uuid, name: row.name, space }}
          space={space}
        />
      ) : null}
      {removing.key > 0 && folder.space ? (
        <RemoveFromSpaceDialog
          key={`remove-${removing.key}`}
          spaceUuid={folder.space.uuid}
          spaceName={folder.space.name}
          item={{ type: 'folder', id: folder.uuid, name: row.name, space: folder.space }}
          open={removing.open}
          onOpenChange={(open) => setRemoving((previous) => ({ ...previous, open }))}
        />
      ) : null}
      {library.key > 0 ? (
        <LibraryPicker
          key={library.key}
          open={library.open}
          onOpenChange={(open) => setLibrary((previous) => ({ ...previous, open }))}
          folder={{ uuid: folder.uuid, name: row.name, space }}
        />
      ) : null}
      {move.key > 0 ? (
        <MoveToSpaceDialog
          key={move.key}
          // `GET /folders/{uuid}` carries the folder's `space` block
          // (techlead decision 3, 12 October 2026). `null` or absent means it
          // is in no space, so the dialog offers no "Remove from space".
          item={{
            type: 'folder',
            id: folder.uuid,
            name: row.name,
            space: folder.space ?? null,
          }}
          open={move.open}
          onOpenChange={(open) => setMove((previous) => ({ ...previous, open }))}
        />
      ) : null}
      {moveToFolder ? (
        <FolderPicker
          key={`move-to-folder-${moveToFolder.key}`}
          target={moveToFolder.target}
          title="Move to folder"
          // A space folder's file moves among the space's folders.
          space={space ?? undefined}
          from={{ uuid: folder.uuid, name: row.name }}
          open={moveToFolder.open}
          onOpenChange={(open) => setMoveToFolder((previous) => (previous ? { ...previous, open } : previous))}
        />
      ) : null}
    </div>
  );
}
