'use client';

import { useRef, useState, type ReactNode } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Blocks, Check, FileText, FolderPlus, Loader2, Plus, Upload, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { filesApi } from '@/lib/api/files';
import { spacesApi } from '@/lib/api/collab';
import { formatBytes } from '@/lib/utils/format-bytes';
import { FILES_ACCEPT, fileTypeLabel } from '@/v2/features/spaces/content-model';
import { invalidateSpaceContents } from '@/v2/features/spaces/content-mutations';
import { spacesQueries } from '@/v2/features/spaces/queries';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { foldersApi } from '../api';
import {
  FOLDER_ITEM_INVALIDATES,
  isAlreadyInFolder,
  useAddItemToFolder,
  type FolderItemTarget,
} from '../item-mutations';
import { FiledAfterUploadError, sendFolderUpload } from './folder-upload';

/**
 * FolderAdd — how things get INTO a folder from the folder itself (Arthur, 17
 * October 2026, items 8 and 9: the "+" "has no label, so its purpose is
 * unclear"; it "ideally offers the different kinds of content a folder can
 * hold"; the empty folder should "let users start adding from right there").
 *
 * ── ONE "ADD", THREE WAYS IN ───────────────────────────────────────────────
 *  - New subfolder (what the "+" did).
 *  - Files from this space, for a folder in a space: the space's own files,
 *    added with a tap (`POST /folders/{uuid}/items`). Chats are not offered:
 *    v2 folders neither add nor draw conversations (decision 4,
 *    `item-row-model.ts`), until the backend can keep a folder from serving a
 *    chat its reader cannot open (techlead, 18 October 2026, option A).
 *  - Upload a file. In a space folder it goes to the space first
 *    (`POST /spaces/{uuid}/files`), so every member has it, and is then filed
 *    here; in a personal folder it goes to the reader's own files
 *    (`POST /files/documents`, or `POST /files` for a picture), then is filed.
 *  - From Library: the library picker (`LibraryPicker`), the cases and
 *    statutes lists and the reader's own notes, searched by the server, each
 *    row with its own Add (the second push, 18 October 2026). In a space
 *    folder a note goes in as the space's copy, and the reader's note stays
 *    theirs (Stay, 18 October 2026).
 *
 * ── WHO ADDS ────────────────────────────────────────────────────────────────
 * The server's rule (`FolderService::canManageItems`): a personal folder's
 * creator; in a space folder, the space's Owner and every Contributor, with
 * all four choices. A Viewer only reads. The host decides and renders none
 * of this for anyone else; nothing here widens who may add.
 */

/** The folder a choice adds to, as the page knows it. */
export interface AddTarget {
  uuid: string;
  name: string;
  space: { uuid: string; name: string } | null;
}

/** The choices that exist for this folder; `fromSpace` only in a space. */
export interface AddChoices {
  newSubfolder: () => void;
  fromSpace: (() => void) | null;
  upload: () => void;
  library: () => void;
}

const ADD_PILL = cn(
  'v2-interactive inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary data-[state=open]:bg-secondary',
  FOCUS_RING,
);

/** The folder's "Add" button and its menu, with its word at every width. */
export function FolderAddMenu({ choices }: { choices: AddChoices }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={ADD_PILL}>
        <Plus aria-hidden className="size-4" />
        Add
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {choices.fromSpace ? (
          <DropdownMenuItem onSelect={choices.fromSpace}>
            <Blocks />
            Files from this space
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={choices.upload}>
          <Upload />
          Upload a file
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={choices.library}>
          <BookOpen />
          From Library
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={choices.newSubfolder}>
          <FolderPlus />
          New subfolder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The same choices as buttons, for the empty folder (item 9). */
export function FolderAddButtons({ choices }: { choices: AddChoices }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {choices.fromSpace ? (
        <Button type="button" size="sm" onClick={choices.fromSpace}>
          <Blocks aria-hidden className="size-4" />
          Files from this space
        </Button>
      ) : null}
      <Button type="button" size="sm" variant={choices.fromSpace ? 'outline' : 'default'} onClick={choices.upload}>
        <Upload aria-hidden className="size-4" />
        Upload a file
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={choices.library}>
        <BookOpen aria-hidden className="size-4" />
        From Library
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={choices.newSubfolder}>
        <FolderPlus aria-hidden className="size-4" />
        New subfolder
      </Button>
    </div>
  );
}

/* ── Upload ──────────────────────────────────────────────────────────────── */

/**
 * Upload into the folder: the file's store first, then the folder. A picked
 * file is checked against the upload rules before anything is sent, and each
 * file's toast walks from "Uploading" to its outcome in place
 * (`sendFolderUpload`).
 */
export function useFolderUpload(folder: AddTarget): { pick: () => void; input: ReactNode } {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      // A picture goes to POST /files/documents too, which files it as an
      // image; POST /files is the note editor's store (`file-mutations.ts`).
      const stored = folder.space
        ? await spacesApi.uploadFile(folder.space.uuid, file)
        : await filesApi.uploadDocument(file);
      try {
        await foldersApi.addItem(folder.uuid, { type: 'file', id: stored.data.id });
      } catch (error) {
        throw new FiledAfterUploadError(error);
      }
    },
    meta: { silentError: true, invalidates: FOLDER_ITEM_INVALIDATES },
    onSettled: () => {
      if (folder.space) void invalidateSpaceContents(queryClient, folder.space.uuid);
    },
  });
  const uploadAsync = upload.mutateAsync;

  const send = (file: File) => {
    void sendFolderUpload(file, { folder, upload: uploadAsync, notices: toast });
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

/* ── Files from this space ───────────────────────────────────────────────── */

/**
 * The space's files, newest first, each with its own Add. A file the folder
 * already holds answers "already in the folder" (a 422 with no `errors`,
 * `isAlreadyInFolder`), which the row shows as done rather than as a failure.
 */
export function SpaceFilesDialog({
  open,
  onOpenChange,
  folder,
  space,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: AddTarget;
  space: { uuid: string; name: string };
}) {
  const { userId: viewerId } = useV2Session();
  const query = useInfiniteQuery({
    ...spacesQueries.items(space.uuid, { viewerId, type: 'files' }),
    enabled: open,
  });
  const files = (query.data?.pages ?? []).flatMap((page) =>
    page.data.flatMap((entry) => (entry.type === 'file' ? [entry.item] : [])),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Files from {space.name}</DialogTitle>
          <DialogDescription>
            Add a file to {folder.name}. It stays in the space as well.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-2 max-h-[min(60vh,28rem)] overflow-y-auto overscroll-y-contain">
          {query.isPending ? (
            <div aria-hidden className="flex flex-col gap-1 px-2">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-14 animate-pulse rounded-xl bg-secondary/60" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="flex flex-col items-center gap-3 px-2 py-6 text-center text-sm text-muted-foreground">
              <p>Couldn&rsquo;t load the space&rsquo;s files.</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>
                Try again
              </Button>
            </div>
          ) : files.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No files in this space yet. Choose &ldquo;Upload a file&rdquo; to add one here and to the space.
            </p>
          ) : (
            <ul className="flex flex-col px-2">
              {files.map((file) => (
                <AddChoiceRow
                  key={file.id}
                  target={{ type: 'file', contentId: file.id }}
                  icon={FileText}
                  title={file.original_name}
                  meta={`${fileTypeLabel(file)} · ${formatBytes(file.size)}`}
                  folderUuid={folder.uuid}
                />
              ))}
            </ul>
          )}
          {query.hasNextPage ? (
            <div className="flex justify-center px-2 pt-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                {query.isFetchingNextPage ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                More files
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One thing to add, with its own Add: a space's file, a case, a statute, a
 * note. Filed by its numeric id. A thing the folder already holds answers
 * "already in the folder" (a 422 with no `errors`), shown as done, not as a
 * failure.
 */
export function AddChoiceRow({
  target,
  icon: Icon,
  title,
  meta,
  folderUuid,
}: {
  target: FolderItemTarget;
  icon: LucideIcon;
  title: string;
  meta: string;
  folderUuid: string;
}) {
  const add = useAddItemToFolder(target, { silentError: true });
  const [state, setState] = useState<'idle' | 'added' | 'already' | 'failed'>('idle');
  const done = state === 'added' || state === 'already';

  return (
    <li className="flex min-h-14 items-center gap-3 rounded-xl px-1 py-2">
      <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground" title={title}>
          {title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {state === 'already' ? 'Already in this folder' : state === 'failed' ? 'Couldn’t add it. Try again.' : meta}
        </span>
      </span>
      <Button
        type="button"
        size="sm"
        variant={done ? 'ghost' : 'outline'}
        disabled={done || add.isPending}
        aria-label={done ? `${title} is in this folder` : `Add ${title}`}
        onClick={() =>
          add.mutate(
            { folderUuid },
            {
              onSuccess: () => setState('added'),
              onError: (error) => setState(isAlreadyInFolder(error) ? 'already' : 'failed'),
            },
          )
        }
      >
        {add.isPending ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : done ? (
          <Check aria-hidden className="size-4" />
        ) : null}
        {done ? 'Added' : 'Add'}
      </Button>
    </li>
  );
}
