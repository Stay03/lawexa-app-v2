'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { ChevronLeft, FolderOpen, Plus, Upload, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { cn, stripPastedTags } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/authStore';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import type { Space, SpaceConversation, SpaceFile, SpaceFolder } from '@/types/collab';
import { UploadTray } from '@/v2/features/channels/files/UploadTray';
import {
  useUploadQueueFor,
  type UploadFailureNote,
} from '@/v2/features/channels/files/use-upload-queue';
import { collabAccessState } from '@/v2/features/collab/model';
import { useCollabSpaceScope } from '@/v2/features/collab/shell/space-scope';
import { ACCEPTED_FILE_TYPES } from '@/v2/features/conversations/attachment-rules';
import { ConversationRow } from '@/v2/features/conversations/list/ConversationRow';
import { FolderNameDialog } from '@/v2/features/folders/FolderNameDialog';
import {
  folderHref,
  folderRow,
  type FolderRowModel,
} from '@/v2/features/folders/folder-row-model';
import { FolderRow } from '@/v2/features/folders/list/FolderRow';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { SearchField } from '@/v2/shell/SearchField';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useCopySpaceFileToMine, useUploadSpaceFile } from '../../content-mutations';
import {
  canDeleteSpaceFile,
  canRemoveFromSpace,
  ownsItem,
  spaceFileRefusal,
  uploadPrecheck,
  uploadRefusal,
  type SpaceItemTarget,
} from '../../content-model';
import { canAddContent, lastMessageLine, uniqueRowsById } from '../../model';
import { MoveToSpaceDialog } from '../../move/MoveToSpaceDialog';
import { spacesQueries } from '../../queries';
import { useServerSearch, type ServerSearch } from '../../use-server-search';
import { RemoveFromSpaceDialog } from './RemoveFromSpaceDialog';
import { DeleteSpaceFileDialog } from './DeleteSpaceFileDialog';
import { SpaceFileRow } from './SpaceFileRow';
import { SpaceChatDock } from './SpaceChatDock';
import {
  SpaceContentEmptyState,
  SpaceContentErrorState,
  SpaceContentMoreErrorState,
  SpaceContentNextPageSkeleton,
  SpaceContentNoMatchState,
  SpaceContentSkeleton,
  SpaceFolderLevelEmptyState,
  type SpaceContentTab,
} from './states';

/**
 * SpaceContentPanel — the body of a space's Conversations, Folders or Files
 * tab (Spaces F2, 11 October 2026; writing added in F3, 12 October 2026).
 * Every member reads all three; what else a reader may do comes from the two
 * content-role rulings on the space (`canAddContent`, `canRemoveFromSpace`)
 * and from owning the item (`ownsItem`).
 *
 * ── WHAT EACH TAB OFFERS (F3) ──────────────────────────────────────────────
 *  - Every tab: a search the endpoint runs (title, folder name, file name),
 *    and an empty state that teaches (`spaceEmptyCopy`).
 *  - Conversations: each row names who started it; its owner may move it to
 *    another space or back out, the space's Owner may remove it. The Owner
 *    and Contributors start one from the box docked under the list. With none
 *    yet, the tab reads Arthur's "Start working with Lawexa" (15 October
 *    2026) over Upload files (into the space, in place) and, for whoever may
 *    invite, Invite people.
 *  - Folders: browsed one level at a time inside the tab (`parent_id`), with
 *    a way back up and a way to the folder's own page for what is filed in
 *    it; "New folder" at the current level for the Owner and Contributors.
 *  - Files: "Upload" and drag and drop for the Owner and Contributors, with
 *    progress and each refusal in place (the shared upload queue and tray);
 *    the uploader may move a file, the space's Owner may remove it.
 * A Viewer sees no add control at all: the server would answer 403.
 *
 * ── EACH TAB IS ITS OWN QUERY, MOUNTED ONLY WHILE IT IS SHOWING ────────────
 * A reader who never opens Files never pays for it, and each list keeps its
 * own 30-minute cache entry (`spacesQueries`), so going back to a tab already
 * seen paints its rows at once and refreshes behind them. A new search keeps
 * the rows on screen, dimmed, until its answer lands (`keepPreviousData`);
 * a new folder level does not, because the old level's rows under the new
 * level's name would be wrong, so it shows its skeleton.
 *
 * ── THE ROWS ARE THE SOURCE LISTS' OWN ─────────────────────────────────────
 * A chat in a space is the same object as a chat in `/conversations`, and a
 * folder the same as one in `/folders`, so they wear the same rows. Files get
 * `SpaceFileRow`, the channel library's row anatomy without the channel.
 *
 * ── THE PANE IS THE SCROLLER ───────────────────────────────────────────────
 * Inside a space the collab frame's pane scrolls, not the shell (`CollabFrame`
 * marks it `data-v2-scroller`). The next-page sentinel is measured against
 * that pane, found from this panel's own element, so the 320px early-load band
 * holds; against the viewport it would be clipped away by the pane and the
 * next page would load only at the exact bottom (`useShellScrollRoot`'s
 * finding, for the same reason one container in).
 */
export function SpaceContentPanel({
  tab,
  spaceUuid,
}: {
  tab: SpaceContentTab;
  spaceUuid: string;
}) {
  // The space has loaded before any tab mounts (`SpaceScreen` renders tabs
  // only then), so the rulings read real roles. A missing scope reads as the
  // most careful answer: nothing to add, nothing to remove.
  const scope = useCollabSpaceScope();
  const space = scope?.space ?? null;
  const access: ContentAccess = {
    spaceUuid,
    spaceName: space?.name ?? '',
    canAdd: space !== null && canAddContent(space),
    canRemove: space !== null && canRemoveFromSpace(space),
    contentRole: space?.my_content_role ?? null,
    // An Owner alone in the space: the empty tabs offer to bring people in.
    onInvite:
      scope !== null && scope.canManage && space !== null && space.active_members_count <= 1
        ? scope.openInvite
        : null,
    openInvite: scope !== null && scope.canManage ? scope.openInvite : null,
  };
  switch (tab) {
    case 'chats':
      return <SpaceChatsList access={access} />;
    case 'folders':
      return <SpaceFoldersList access={access} />;
    case 'files':
      return <SpaceFilesList access={access} />;
  }
}

/** What a tab may offer this viewer, decided once by the panel. */
interface ContentAccess {
  spaceUuid: string;
  spaceName: string;
  /** Owner or Contributor: New folder, Upload. */
  canAdd: boolean;
  /** The space's Owner: Remove from space on any item. */
  canRemove: boolean;
  /** The reader's content role, for who may delete which file. */
  contentRole: Space['my_content_role'] | null;
  /** Opens the invite dialog, for an Owner alone in the space; else `null`. */
  onInvite: (() => void) | null;
  /** Opens the invite dialog, for whoever may invite (`scope.canManage`),
   *  however many are in the space; else `null`. The empty chats tab's. */
  openInvite: (() => void) | null;
}

/** Stable empty rows, so a pending list does not mint a new array per render. */
const NO_CHATS: readonly SpaceConversation[] = [];
const NO_FOLDERS: readonly SpaceFolder[] = [];
const NO_FILES: readonly SpaceFile[] = [];

/** Module-level (so referentially stable) row identities: the React keys. */
const chatId = (row: SpaceConversation): string => row.id;
const folderUuid = (row: SpaceFolder): string => row.uuid;
const fileId = (row: SpaceFile): number => row.id;

/**
 * The gate every content read shares: the collab door (signed in, verified
 * where the backend requires it). The space itself has already loaded when a
 * tab mounts (`SpaceScreen` renders tabs only then), so a non-member, whom the
 * server refuses the space, never reaches a content request.
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
 * The move and Remove from Space dialogs a tab's rows open. Each stays
 * mounted after it closes so its exit plays, and a fresh open bumps its key,
 * so every open still starts clean (no error or pick left from the last one).
 * The two counters both start at 1 and the dialogs are siblings, so each key
 * carries its dialog's name: two siblings keyed `1` is a duplicate key.
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

/* ── Conversations ────────────────────────────────────────────────────────── */

function SpaceChatsList({ access }: { access: ContentAccess }) {
  const { spaceUuid, spaceName, canAdd, canRemove } = access;
  const { viewerId, enabled } = useContentReadGate();
  // "You:" on the last-message line when the reader sent it (`lastMessageLine`).
  const viewerUuid = useAuthStore((state) => state.user?.uuid ?? null);
  const search = useServerSearch();
  const query = useInfiniteQuery({
    ...spacesQueries.conversations(spaceUuid, { viewerId, search: search.term }),
    enabled,
    placeholderData: keepPreviousData,
  });
  const pages = query.data?.pages;
  // Each chat once across pages (`uniqueRowsById`: offset paging under other
  // members' writes can repeat a row).
  const rows = useMemo(
    () => (pages ? uniqueRowsById(pages, chatId) : NO_CHATS),
    [pages],
  );
  // Captured once, so no clock read runs in render (React Compiler purity).
  const [now] = useState(() => Date.now());
  // Rows fade in only on a first load; a list that mounts from cache shows
  // them in place (the conversations list's rule, 8 October 2026).
  const [reveal] = useState(() => query.isPending);
  const { openMove, openRemove, dialogs } = useItemDialogs(access);
  const uploads = useSpaceUploads(spaceUuid);

  const targetOf = (conversation: SpaceConversation): SpaceItemTarget => ({
    type: 'conversation',
    id: conversation.id,
    name: stripPastedTags(conversation.title),
    space: { uuid: spaceUuid, name: spaceName },
  });

  // A new conversation starts from the box docked at the bottom (Stay and
  // Arthur, 15 October 2026), so the toolbar and the empty state offer no
  // start button of their own; the earlier conversations stay in the list
  // above it, each opening its chat to read and continue.
  return (
    <div className="flex flex-1 flex-col">
      <ContentToolbar
        search={search}
        label="Search this space's conversations"
        placeholder="Search conversations"
        busy={query.isPlaceholderData}
        action={null}
      />
      {canAdd ? uploads.picker : null}
      <PagedContent
        tab="chats"
        query={query}
        count={rows.length}
        dim={query.isPlaceholderData}
        empty={
          search.term ? (
            <SpaceContentNoMatchState
              query={search.term}
              action={<ClearSearchButton onClear={search.clear} />}
            />
          ) : (
            <SpaceContentEmptyState
              tab="chats"
              canAdd={canAdd}
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <EmptyStateAddButton variant="outline" icon={Upload} onClick={uploads.pickFiles}>
                    Upload files
                  </EmptyStateAddButton>
                  {access.openInvite ? (
                    <EmptyStateAddButton
                      variant="outline"
                      icon={UserPlus}
                      onClick={access.openInvite}
                    >
                      Invite people
                    </EmptyStateAddButton>
                  ) : null}
                </div>
              }
            />
          )
        }
      >
        <ul className="flex flex-col">
          {rows.map((conversation, index) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              now={now}
              index={index}
              exiting={false}
              reveal={reveal}
              // A chat with no message to preview says so; it never falls back
              // to whose chat it is, which read as a message ("You").
              byline={lastMessageLine(conversation.last_message, viewerUuid) ?? 'No messages yet'}
              onMove={
                ownsItem(conversation.user_id, viewerId)
                  ? () => openMove(targetOf(conversation))
                  : undefined
              }
              onRemoveFromSpace={
                canRemove ? () => openRemove(targetOf(conversation)) : undefined
              }
            />
          ))}
        </ul>
      </PagedContent>
      {dialogs}
      {canAdd ? <SpaceChatDock space={{ uuid: spaceUuid, name: spaceName }} /> : null}
    </div>
  );
}

/* ── Folders ──────────────────────────────────────────────────────────────── */

/** One step down the tab's folder trail. */
interface FolderLevel {
  uuid: string;
  name: string;
}

const NO_LEVELS: readonly FolderLevel[] = [];

function SpaceFoldersList({ access }: { access: ContentAccess }) {
  const { spaceUuid, spaceName, canAdd, canRemove } = access;
  const { viewerId, enabled } = useContentReadGate();
  const search = useServerSearch();
  // The levels the reader went down, root first. Local to the tab: it is a
  // way of browsing, not an address (each folder's address is its own page).
  const [trail, setTrail] = useState<readonly FolderLevel[]>(NO_LEVELS);
  const level = trail.length > 0 ? trail[trail.length - 1] : null;
  const levelUuid = level?.uuid ?? null;

  const query = useInfiniteQuery({
    ...spacesQueries.folders(spaceUuid, {
      viewerId,
      parentId: levelUuid,
      search: search.term,
    }),
    enabled,
    // A new search at the SAME level keeps its rows on screen until the
    // answer lands; a new level does not (see the docblock).
    placeholderData: (previous, previousQuery) =>
      previousQuery && (previousQuery.queryKey[4].parent_id ?? null) === levelUuid
        ? previous
        : undefined,
  });
  const pages = query.data?.pages;
  const records = useMemo(
    () => (pages ? uniqueRowsById(pages, folderUuid) : NO_FOLDERS),
    [pages],
  );
  // One row model per folder, the mapping the folders list itself runs.
  const rows = useMemo(() => records.map(folderRow), [records]);
  const recordByUuid = useMemo(
    () => new Map(records.map((record) => [record.uuid, record])),
    [records],
  );
  const [now] = useState(() => Date.now());
  const [creating, setCreating] = useState(false);
  const { openMove, openRemove, dialogs } = useItemDialogs(access);

  const clearSearch = search.clear;
  const openLevel = useCallback(
    (row: FolderRowModel) => {
      clearSearch();
      setTrail((previous) => [...previous, { uuid: row.uuid, name: row.name }]);
    },
    [clearSearch],
  );
  const goUp = () => {
    clearSearch();
    setTrail((previous) => previous.slice(0, -1));
  };

  const targetOf = useCallback(
    (row: FolderRowModel): SpaceItemTarget => ({
      type: 'folder',
      id: row.uuid,
      name: row.name,
      space: { uuid: spaceUuid, name: spaceName },
    }),
    [spaceUuid, spaceName],
  );
  // Stable across renders, so `FolderRow`'s `memo` holds. The move is
  // offered on the reader's own folders only (`ownsItem`, at the row).
  const moveRow = useCallback(
    (row: FolderRowModel) => openMove(targetOf(row)),
    [openMove, targetOf],
  );
  const removeRow = useCallback(
    (row: FolderRowModel) => openRemove(targetOf(row)),
    [openRemove, targetOf],
  );

  const startFolder = () => setCreating(true);
  const newFolderButton = canAdd ? (
    <PillButton icon={Plus} onClick={startFolder}>
      New folder
    </PillButton>
  ) : null;

  return (
    <>
      <ContentToolbar
        search={search}
        label={level ? `Search the folders in ${level.name}` : "Search this space's folders"}
        placeholder="Search folders"
        busy={query.isPlaceholderData}
        action={newFolderButton}
      />

      {level ? (
        <FolderLevelBar
          // The parent's name when there is one, else the space's root.
          upLabel={trail.length > 1 ? trail[trail.length - 2].name : 'All folders'}
          level={level}
          onUp={goUp}
        />
      ) : null}

      <PagedContent
        // A new level is a new list: a fresh mount, so its rows enter once.
        key={levelUuid ?? 'root'}
        tab="folders"
        query={query}
        count={rows.length}
        dim={query.isPlaceholderData}
        empty={
          search.term ? (
            <SpaceContentNoMatchState
              query={search.term}
              action={<ClearSearchButton onClear={search.clear} />}
            />
          ) : level ? (
            <SpaceFolderLevelEmptyState
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href={folderHref(level.uuid)}>Open folder</Link>
                </Button>
              }
            />
          ) : (
            <SpaceContentEmptyState
              tab="folders"
              canAdd={canAdd}
              action={
                <EmptyStateAddButton icon={Plus} onClick={startFolder}>
                  New folder
                </EmptyStateAddButton>
              }
              onInvite={access.onInvite ?? undefined}
            />
          )
        }
      >
        <ul className="flex flex-col">
          {rows.map((row, index) => (
            <FolderRow
              key={row.uuid}
              row={row}
              index={index}
              now={now}
              onOpen={openLevel}
              onMove={
                ownsItem(recordByUuid.get(row.uuid)?.user?.id, viewerId) ? moveRow : undefined
              }
              onRemoveFromSpace={canRemove ? removeRow : undefined}
            />
          ))}
        </ul>
      </PagedContent>

      {creating ? (
        <FolderNameDialog
          open={creating}
          onOpenChange={setCreating}
          intent={{
            mode: 'create',
            space: { uuid: spaceUuid, name: spaceName },
            parent: level
              ? { uuid: level.uuid, name: level.name, depth: trail.length }
              : undefined,
          }}
        />
      ) : null}
      {dialogs}
    </>
  );
}

/**
 * Where the reader is in the space's folders, and the two ways out of it: up
 * one level, and to the folder's own page, where its cases, notes and files
 * are listed (this endpoint lists folders only).
 */
function FolderLevelBar({
  upLabel,
  level,
  onUp,
}: {
  upLabel: string;
  level: FolderLevel;
  onUp: () => void;
}) {
  return (
    <div className="mb-2 flex min-w-0 items-center gap-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onUp}
        aria-label={`Back to ${upLabel}`}
        className="v2-interactive -ml-2 min-w-0 max-w-[40%] shrink text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft aria-hidden className="size-4 shrink-0" />
        <span className="truncate">{upLabel}</span>
      </Button>
      <span aria-hidden className="shrink-0 text-muted-foreground/50">
        /
      </span>
      <h3 className="min-w-0 flex-1 truncate px-1 text-sm font-medium text-foreground">
        {level.name}
      </h3>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link href={folderHref(level.uuid)}>
          <FolderOpen aria-hidden className="size-4" />
          {/* "Open" at every width, so a phone does not show a bare folder
              glyph that reads as "a folder"; "folder" joins it from `sm:`
              and for screen readers (design round 2). */}
          <span>
            Open<span className="sr-only sm:not-sr-only">{' folder'}</span>
          </span>
        </Link>
      </Button>
    </div>
  );
}

/* ── Files ────────────────────────────────────────────────────────────────── */

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
 * Upload into the space from a tab: the shared upload queue (the channel
 * panel's), driven by the space's own upload through `mutateAsync`, the one
 * call that keeps a promise per file. `picker` is the hidden file input and
 * the tray that shows each file's progress and refusal; the host renders it
 * only for a reader who may add. The Files tab uses it, and so does the empty
 * Conversations tab's Upload files.
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

function SpaceFilesList({ access }: { access: ContentAccess }) {
  const { spaceUuid, spaceName, canAdd, canRemove } = access;
  const { viewerId, enabled } = useContentReadGate();
  const search = useServerSearch();
  const query = useInfiniteQuery({
    ...spacesQueries.files(spaceUuid, { viewerId, name: search.term }),
    enabled,
    placeholderData: keepPreviousData,
  });
  const pages = query.data?.pages;
  const rows = useMemo(
    () => (pages ? uniqueRowsById(pages, fileId) : NO_FILES),
    [pages],
  );
  const { openMove, openRemove, dialogs } = useItemDialogs(access);

  const { queue, pickFiles, picker } = useSpaceUploads(spaceUuid);

  const targetOf = useCallback(
    (file: SpaceFile): SpaceItemTarget => ({
      type: 'file',
      id: file.id,
      name: file.original_name,
      space: { uuid: spaceUuid, name: spaceName },
    }),
    [spaceUuid, spaceName],
  );
  const moveFile = useCallback((file: SpaceFile) => openMove(targetOf(file)), [openMove, targetOf]);
  const removeFile = useCallback(
    (file: SpaceFile) => openRemove(targetOf(file)),
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

  const uploadButton = canAdd ? (
    <PillButton icon={Upload} onClick={pickFiles}>
      Upload
    </PillButton>
  ) : null;

  const body = (
    <>
      <ContentToolbar
        search={search}
        label="Search this space's files by name"
        placeholder="Search files"
        busy={query.isPlaceholderData}
        action={uploadButton}
      />
      {canAdd ? picker : null}
      <PagedContent
        tab="files"
        query={query}
        count={rows.length}
        dim={query.isPlaceholderData}
        empty={
          search.term ? (
            <SpaceContentNoMatchState
              query={search.term}
              action={<ClearSearchButton onClear={search.clear} />}
            />
          ) : (
            <SpaceContentEmptyState
              tab="files"
              canAdd={canAdd}
              action={
                <EmptyStateAddButton icon={Upload} onClick={pickFiles}>
                  Upload
                </EmptyStateAddButton>
              }
              onInvite={access.onInvite ?? undefined}
            />
          )
        }
      >
        <ul className="flex flex-col">
          {rows.map((file, index) => (
            <SpaceFileRow
              key={file.id}
              file={file}
              index={index}
              onMove={ownsItem(file.uploader.id, viewerId) ? moveFile : undefined}
              onRemoveFromSpace={canRemove ? removeFile : undefined}
              onCopyToMine={copyFile}
              onDelete={
                canDeleteSpaceFile({ my_content_role: access.contentRole }, file.uploader.id, viewerId)
                  ? deleteFile
                  : undefined
              }
            />
          ))}
        </ul>
      </PagedContent>
      {dialogs}
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

  // A Viewer gets the list and nothing to drop onto.
  return canAdd ? (
    <FileDropZone spaceName={spaceName} onDrop={queue.add}>
      {body}
    </FileDropZone>
  ) : (
    body
  );
}

/**
 * FileDropZone — files dragged from the desktop onto the Files tab join the
 * upload queue, exactly as if they were picked (Spaces F3). Only a drag that
 * carries FILES lights it up, so dragging text or a link across the page does
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

/** The row above a tab's list: its search, and the tab's add control. */
function ContentToolbar({
  search,
  label,
  placeholder,
  busy,
  action = null,
}: {
  search: ServerSearch;
  label: string;
  placeholder: string;
  busy: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <SearchField
        className="min-w-0 flex-1"
        value={search.value}
        onChange={search.setValue}
        onClear={search.clear}
        placeholder={placeholder}
        label={label}
        busy={busy}
      />
      {action}
    </div>
  );
}

/** The toolbar's add control, the folders list's own "New folder" pill: the
 *  label on a desktop, the icon alone on a phone with the word kept for
 *  screen readers. Beside the search field the icon reads; alone in an empty
 *  state it would not, so the empty state has `EmptyStateAddButton`. */
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
      <span className="sr-only sm:not-sr-only">{children}</span>
    </button>
  );
}

/** The empty state's add control: the same action, with its word at every
 *  width, in the shape the other empty-state actions take ("Go to your
 *  conversations"). A bare "+" or upload glyph centred under "No folders in
 *  this space yet" was a guess on a phone (design round 2). */
function EmptyStateAddButton({
  icon: Icon,
  onClick,
  variant,
  children,
}: {
  icon: typeof Plus;
  onClick: () => void;
  /** `outline` for the empty Conversations tab, whose main action is the box
   *  docked under it. */
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

function ClearSearchButton({ onClear }: { onClear: () => void }) {
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClear}>
      Clear search
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
 * The one body all three tabs share, so their states cannot drift: skeleton
 * on a first load, the failure panel when nothing loaded, the tab's empty
 * state (`empty`, which the tab picks: teaching, no match, or an empty
 * level), or the rows with the next-page sentinel under them, dimmed while a
 * new search is on its way.
 */
function PagedContent({
  tab,
  query,
  count,
  dim,
  empty,
  children,
}: {
  tab: SpaceContentTab;
  query: PagedQuery;
  /** How many rows are loaded: every state decision reads this. */
  count: number;
  /** A new search is loading behind the rows on screen. */
  dim: boolean;
  /** What the tab shows with no rows. */
  empty: ReactNode;
  children: ReactNode;
}) {
  // The pane this panel scrolls in, found from the panel's own element. Set in
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
        <SpaceContentSkeleton tab={tab} />
      ) : query.isError && count === 0 ? (
        <SpaceContentErrorState
          tab={tab}
          message={message}
          onRetry={() => void refetch()}
        />
      ) : count === 0 ? (
        empty
      ) : (
        <div
          className={cn(
            'transition-opacity duration-200 motion-reduce:transition-none',
            dim && 'pointer-events-none opacity-60',
          )}
        >
          {children}
          <div ref={sentinelRef} className="pt-1">
            {query.isFetchingNextPage ? (
              <SpaceContentNextPageSkeleton tab={tab} />
            ) : null}
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
