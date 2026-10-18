'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useInfiniteQuery, type InfiniteData, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { Plus, Upload, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/authStore';
import { Button } from '@/components/ui/button';
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
import { ACCEPTED_FILE_TYPES } from '@/v2/features/conversations/attachment-rules';
import { useConversationMenu } from '@/v2/features/conversations/list/use-conversation-menu';
import { FolderNameDialog } from '@/v2/features/folders/FolderNameDialog';
import { folderRow, type FolderRowModel } from '@/v2/features/folders/folder-row-model';
import { useV2Session } from '@/v2/runtime/session-context';
import type { HomeComposerHandle } from '@/v2/shell/designs/HomeComposer';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { TabRow } from '@/v2/shell/TabRow';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useCopySpaceFileToMine, useUploadSpaceFile } from '../../content-mutations';
import {
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
import { DeleteSpaceFileDialog } from './DeleteSpaceFileDialog';
import { RemoveFromSpaceDialog } from './RemoveFromSpaceDialog';
import { SpaceChatDock } from './SpaceChatDock';
import { renderFeedRow, type FeedRowMenus } from './feed-rows';
import {
  SpaceContentEmptyState,
  SpaceContentErrorState,
  SpaceContentMoreErrorState,
  SpaceContentNextPageSkeleton,
  SpaceContentSkeleton,
} from './states';

/**
 * SpaceContentPanel — everything under a space's header (design B4, Arthur
 * 11:32Z and Stay 11:50Z, 17 October 2026): the pills, one list of the
 * space's conversations, files and folders, and the message box.
 *
 * ── THE PILLS (`?tab=`, `SpaceScreen` holds it) ────────────────────────────
 * All, Conversations, Files, Folders, People. The first four are one feed
 * (`GET /spaces/{uuid}/items`, `spacesQueries.items`): All with no `type`,
 * each kind with its own. People is the members page (`SpacePeoplePanel`) in
 * the list's place. Channels are not a pill; the space rail keeps them.
 *
 * ── NO SEARCH ──────────────────────────────────────────────────────────────
 * Stay, 17 October 2026, 19:11 UTC, and Arthur, 22:31 UTC: "remove it". The
 * pills stay at the top of the pane while the list scrolls under them (the
 * pane is the scroller, `CollabFrame`'s `data-v2-scroller`).
 *
 * ── WHERE ADDING WENT ──────────────────────────────────────────────────────
 * The add controls sit at the end of the pill bar: Files shows "Upload
 * files", Folders shows "New folder", each for the Owner and Contributors
 * only (`canAddContent`; a Viewer would get a 403). Files dragged from the
 * desktop onto the list upload into the space on every pill but People. A new
 * conversation starts from the box docked at the bottom (Stay and Arthur, 15
 * October 2026), on All, Conversations and Files only (Arthur, 17 October
 * 2026, item 2).
 *
 * ── ONE LIST, BY DAY ───────────────────────────────────────────────────────
 * The feed is newest first (`sort_at`), so the list is cut into days with the
 * transcript's day words (`formatDayLabel`). Every kind is the same row
 * (`feed-rows`, version A, Stay, 17 October 2026, 22:19 UTC). A folder opens
 * its own page. Every row keeps the menu it had in the tabs
 * (`useConversationMenu`; move, remove, copy and delete for a file; rename,
 * change space and remove for a folder), as each role allows.
 *
 * ── PAGING ─────────────────────────────────────────────────────────────────
 * The feed is cursor-paged; the next page loads 320px before the end of the
 * pane. A new pill is a new list and shows its skeleton.
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
  const listTab: SpaceContentTab = tab === 'people' ? 'all' : tab;
  const type = FEED_TYPE[listTab];
  const query = useInfiniteQuery({
    ...spacesQueries.items(space.uuid, { viewerId, type, rooms }),
    enabled: enabled && tab !== 'people',
  });
  const { queue, pickFiles, picker } = useSpaceUploads(space.uuid);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const startFolder = () => setCreatingFolder(true);
  // Upload files opens the docked box's own picker on an empty All or
  // Conversations pill: the file is a chip in the box until the first message
  // goes, and is the space's from the moment it uploads (Arthur, 15 October
  // 2026: "no indication where it went").
  const dock = useRef<HomeComposerHandle>(null);

  const action =
    access.canAdd && tab === 'files' ? (
      <PillButton icon={Upload} onClick={pickFiles}>
        Upload files
      </PillButton>
    ) : access.canAdd && tab === 'folders' ? (
      <PillButton icon={Plus} onClick={startFolder}>
        New folder
      </PillButton>
    ) : null;

  const list =
    tab === 'people' ? (
      <SpacePeoplePanel space={space} />
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
      />
    );

  return (
    <div className="flex flex-1 flex-col">
      <div className={SPACE_PILL_BAR}>
        <TabRow
          tabs={PILLS}
          value={tab}
          onChange={onTabChange}
          ariaLabel="Show in this space"
          panelId={PANEL_ID}
          className={PILLS_CLASS}
          tabClassName={pillClass}
        >
          {(pill) => pill.label}
        </TabRow>
        {/* The pill's add control, Upload files or New folder, at the bar's end. */}
        {action ? <div className="flex justify-end md:ml-auto">{action}</div> : null}
      </div>
      {access.canAdd ? picker : null}

      <div id={PANEL_ID} role="tabpanel" aria-labelledby={`${PANEL_ID}-tab-${tab}`} className="mt-4">
        {/* Files dropped on the list upload into the space; a Viewer gets the
            list and nothing to drop onto. */}
        {access.canAdd && tab !== 'people' ? (
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
      {/* The Space's message box on the pills that hold chats and files; not on
          Folders or People, where a question to Lawexa has nothing to start
          from (Arthur, 17 October 2026, item 2). */}
      {access.canAdd && DOCK_TABS.has(tab) ? (
        <SpaceChatDock space={{ uuid: space.uuid, name: space.name }} handle={dock} />
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
  files: 'files',
  folders: 'folders',
};

/** The pills the Space's message box shows on. */
const DOCK_TABS: ReadonlySet<SpaceTab> = new Set<SpaceTab>(['all', 'conversations', 'files']);

const PILLS = SPACE_TABS.map((id) => ({ id, label: SPACE_TAB_LABELS[id] }));

/** The spaces list's pill row. */
const PILLS_CLASS =
  'inline-flex max-w-full shrink-0 items-center gap-0.5 self-start overflow-x-auto overscroll-x-contain rounded-full bg-secondary/60 p-0.5 md:self-auto';
const pillClass = (selected: boolean): string =>
  cn(
    'v2-interactive min-h-8 shrink-0 rounded-full px-3.5 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
    selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
  );

/** Stable empty rows, so a pending list does not mint a new array per render. */
const NO_ITEMS: readonly SpaceItem[] = [];

/** A feed row's identity across pages: the kind and that kind's own id. */
const itemKey = (entry: SpaceItem): string =>
  entry.type === 'folder' || entry.type === 'channel' || entry.type === 'thread'
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
}: {
  tab: SpaceContentTab;
  query: FeedQuery;
  access: ContentAccess;
  /** Opens the upload picker (the Files pill's empty state). */
  onUpload: () => void;
  /** Opens the new-folder dialog (the Folders pill's empty state). */
  onNewFolder: () => void;
  /** Opens the docked box's picker (the All and Conversations empty states). */
  onAttach: () => void;
}) {
  const { spaceUuid, spaceName, canAdd, canRemove } = access;
  const { viewerId } = useContentReadGate();
  // "You:" on the last-message line when the reader sent it (`lastMessageLine`).
  const viewerUuid = useAuthStore((state) => state.user?.uuid ?? null);
  const pages = query.data?.pages;
  // Each item once across pages, keyed by kind: a conversation and a file can
  // share a numeric id.
  const items = useMemo(() => (pages ? uniqueRowsById(pages, itemKey) : NO_ITEMS), [pages]);
  // Captured once, so no clock read runs in render (React Compiler purity).
  const [now] = useState(() => Date.now());
  const { openMove, openRemove, dialogs } = useItemDialogs(access);

  // The "…" menu of each conversation: the items its `can` allows (rename,
  // move, remove, share, delete), with the same dialogs as the conversations
  // list.
  const menu = useConversationMenu({ viewerId, place: { uuid: spaceUuid, name: spaceName } });

  const targetOf = useCallback(
    (entry: { type: 'folder'; uuid: string; name: string } | { type: 'file'; id: number; name: string }): SpaceItemTarget =>
      entry.type === 'folder'
        ? { type: 'folder', id: entry.uuid, name: entry.name, space: { uuid: spaceUuid, name: spaceName } }
        : { type: 'file', id: entry.id, name: entry.name, space: { uuid: spaceUuid, name: spaceName } },
    [spaceUuid, spaceName],
  );
  // Stable across renders, so the rows' `memo` holds.
  const moveFolder = useCallback(
    (row: FolderRowModel) => openMove(targetOf({ type: 'folder', uuid: row.uuid, name: row.name })),
    [openMove, targetOf],
  );
  // Rename (and Delete, which the menu pairs with it) for the reader's own
  // folders only (Arthur, 17 October 2026, item 6): other members' folders are
  // not theirs to change.
  const [renaming, setRenaming] = useState<{ uuid: string; name: string; key: number } | null>(null);
  const renameFolder = useCallback(
    (row: FolderRowModel) =>
      setRenaming((previous) => ({ uuid: row.uuid, name: row.name, key: (previous?.key ?? 0) + 1 })),
    [],
  );
  const removeFolder = useCallback(
    (row: FolderRowModel) => openRemove(targetOf({ type: 'folder', uuid: row.uuid, name: row.name })),
    [openRemove, targetOf],
  );
  const moveFile = useCallback(
    (file: SpaceFile) => openMove(targetOf({ type: 'file', id: file.id, name: file.original_name })),
    [openMove, targetOf],
  );
  const removeFile = useCallback(
    (file: SpaceFile) => openRemove(targetOf({ type: 'file', id: file.id, name: file.original_name })),
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

  // What each row's menu holds for this reader, decided once per row.
  const folderMenu = (entry: Extract<SpaceItem, { type: 'folder' }>) => ({
    onRename: ownsItem(entry.item.user?.id, viewerId) ? renameFolder : undefined,
    onMove: ownsItem(entry.item.user?.id, viewerId) ? moveFolder : undefined,
    onRemoveFromSpace: canRemove ? removeFolder : undefined,
  });
  const fileMenu = (file: SpaceFile) => ({
    onMove: ownsItem(file.uploader.id, viewerId) ? moveFile : undefined,
    onRemoveFromSpace: canRemove ? removeFile : undefined,
    onCopyToMine: copyFile,
    onDelete: canDeleteSpaceFile({ my_content_role: access.contentRole }, file.uploader.id, viewerId)
      ? deleteFile
      : undefined,
  });
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
    conversation: menu.actionsFor,
    folder: folderMenu,
    file: fileMenu,
    folderRow: (entry) => folderRow(entry.item),
    byline: (item) => lastMessageLine(item.last_message, viewerUuid) ?? 'No messages yet',
  };

  const renderRow = (entry: SpaceItem) => renderFeedRow({ entry, now, menus: rowMenus, key: itemKey(entry) });

  const emptyAction =
    tab === 'files' ? (
      <EmptyStateAddButton icon={Upload} onClick={onUpload}>
        Upload files
      </EmptyStateAddButton>
    ) : tab === 'folders' ? (
      <EmptyStateAddButton icon={Plus} onClick={onNewFolder}>
        New folder
      </EmptyStateAddButton>
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
        count={items.length}
        empty={
          <SpaceContentEmptyState
            tab={tab}
            canAdd={canAdd}
            action={emptyAction}
            // The All and Conversations states offer Invite people beside
            // Upload files already.
            onInvite={tab === 'files' || tab === 'folders' ? (access.onInvite ?? undefined) : undefined}
          />
        }
      >
        <div className="flex flex-col gap-5">
          {days.map((day) => (
            <LobbySection key={day.label} title={day.label}>
              <ul className="flex flex-col">{day.entries.map(renderRow)}</ul>
            </LobbySection>
          ))}
        </div>
      </PagedContent>

      {menu.dialogs}
      {dialogs}
      {renaming ? (
        <FolderNameDialog
          key={`rename-${renaming.key}`}
          open
          onOpenChange={(open) => {
            if (!open) setRenaming(null);
          }}
          intent={{ mode: 'rename', folder: { uuid: renaming.uuid, name: renaming.name } }}
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
        accept={ACCEPTED_FILE_TYPES}
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

/** A pill's add control at the end of the pill bar, the folders list's own
 *  "New folder" pill, with its word at every width: it is where the Files and
 *  Folders tabs' add buttons went, so it names itself (B4). */
function PillButton({
  icon: Icon,
  onClick,
  children,
}: {
  icon: typeof Plus;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'v2-interactive inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
        FOCUS_RING,
      )}
    >
      <Icon aria-hidden className="size-4" />
      {children}
    </button>
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

/** What the shared body reads off an infinite query: its states and pager. */
interface PagedQuery {
  isPending: boolean;
  isError: boolean;
  isFetchNextPageError: boolean;
  error: unknown;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  refetch: () => unknown;
}

/**
 * The list's body, so its states cannot drift: skeleton on a first load, the
 * failure panel when nothing loaded, the pill's empty state (`empty`), or the
 * rows with the next-page sentinel under them.
 */
function PagedContent({
  tab,
  query,
  count,
  empty,
  children,
}: {
  tab: SpaceContentTab;
  query: PagedQuery;
  /** How many rows are loaded: every state decision reads this. */
  count: number;
  /** What the pill shows with no rows. */
  empty: ReactNode;
  children: ReactNode;
}) {
  // The pane this list scrolls in, found from the list's own element. Set in
  // an effect declared BEFORE the sentinel's, so it is in place when that
  // observer is first built (`useShellScrollRoot`'s ordering rule).
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    // `data-v2-scroller` is the attribute `CollabFrame` puts on its pane for
    // `ScrollMemory`; it names the scroller of the route.
    paneRef.current = anchorRef.current?.closest<HTMLElement>('[data-v2-scroller]') ?? null;
    return () => {
      paneRef.current = null;
    };
  }, []);

  const { fetchNextPage, refetch } = query;
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    // A failed page is not retried by scrolling; its strip carries the retry.
    hasNextPage: query.hasNextPage && !query.isFetchNextPageError,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage,
    rootRef: paneRef,
    rootMargin: '320px',
  });

  // A refusal the server explained (403) is worth its own sentence; anything
  // else, a network drop or a 5xx, gets the designed one.
  const apiError = query.error ? extractApiError(query.error) : null;
  const message = apiError?.status === 403 ? apiError.message : undefined;

  return (
    <div ref={anchorRef}>
      {query.isPending ? (
        <SpaceContentSkeleton />
      ) : query.isError && count === 0 ? (
        <SpaceContentErrorState
          tab={tab}
          message={message}
          onRetry={() => void refetch()}
        />
      ) : count === 0 ? (
        empty
      ) : (
        <div>
          {children}
          <div ref={sentinelRef} className="pt-1">
            {query.isFetchingNextPage ? <SpaceContentNextPageSkeleton /> : null}
          </div>
          {query.isError ? (
            <SpaceContentMoreErrorState
              onRetry={() =>
                void (query.isFetchNextPageError ? fetchNextPage() : refetch())
              }
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
