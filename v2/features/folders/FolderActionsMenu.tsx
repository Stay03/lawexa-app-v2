'use client';

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useDeleteFolderWithUndo, type DeletableFolder } from './folder-mutations';

/**
 * FolderActionsMenu — the two things you can do TO a folder, in one menu, in
 * one place: the list row's trail and the folder page's header both render this
 * so the actions cannot drift apart (v1 had a menu on the card and a different
 * one on the page, and the page's was the only one that could delete).
 *
 * Creating a subfolder is deliberately NOT here. It is not something you do to
 * this folder, it is something you make inside it, and both screens give it a
 * visible pill of its own beside the list — the same affordance in the same
 * place, rather than a third menu item nobody would look for.
 *
 * DELETE LIVES HERE, NOT IN THE HOST. It is the one action with a window of
 * consequence, and putting the press beside its undo — see
 * `useDeleteFolderWithUndo` for why the undo precedes the request rather than
 * following it — means no host can ship a variant that deletes without one.
 * The host only says where to GO afterwards (`onDeleted`), which is the one
 * thing the folder page needs and the list does not.
 *
 * NO CONFIRM DIALOG, deliberately (decision 6). The undo window is the safety
 * net, and it is a real one: nothing has been sent while it is open.
 */
export function FolderActionsMenu({
  folder,
  onRename,
  onDeleted,
  className,
}: {
  folder: DeletableFolder;
  /** Opens the host's rename dialog. */
  onRename: () => void;
  /** Where to go once the delete is queued — the folder page's route is about
   *  to stop existing. Omitted on the list, which simply loses a row. */
  onDeleted?: () => void;
  /** The trigger's classes (the row and the header sit on different baselines). */
  className?: string;
}) {
  const deleteFolder = useDeleteFolderWithUndo();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'v2-interactive flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground',
          FOCUS_RING,
          className,
        )}
        // The row's name is IN the accessible name, so moving down a column of
        // identical triggers is not five identical announcements.
        aria-label={`Actions for ${folder.name}`}
      >
        <MoreHorizontal aria-hidden className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onRename}>
          <Pencil />
          Rename
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            deleteFolder(folder);
            onDeleted?.();
          }}
        >
          <Trash2 />
          Delete folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
