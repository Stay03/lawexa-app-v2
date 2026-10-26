'use client';

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useInfiniteQuery, type InfiniteData, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { FolderPlus, ListChecks, Plus, Upload, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/authStore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { extractApiError } from '@/lib/utils/api-error';
import { formatDayLabel } from '@/lib/utils/collab';
import type {
  Space,
  SpaceFile,
  SpaceItem,
  SpaceItemsResponse,
  SpaceItemsType,
} from '@/types/collab';
import { UploadTray } from '@/v2/features/channels/files/UploadTray';
import {
  useUploadQueueFor,
  type UploadFailureNote,
} from '@/v2/features/channels/files/use-upload-queue';
import { collabAccessState } from '@/v2/features/collab/model';
import { useCollabSpaceScope } from '@/v2/features/collab/shell/space-scope';
import { FileViewers } from '@/v2/features/files/FileViewers';
import { useFileViewer } from '@/v2/features/files/use-file-viewer';
import { listViewable, type ViewKind } from '@/v2/features/files/viewable';
import { FolderNameDialog } from '@/v2/features/folders/FolderNameDialog';
import { folderRow } from '@/v2/features/folders/folder-row-model';
import { FolderPicker } from '@/v2/features/folders/picker/FolderPicker';
import { useV2Session } from '@/v2/runtime/session-context';
import type { HomeComposerHandle } from '@/v2/shell/designs/HomeComposer';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { TabRow } from '@/v2/shell/TabRow';
import { useCopySpaceFileToMine, useUploadSpaceFile } from '../../content-mutations';
import { useSpaceFilesBulk } from './space-files-bulk';
import {
  FILES_ACCEPT,
  canDeleteSpaceFile,
  canRemoveFromSpace,
  ownsItem,
  spaceFileRefusal,
  uploadPrecheck,
  uploadRefusal,
  type SpaceContentTab,
  type SpaceItemTarget,
} from '../../content-model';
import {
  canAddContent,
  lastMessageLine,
  SPACE_TAB_LABELS,
  SPACE_TABS,
  spaceShowsChannels,
  uniqueRowsById,
  type SpaceTab,
} from '../../model';
import { MoveToSpaceDialog } from '../../move/MoveToSpaceDialog';
import { spacesQueries } from '../../queries';
import { LobbySection, SPACE_PILL_BAR } from '../lobby-parts';
import { SpacePeoplePanel } from '../people/SpacePeoplePanel';
import { newSpaceRadarHref } from '../radars/radar-rows';
import { SpaceRadarsPanel } from '../radars/SpaceRadarsPanel';
import { DeleteSpaceFileDialog } from './DeleteSpaceFileDialog';
import { RemoveFromSpaceDialog } from './RemoveFromSpaceDialog';
import { SpaceChatDock } from './SpaceChatDock';
import { SpaceFileCard } from './SpaceFileCard';
import type { SpaceFileActions } from './SpaceFileMenu';
import { SpaceLooseFiles } from './SpaceLooseFiles';
import { FileListHead } from '@/v2/features/folders/file-list/FileListRow';
import { FolderRow } from '@/v2/features/folders/list/FolderRow';
import { FOLDERS_DATE_LABEL } from '@/v2/features/folders/list/states';
import { renderFeedRow, type FeedRowMenus } from './feed-rows';
import { PagedContent } from './paged-content';
import { SpaceContentEmptyState } from './states';

/**
 * SpaceContentPanel — everything under a space's header (design B4, Arthur
 * 11:32Z and Stay 11:50Z, 17 October 2026): the pills, one list of the
 * space's conversations, files and folders, and the message box.
 *
 * ── THE PILLS (`?tab=`, `SpaceScreen` holds it) ────────────────────────────
 * All, Conversations, Folders, Radars, People. The first three are one feed
 * (`GET /spaces/{uuid}/items`, `spacesQueries.items`): All with no `type`,
 * each kind with its own. No Files pill (Stay, 22 October 2026, 23:58Z):
 * Folders lists the files in no folder under the folders. Radars is the
 * space's Radars (`SpaceRadarsPanel`, Radar in Spaces, 26 October 2026);
 * their reports are rows of All too. People is the members page
 * (`SpacePeoplePanel`) in the list's place. Channels are not a pill; the
 * space rail keeps them.
 *
 * ── NO SEARCH ──────────────────────────────────────────────────────────────
 * Stay, 17 October 2026, 19:11 UTC, and Arthur, 22:31 UTC: "remove it". The
 * pills stay at the top of the pane while the list scrolls under them (the
 * pane is the scroller, `CollabFrame`'s `data-v2-scroller`).
 *
 * ── WHERE ADDING WENT ──────────────────────────────────────────────────────
 * One gold + at the end of the Folders pill's bar opens New folder, Upload
 * files and Select, each with its icon (Stay, 23 October 2026, 00:06Z, header
 * option 1: "the new folder, select and upload should have icons"). New
 * folder and Upload are for the Owner and Contributors only (`canAddContent`;
 * a Viewer would get a 403); a Viewer gets a plain Select, for saving copies.
 * Files dragged from the desktop onto the list upload into the space on every
 * pill but People. A new conversation starts from the box docked at the
 * bottom (Stay and Arthur, 15 October 2026), on All, Conversations and Folders
 * (Arthur, 24 October 2026: "The folder tab in spaces should also have the
 * chat composer", reversing his 17 October item 2); not on People.
 *
 * ── ONE LIST, BY DAY ───────────────────────────────────────────────────────
 * The feed is newest first (`sort_at`), so the list is cut into days with the
 * transcript's day words (`formatDayLabel`). Every kind is the same row
 * (`feed-rows`, version A, Stay, 17 October 2026, 22:19 UTC). A folder opens
 * its own page. No row has a menu (Stay, 18 October 2026): a chat's and a
 * folder's actions are in their own page's ⋮, and a file's row opens its card
 * (`SpaceFileCard`), whose ⋮ holds move, remove, copy and delete, as each role
 * allows. The card's View opens a picture in the list's own viewer, over the
 * list's loaded pictures, and its Play opens a video or a recording in the
 * player (`FileViewers`; Stay, 21 October 2026).
 *
 * ── PAGING ─────────────────────────────────────────────────────────────────
 * The feed is cursor-paged; the next page loads 320px before the end of the
 * pane. A new pill is a new list and shows its skeleton.
 *
 * ── THE FOLDERS PILL IS THE SPACE'S TOP LEVEL ──────────────────────────────
 * Under the folders it lists the space's files in none of them
 * (`SpaceLooseFiles`; Stay, 22 October 2026: "Space files at the top level,
 * like your Folders page"). Such a file's card adds "Move to folder" for the
 * Owner and Contributors, which opens the folder picker on the space's own
 * folders; filing it takes it off the top level.
 */
export function SpaceContentPanel({
  space,
  tab,
  onTabChange,
}: {
  space: Space;
  tab: SpaceTab;
  onTabChange: (next: SpaceTab) => void;
}) {
  // A missing scope reads as the most careful answer: nobody to invite.
  const scope = useCollabSpaceScope();
  const canManage = scope?.canManage ?? false;
  const access: ContentAccess = {
    spaceUuid: space.uuid,
    spaceName: space.name,
    canAdd: canAddContent(space),
    canRemove: canRemoveFromSpace(space),
    contentRole: space.my_content_role ?? null,
    // An Owner alone in the space: the empty pills offer to bring people in.
    onInvite: scope !== null && canManage && space.active_members_count <= 1 ? scope.openInvite : null,
    openInvite: scope !== null && canManage ? scope.openInvite : null,
  };
  const { viewerId, enabled } = useContentReadGate();
  const session = useV2Session();
  // The space's channels and the threads the reader follows sit in All and
  // Conversations (Stay, 17 October 2026, approved 15:46 UTC), for a reader
  // who has team channels, in a team space: the rail's own rule.
  const rooms = spaceShowsChannels(space, session);
  // The feed's read, the uploads and the new-folder dialog live here and not
  // in the list, which a new pill remounts: a file still uploading keeps its
  // row in the tray. No search (Stay, 17 October 2026, 19:11 UTC; Arthur,
  // 22:31 UTC: "remove it").
  // People and Radars are their own lists: the feed's read waits.
  const listTab: SpaceContentTab = tab === 'people' || tab === 'radars' ? 'all' : tab;
  const type = FEED_TYPE[listTab];
  const query = useInfiniteQuery({
    ...spacesQueries.items(space.uuid, { viewerId, type, rooms }),
    enabled: enabled && tab !== 'people' && tab !== 'radars',
  });
  const { queue, pickFiles, picker } = useSpaceUploads(space.uuid);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const startFolder = () => setCreatingFolder(true);
  // Upload files opens the docked box's own picker on an empty All or
  // Conversations pill: the file is a chip in the box until the first message
  // goes, and is the space's from the moment it uploads (Arthur, 15 October
  // 2026: "no indication where it went").
  const dock = useRef<HomeComposerHandle>(null);

  // Bulk select on the Folders pill (Arthur, 20 October 2026, on the old Files
  // pill): the space's files in no folder, from the same read the list under
  // the folders shows (`SpaceLooseFiles`; one cache entry, no second request).
  const looseQuery = useInfiniteQuery({
    ...spacesQueries.looseFiles(space.uuid, { viewerId }),
    enabled: enabled && tab === 'folders',
  });
  const loosePages = looseQuery.data?.pages;
  const files = useMemo(
    () => (tab === 'folders' && loosePages ? uniqueRowsById(loosePages, (file) => file.id) : NO_FILES),
    [tab, loosePages],
  );
  const bulk = useSpaceFilesBulk({ space, files, canRemove: access.canRemove, viewerId });
  const selecting = bulk.selecting && tab === 'folders';
  const { isSelected, toggle } = bulk;
  const fileSelect = useMemo(() => (selecting ? { isSelected, toggle } : undefined), [selecting, isSelected, toggle]);
  const changeTab = (next: SpaceTab) => {
    // Ticks belong to the list they were made on.
    bulk.stop();
    onTabChange(next);
  };

  // The Folders pill's one control at the bar's end: the gold + for whoever
  // may add, a plain Select for a Viewer with files to tick. Nothing while
  // the files are being ticked: the bar at the foot holds Done.
  const canSelect = files.length > 0;
  const action =
    tab === 'radars' ? (
      access.canAdd ? <NewRadarButton spaceUuid={space.uuid} /> : null
    ) : tab !== 'folders' || selecting ? null : access.canAdd ? (
      <SpaceAddMenu onNewFolder={startFolder} onUpload={pickFiles} onSelect={canSelect ? bulk.start : null} />
    ) : canSelect ? (
      bulk.startButton(
        cn(
          // The pill row's scale (Stay, 22 October 2026: the 44px pill was
          // "ridiculously big … out of place"); the tap area reaches 44px.
          'v2-interactive relative inline-flex min-h-8 shrink-0 items-center rounded-full border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary after:absolute after:-inset-y-1.5 after:inset-x-0',
          FOCUS_RING,
        ),
      )
    ) : null;

  const list =
    tab === 'people' ? (
      <SpacePeoplePanel space={space} />
    ) : tab === 'radars' ? (
      <SpaceRadarsPanel spaceUuid={space.uuid} canAdd={access.canAdd} />
    ) : (
      <SpaceFeed
        // A new pill is a new list: a fresh mount, so its rows enter once.
        key={tab}
        tab={tab}
        query={query}
        access={access}
        onUpload={pickFiles}
        onNewFolder={startFolder}
        onAttach={() => dock.current?.attach()}
        fileSelect={fileSelect}
        looseFileCount={tab === 'folders' && !looseQuery.isPending ? files.length : null}
      />
    );

  return (
    <div className="flex flex-1 flex-col">
      {/* ONE ROW at every width: the pills, then the Folders or Radars
          pill's control at the row's end (header option 1, Stay, 23 October
          2026, 00:06Z). The pills scroll sideways when a phone is too narrow
          for all five. */}
      <div className={cn(SPACE_PILL_BAR, 'flex-row items-center gap-2')}>
        <TabRow
          tabs={PILLS}
          value={tab}
          onChange={changeTab}
          ariaLabel="Show in this space"
          panelId={PANEL_ID}
          className={PILLS_CLASS}
          tabClassName={pillClass}
        >
          {(pill) => pill.label}
        </TabRow>
        {action ? <div className="ml-auto flex shrink-0 justify-end">{action}</div> : null}
      </div>
      {access.canAdd ? picker : null}

      <div id={PANEL_ID} role="tabpanel" aria-labelledby={`${PANEL_ID}-tab-${tab}`} className="mt-4">
        {/* Files dropped on the list upload into the space; a Viewer gets the
            list and nothing to drop onto. */}
        {access.canAdd && tab !== 'people' && tab !== 'radars' ? (
          <FileDropZone spaceName={space.name} onDrop={queue.add}>
            {list}
          </FileDropZone>
        ) : (
          list
        )}
      </div>

      {creatingFolder ? (
        <FolderNameDialog
          open={creatingFolder}
          onOpenChange={setCreatingFolder}
          intent={{ mode: 'create', space: { uuid: space.uuid, name: space.name } }}
        />
      ) : null}
      {/* Room under the last row for the bar while it is up. */}
      {selecting ? <div aria-hidden className="h-36 md:h-24" /> : null}
      {selecting ? bulk.bar : null}
      {bulk.dialogs}

      {/* The Space's message box on the pills that hold chats, folders and
          files; not on People (Arthur, 24 October 2026, on Folders). While
          files are being ticked on Folders, the bar holds the foot of the
          screen: the box is hidden, not unmounted, so a half-typed question
          is still there after Done. */}
      {access.canAdd && DOCK_TABS.has(tab) ? (
        // `contents`, so the box stays a child of this column for its `sticky`
        // and `mt-auto`; `hidden` takes it off screen without unmounting it.
        <div className={selecting ? 'hidden' : 'contents'}>
          <SpaceChatDock space={{ uuid: space.uuid, name: space.name }} handle={dock} />
        </div>
      ) : null}
    </div>
  );
}

/** The feed's read, as the list takes it from the panel. */
type FeedQuery = UseInfiniteQueryResult<InfiniteData<SpaceItemsResponse>, Error>;

/** What a list may offer this viewer, decided once by the panel. */
interface ContentAccess {
  spaceUuid: string;
  spaceName: string;
  /** Owner or Contributor: New folder, Upload files. */
  canAdd: boolean;
  /** The space's Owner: Remove from space on any item. */
  canRemove: boolean;
  /** The reader's content role, for who may delete which file. */
  contentRole: Space['my_content_role'] | null;
  /** Opens the invite dialog, for an Owner alone in the space; else `null`. */
  onInvite: (() => void) | null;
  /** Opens the invite dialog, for whoever may invite (`scope.canManage`),
   *  however many are in the space; else `null`. The empty list's. */
  openInvite: (() => void) | null;
}

/** The one tab panel's id; `TabRow` mints the pill ids from it. */
const PANEL_ID = 'space-tab-panel';

/** The feed's `type` for each pill that lists items; All sends none. */
const FEED_TYPE: Readonly<Record<SpaceContentTab, SpaceItemsType | undefined>> = {
  all: undefined,
  conversations: 'conversations',
  folders: 'folders',
};

/** The pills the Space's message box shows on. */
const DOCK_TABS: ReadonlySet<SpaceTab> = new Set<SpaceTab>(['all', 'conversations', 'folders']);

const PILLS = SPACE_TABS.map((id) => ({ id, label: SPACE_TAB_LABELS[id] }));

/** The spaces list's pill row. */
const PILLS_CLASS =
  'inline-flex max-w-full min-w-0 items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-full bg-secondary/60 p-0.5';
const pillClass = (selected: boolean): string =>
  cn(
    'v2-interactive min-h-8 shrink-0 rounded-full px-3.5 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
    selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
  );

/** Stable empty rows, so a pending list does not mint a new array per render. */
const NO_ITEMS: readonly SpaceItem[] = [];
const NO_FILES: readonly SpaceFile[] = [];

/** A feed row's identity across pages: the kind and that kind's own id. */
const itemKey = (entry: SpaceItem): string =>
  entry.type === 'folder' || entry.type === 'channel' || entry.type === 'thread' || entry.type === 'radar_report'
    ? `${entry.type}:${entry.item.uuid}`
    : `${entry.type}:${entry.item.id}`;

/**
 * The gate every content read shares: the collab door (signed in, verified
 * where the backend requires it). The space itself has already loaded when
 * the panel mounts (`SpaceScreen` renders it only then), so a non-member,
 * whom the server refuses the space, never reaches a content request.
 */
function useContentReadGate() {
  const session = useV2Session();
  return {
    viewerId: session.userId,
    enabled: collabAccessState(session) === 'eligible',
  };
}

interface DialogState {
  item: SpaceItemTarget;
  open: boolean;
  key: number;
}

/**
 * The move and Remove from Space dialogs the rows open. Each stays mounted
 * after it closes so its exit plays, and a fresh open bumps its key, so every
 * open still starts clean (no error or pick left from the last one). The two
 * counters both start at 1 and the dialogs are siblings, so each key carries
 * its dialog's name: two siblings keyed `1` is a duplicate key.
 */
function useItemDialogs(access: ContentAccess) {
  const [moving, setMoving] = useState<DialogState | null>(null);
  const [removing, setRemoving] = useState<DialogState | null>(null);

  const openMove = useCallback((item: SpaceItemTarget) => {
    setMoving((previous) => ({ item, open: true, key: (previous?.key ?? 0) + 1 }));
  }, []);
  const openRemove = useCallback((item: SpaceItemTarget) => {
    setRemoving((previous) => ({ item, open: true, key: (previous?.key ?? 0) + 1 }));
  }, []);

  const dialogs = (
    <>
      {moving ? (
        <MoveToSpaceDialog
          key={`move-${moving.key}`}
          item={moving.item}
          open={moving.open}
          onOpenChange={(open) =>
            setMoving((previous) => (previous ? { ...previous, open } : previous))
          }
        />
      ) : null}
      {removing ? (
        <RemoveFromSpaceDialog
          key={`remove-${removing.key}`}
          spaceUuid={access.spaceUuid}
          spaceName={access.spaceName}
          item={removing.item}
          open={removing.open}
          onOpenChange={(open) =>
            setRemoving((previous) => (previous ? { ...previous, open } : previous))
          }
        />
      ) : null}
    </>
  );

  return { openMove, openRemove, dialogs };
}

/* ── The feed ─────────────────────────────────────────────────────────────── */

/** One pill's list: the rows by day, their menus and dialogs, and the pill's
 *  empty state. */
function SpaceFeed({
  tab,
  query,
  access,
  onUpload,
  onNewFolder,
  onAttach,
  fileSelect,
  looseFileCount,
}: {
  tab: SpaceContentTab;
  query: FeedQuery;
  access: ContentAccess;
  /** Opens the upload picker (the Folders pill's empty state). */
  onUpload: () => void;
  /** Opens the new-folder dialog (the Folders pill's empty state). */
  onNewFolder: () => void;
  /** Opens the docked box's picker (the All and Conversations empty states). */
  onAttach: () => void;
  /** Bulk select on the Folders pill's files in no folder: the ticks, while
   *  they are being made. */
  fileSelect?: FeedRowMenus['fileSelect'];
  /** The Folders pill's files in no folder, from the panel's read of them;
   *  `null` while they load, and on the other pills. */
  looseFileCount: number | null;
}) {
  const { spaceUuid, spaceName, canAdd, canRemove } = access;
  const { viewerId, enabled } = useContentReadGate();
  // "You:" on the last-message line when the reader sent it (`lastMessageLine`).
  const viewerUuid = useAuthStore((state) => state.user?.uuid ?? null);
  const pages = query.data?.pages;
  // Each item once across pages, keyed by kind: a conversation and a file can
  // share a numeric id.
  const items = useMemo(() => (pages ? uniqueRowsById(pages, itemKey) : NO_ITEMS), [pages]);
  // Captured once, so no clock read runs in render (React Compiler purity).
  const [now] = useState(() => Date.now());
  const { openMove, openRemove, dialogs } = useItemDialogs(access);

  // No row has a menu (Stay, 18 October 2026): a chat's and a folder's actions
  // live in the ⋮ of their own page, and a file's in the ⋮ of the card its row
  // opens (`SpaceFileCard`, option a); the dialogs those open stay here.
  const targetOf = useCallback(
    (file: { id: number; name: string }): SpaceItemTarget => ({
      type: 'file',
      id: file.id,
      name: file.name,
      space: { uuid: spaceUuid, name: spaceName },
    }),
    [spaceUuid, spaceName],
  );
  const moveFile = useCallback(
    (file: SpaceFile) => openMove(targetOf({ id: file.id, name: file.original_name })),
    [openMove, targetOf],
  );
  const removeFile = useCallback(
    (file: SpaceFile) => openRemove(targetOf({ id: file.id, name: file.original_name })),
    [openRemove, targetOf],
  );

  // Save a copy to my files (every member) and delete (the Owner any file, a
  // Contributor what they uploaded): backend, 15 October 2026.
  const copyToMine = useCopySpaceFileToMine(spaceUuid);
  const copyMutate = copyToMine.mutate;
  const copyFile = useCallback(
    (file: SpaceFile) =>
      copyMutate(file.id, {
        onSuccess: () =>
          toast.success('Saved a copy to your files', {
            description: `“${file.original_name}” in your files is your own. The one in ${spaceName} stays.`,
          }),
        onError: (error) => {
          const apiError = extractApiError(error);
          toast.error(spaceFileRefusal('copy', apiError.status, apiError.message));
        },
      }),
    [copyMutate, spaceName],
  );
  const [deleting, setDeleting] = useState<{ file: { id: number; name: string }; open: boolean; key: number } | null>(null);
  const deleteFile = useCallback(
    (file: SpaceFile) =>
      setDeleting((previous) => ({
        file: { id: file.id, name: file.original_name },
        open: true,
        key: (previous?.key ?? 0) + 1,
      })),
    [],
  );

  // Move to folder (Stay, 22 October 2026): the picker on the space's own
  // folders. Held after closing so its exit plays; each open bumps the key.
  const [filing, setFiling] = useState<{ fileId: number; open: boolean; key: number } | null>(null);
  const moveToFolder = useCallback(
    (file: SpaceFile) =>
      setFiling((previous) => ({ fileId: file.id, open: true, key: (previous?.key ?? 0) + 1 })),
    [],
  );

  // What a file card's ⋮ holds for this reader. Move to folder on the Folders
  // pill, where every file listed is one in no folder, for whoever may add to
  // the space: the Owner and Contributors, the server's rule for a space
  // folder's items (backend, 22 October 2026), whoever uploaded it.
  const fileActions = (file: SpaceFile): SpaceFileActions => ({
    onMoveToFolder: tab === 'folders' && canAdd ? moveToFolder : undefined,
    onMove: ownsItem(file.uploader.id, viewerId) ? moveFile : undefined,
    onRemoveFromSpace: canRemove ? removeFile : undefined,
    onCopyToMine: copyFile,
    onDelete: canDeleteSpaceFile({ my_content_role: access.contentRole }, file.uploader.id, viewerId)
      ? deleteFile
      : undefined,
  });
  // The one card of this list: the file it shows stays while it closes, so its
  // exit plays over the same text.
  // The room the card keeps clear at the window's bottom: the space's own
  // message box floats there, and the card flips above its row rather than
  // cover it. Read at the tap (an event, not a render).
  const [card, setCard] = useState<{ file: SpaceFile; row: HTMLElement; bottomClearance: number; open: boolean } | null>(
    null,
  );
  const openFile = useCallback((file: SpaceFile, row: HTMLElement) => {
    const dock = document.querySelector('[data-space-chat-dock]');
    const bottomClearance = dock ? Math.max(16, Math.round(window.innerHeight - dock.getBoundingClientRect().top) + 8) : 16;
    setCard({ file, row, bottomClearance, open: true });
  }, []);
  // The list's picture viewer and player (the card's View and Play), over the
  // list's loaded pictures in its order.
  const viewer = useFileViewer();
  const { view } = viewer;
  const pictures = useMemo(() => {
    const files: SpaceFile[] = [];
    for (const entry of items) if (entry.type === 'file') files.push(entry.item);
    return listViewable(files, 'File');
  }, [items]);
  // The card's View or Play closes the card as it opens the viewer, so focus
  // goes back to the row the card hung from, not to a button that is gone.
  const cardRow = card?.row ?? null;
  const viewFile = useCallback(
    (file: SpaceFile, kind: ViewKind) =>
      view({ id: file.id, name: file.original_name, kind, mimeType: file.mime_type, size: file.size }, cardRow),
    [view, cardRow],
  );
  // The feed cut into days, newest first.
  const days = useMemo(() => {
    const groups: { label: string; entries: SpaceItem[] }[] = [];
    for (const entry of items) {
      const label = formatDayLabel(entry.sort_at);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.entries.push(entry);
      else groups.push({ label, entries: [entry] });
    }
    return groups;
  }, [items]);

  const rowMenus: FeedRowMenus = {
    spaceUuid,
    openFile,
    folderRow: (entry) => folderRow(entry.item),
    byline: (item) => lastMessageLine(item.last_message, viewerUuid) ?? 'No messages yet',
    fileSelect,
  };

  const renderRow = (entry: SpaceItem) => renderFeedRow({ entry, now, menus: rowMenus, key: itemKey(entry) });

  const emptyAction =
    tab === 'folders' ? (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <EmptyStateAddButton icon={FolderPlus} onClick={onNewFolder}>
          New folder
        </EmptyStateAddButton>
        <EmptyStateAddButton variant="outline" icon={Upload} onClick={onUpload}>
          Upload files
        </EmptyStateAddButton>
      </div>
    ) : (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <EmptyStateAddButton variant="outline" icon={Upload} onClick={onAttach}>
          Upload files
        </EmptyStateAddButton>
        {access.openInvite ? (
          <EmptyStateAddButton variant="outline" icon={UserPlus} onClick={access.openInvite}>
            Invite people
          </EmptyStateAddButton>
        ) : null}
      </div>
    );

  return (
    <>
      <PagedContent
        tab={tab}
        query={query}
        // On the Folders pill the files in no folder are rows too: a space with
        // files and no folders showed "No folders in this space yet" above its
        // files (Stay, via Lucy, 23 October 2026). The empty state is for a
        // space with neither, and it waits while the files are still loading
        // (their own list draws the skeleton), so it never flashes first.
        count={items.length + (looseFileCount ?? 0)}
        empty={
          tab === 'folders' && looseFileCount === null ? null : (
            <SpaceContentEmptyState
              tab={tab}
              canAdd={canAdd}
              action={emptyAction}
              // The All and Conversations states offer Invite people beside
              // Upload files already.
              onInvite={tab === 'folders' ? (access.onInvite ?? undefined) : undefined}
            />
          )
        }
      >
        {tab === 'folders' ? (
          // THE FOLDERS PAGE'S OWN LIST (Stay, 22 October 2026: "Why didn't
          // you make it consistent with folders as is already?"): "Name" and
          // "Modified" over the columns on a computer, one folder per line,
          // no day headings, and the files in no folder continuing it below
          // (`SpaceLooseFiles`). A folder's actions are on its own page.
          <>
            <FileListHead dateLabel={FOLDERS_DATE_LABEL} />
            <ul className="mt-1 flex flex-col divide-y divide-border/40">
              {items.map((entry, index) =>
                entry.type === 'folder' ? (
                  <FolderRow key={itemKey(entry)} row={folderRow(entry.item)} index={index} now={now} />
                ) : null,
              )}
            </ul>
          </>
        ) : (
          <div className="flex flex-col gap-5">
            {days.map((day) => (
              <LobbySection key={day.label} title={day.label}>
                <ul className="flex flex-col">{day.entries.map(renderRow)}</ul>
              </LobbySection>
            ))}
          </div>
        )}
      </PagedContent>

      {/* The space's files in none of its folders, under the folders. They
          wait while the folders load, so the pill draws one skeleton. */}
      {tab === 'folders' ? (
        <SpaceLooseFiles
          spaceUuid={spaceUuid}
          viewerId={viewerId}
          enabled={enabled}
          held={query.isPending}
          now={now}
          actionsFor={fileActions}
          fileSelect={fileSelect}
          afterFolders={items.some((entry) => entry.type === 'folder')}
        />
      ) : null}

      <SpaceFileCard
        file={card?.file ?? null}
        anchor={card?.row ?? null}
        bottomClearance={card?.bottomClearance ?? 16}
        open={card?.open ?? false}
        onOpenChange={(open) => setCard((previous) => (previous ? { ...previous, open } : previous))}
        actions={card ? fileActions(card.file) : {}}
        onView={viewFile}
      />
      <FileViewers viewer={viewer} pictures={pictures} place="space" />
      {dialogs}
      {filing ? (
        <FolderPicker
          key={`folder-${filing.key}`}
          target={{ type: 'file', contentId: filing.fileId }}
          title="Move to folder"
          space={{ uuid: spaceUuid, name: spaceName }}
          open={filing.open}
          onOpenChange={(open) => setFiling((previous) => (previous ? { ...previous, open } : previous))}
        />
      ) : null}
      {deleting ? (
        <DeleteSpaceFileDialog
          key={`delete-${deleting.key}`}
          spaceUuid={spaceUuid}
          spaceName={spaceName}
          file={deleting.file}
          open={deleting.open}
          onOpenChange={(open) => setDeleting((previous) => (previous ? { ...previous, open } : previous))}
        />
      ) : null}
    </>
  );
}

/* ── Uploads ──────────────────────────────────────────────────────────────── */

/**
 * How a refused upload's row reads: the rules refusal's own reason (under
 * `errors.file`), and no Retry for a refusal the server would repeat
 * (`uploadRefusal`). Module-level, so the queue's callbacks stay stable.
 */
function describeUploadFailure(error: unknown): UploadFailureNote {
  const apiError = extractApiError(error);
  return uploadRefusal(apiError.status, apiError.errors?.file?.[0] ?? null, apiError.message);
}

/**
 * Upload into the space: the shared upload queue (the channel panel's), driven
 * by the space's own upload through `mutateAsync`, the one call that keeps a
 * promise per file. `picker` is the hidden file input and the tray that shows
 * each file's progress and refusal; the host renders it only for a reader who
 * may add.
 */
function useSpaceUploads(spaceUuid: string) {
  const upload = useUploadSpaceFile(spaceUuid);
  const queue = useUploadQueueFor(upload.mutateAsync, uploadPrecheck, describeUploadFailure);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickFiles = () => inputRef.current?.click();
  const picker = (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={FILES_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          if (event.target.files) queue.add(event.target.files);
          // Cleared so choosing the same file again still fires a change.
          event.target.value = '';
        }}
      />
      <UploadTray queue={queue} placement="inline" />
    </>
  );
  return { queue, pickFiles, picker };
}

/**
 * FileDropZone — files dragged from the desktop onto the list join the upload
 * queue, exactly as if they were picked (Spaces F3). Only a drag that carries
 * FILES lights it up, so dragging text or a link across the page does
 * nothing. Enter and leave fire for every child the pointer crosses, so the
 * zone counts them and lets go only when the pointer has left the zone
 * itself, rather than flickering at each row. The cue fades in and out.
 */
function FileDropZone({
  spaceName,
  onDrop,
  children,
}: {
  spaceName: string;
  onDrop: (files: FileList) => void;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const carriesFiles = (event: React.DragEvent) =>
    Array.from(event.dataTransfer.types).includes('Files');

  return (
    <div
      className="relative"
      onDragEnter={(event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(event) => {
        if (!carriesFiles(event)) return;
        // Without this the browser opens the file instead of dropping it here.
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(event) => {
        if (!carriesFiles(event)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        depth.current = 0;
        setOver(false);
        if (event.dataTransfer.files.length > 0) onDrop(event.dataTransfer.files);
      }}
    >
      {children}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary/60 bg-background/85 backdrop-blur-sm transition-opacity duration-150 motion-reduce:transition-none',
          over ? 'opacity-100' : 'opacity-0',
        )}
      >
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Upload aria-hidden className="size-4 text-primary" />
          {`Drop files to add them to ${spaceName}`}
        </p>
      </div>
    </div>
  );
}

/* ── Shared parts ─────────────────────────────────────────────────────────── */

/**
 * The Folders pill's + at the end of the pill bar, and its menu: New folder,
 * Upload files and Select, each with its icon (Stay, 23 October 2026, 00:06Z:
 * "the new folder, select and upload should have icons"). Select shows only
 * while there are files in no folder to tick.
 * IN THE PILLS' SCALE (Stay, 22 October 2026: "That new folder button is
 * ridiculously big and wasting space and out of place"): 32px tall like the
 * pills beside it, the gold that says it adds. On a phone it is the + alone,
 * a 32px circle, its word kept for a screen reader; from `sm:` up "Add"
 * shows, as on a folder's own page (`FolderAddMenu`). The tap area reaches
 * 44px either way.
 */
function SpaceAddMenu({
  onNewFolder,
  onUpload,
  onSelect,
}: {
  onNewFolder: () => void;
  onUpload: () => void;
  onSelect: (() => void) | null;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'v2-interactive relative inline-flex size-8 shrink-0 items-center justify-center gap-1 rounded-full bg-primary text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 after:absolute after:-inset-1.5 data-[state=open]:bg-primary/90 sm:w-auto sm:px-3',
          FOCUS_RING,
        )}
      >
        <Plus aria-hidden className="size-4 sm:size-3.5" />
        <span className="sr-only sm:not-sr-only">Add</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onNewFolder}>
          <FolderPlus />
          New folder
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onUpload}>
          <Upload />
          Upload files
        </DropdownMenuItem>
        {onSelect ? (
          <DropdownMenuItem onSelect={onSelect}>
            <ListChecks />
            Select
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The Radars pill's gold + at the end of the pill bar: New Radar, for the
 * Owner and Contributors. The Folders pill's + in shape and scale (one
 * action, so a link and not a menu): the + alone on a phone, "New Radar"
 * from `sm:` up.
 */
function NewRadarButton({ spaceUuid }: { spaceUuid: string }) {
  return (
    <Link
      href={newSpaceRadarHref(spaceUuid)}
      className={cn(
        'v2-interactive relative inline-flex size-8 shrink-0 items-center justify-center gap-1 rounded-full bg-primary text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 after:absolute after:-inset-1.5 sm:w-auto sm:px-3',
        FOCUS_RING,
      )}
    >
      <Plus aria-hidden className="size-4 sm:size-3.5" />
      <span className="sr-only sm:not-sr-only">New Radar</span>
    </Link>
  );
}

/** The empty state's add control, a small button with its word at every
 *  width, in the shape the app's other empty-state actions take. */
function EmptyStateAddButton({
  icon: Icon,
  onClick,
  variant,
  children,
}: {
  icon: typeof Plus;
  onClick: () => void;
  /** `outline` for the empty All and Conversations pills, whose main action
   *  is the box docked under them. */
  variant?: 'outline';
  children: string;
}) {
  return (
    <Button type="button" size="sm" variant={variant} onClick={onClick}>
      <Icon aria-hidden className="size-4" />
      {children}
    </Button>
  );
}
