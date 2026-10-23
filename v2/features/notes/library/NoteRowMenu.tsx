'use client';

import Link from 'next/link';
import { Bookmark, Download, EllipsisVertical, FolderPlus, Pencil, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useV2Session } from '@/v2/runtime/session-context';
import { useGuestSignIn } from '@/v2/runtime/sign-in-first';
import { ROW_MENU_TRIGGER_CLASS } from '@/v2/features/folders/file-list/FileListRow';
import { useShareAction } from '@/v2/features/sharing/use-share-action';
import { useToggleNoteBookmark } from '../bookmark/mutations';
import type { NoteRowModel } from '../note-row-model';
import { NOTE_EXPORT_FORMAT_KEYS, NOTE_EXPORT_FORMATS, useNoteExport } from '../use-note-export';

/**
 * The "⋮" on a note row (the owner's take A, 23 October 2026): the row has no
 * bookmark icon of its own, so everything a reader does to a note from the
 * list is here, in the reader's order.
 *
 *   Save / Remove from Saved   the bookmark toggle (`useToggleNoteBookmark`),
 *                              with a toast, as the row no longer shows a star
 *   Add to folder              the shared `FolderPicker`, opened by the list
 *   Share                      `useShareAction`, the Share pill's behaviour
 *   Export                     Word or PDF (`useNoteExport`, the reader's menu)
 *   Edit, Delete               the reader's own notes only
 *
 * A GUEST'S Save and Add to folder go to sign in, as the reader's pills do
 * (`useGuestSignIn`). A Space's copy offers no Add to folder (the server files
 * it only in its own Space's folders) and no Delete (a copy leaves its Space
 * by being removed from its folder), the rules `NoteDocument` and the editor
 * keep.
 *
 * The picker and the delete dialog belong to the LIST (`NotesBrowser`), so
 * one of each serves every row and the picker's Undo outlives a row that
 * leaves the list. `onAddToFolder` and `onDelete` must be stable, like the row.
 */
export function NoteRowMenu({
  row,
  onAddToFolder,
  onDelete,
}: {
  row: NoteRowModel;
  onAddToFolder: (row: NoteRowModel) => void;
  onDelete: (row: NoteRowModel) => void;
}) {
  const { signedIn } = useV2Session();
  const signIn = useGuestSignIn();
  const toggleBookmark = useToggleNoteBookmark(row.id);
  // The menu has closed by the time either lands, so a toast says it.
  const share = useShareAction({
    path: row.href,
    title: row.hasTitle ? row.title : null,
    onCopied: () => toast.success('Link copied'),
  });
  const { download, exporting } = useNoteExport(row.slug);

  const save = () => {
    if (signIn) {
      signIn();
      return;
    }
    const next = !row.isBookmarked;
    toggleBookmark.mutate(
      { next },
      { onSuccess: () => toast.success(next ? 'Saved' : 'Removed from Saved') },
    );
  };

  const addToFolder = () => {
    if (signIn) {
      signIn();
      return;
    }
    onAddToFolder(row);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(ROW_MENU_TRIGGER_CLASS, FOCUS_RING)}
        aria-label={`Actions for ${row.title}`}
      >
        <EllipsisVertical aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={save}>
          <Bookmark aria-hidden className={cn('size-4', row.isBookmarked && 'fill-current text-primary')} />
          {row.isBookmarked ? 'Remove from Saved' : 'Save'}
        </DropdownMenuItem>
        {signedIn && !row.isSpaceCopy ? (
          <DropdownMenuItem onSelect={addToFolder}>
            <FolderPlus aria-hidden className="size-4" />
            Add to folder
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => void share.share()}>
          <Share2 aria-hidden className="size-4" />
          Share
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={exporting}>
            <Download aria-hidden className="size-4" />
            {exporting ? 'Exporting…' : 'Export'}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            {NOTE_EXPORT_FORMAT_KEYS.map((format) => {
              const { label, icon: Icon } = NOTE_EXPORT_FORMATS[format];
              return (
                <DropdownMenuItem key={format} disabled={exporting} onSelect={() => void download(format)}>
                  <Icon aria-hidden className="size-4" />
                  {label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {row.canEdit ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`${row.href}/edit`}>
                <Pencil aria-hidden className="size-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            {row.isSpaceCopy ? null : (
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(row)}>
                <Trash2 aria-hidden className="size-4" />
                Delete
              </DropdownMenuItem>
            )}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
