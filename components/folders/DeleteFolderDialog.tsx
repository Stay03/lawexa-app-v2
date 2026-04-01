'use client';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteFolder } from '@/lib/hooks/useFolders';
import { extractApiError } from '@/lib/utils/api-error';
import type { FolderDetail } from '@/types/folder';

/******************************************************************************
                               Types
******************************************************************************/

type DeleteableFolder = Pick<FolderDetail, 'uuid' | 'name' | 'children_count'>;

interface DeleteFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: DeleteableFolder;
  onDeleted?: () => void;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Confirmation dialog for deleting a folder.
 */
function DeleteFolderDialog({
  open,
  onOpenChange,
  folder,
  onDeleted,
}: DeleteFolderDialogProps) {
  const deleteFolder = useDeleteFolder();

  const handleDelete = async () => {
    try {
      await deleteFolder.mutateAsync(folder.uuid);
      toast.success('Folder deleted', {
        description: `"${folder.name}" and its subfolders have been moved to trash.`,
      });
      onOpenChange(false);
      onDeleted?.();
    } catch (error) {
      const apiError = extractApiError(error);
      toast.error('Failed to delete folder', {
        description: apiError.message,
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete folder?</AlertDialogTitle>
          <AlertDialogDescription>
            This will delete &ldquo;{folder.name}&rdquo;
            {folder.children_count > 0 &&
              ` and ${folder.children_count} ${folder.children_count === 1 ? 'subfolder' : 'subfolders'}`
            }.
            Items inside will not be deleted. You can restore it later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteFolder.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteFolder.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export { DeleteFolderDialog };
