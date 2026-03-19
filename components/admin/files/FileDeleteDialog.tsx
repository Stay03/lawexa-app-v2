'use client';

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
import { Loader2 } from 'lucide-react';
import { useAdminDeleteFile } from '@/lib/hooks/useAdminFiles';

interface FileDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: number | null;
  fileName: string;
}

export function FileDeleteDialog({
  open,
  onOpenChange,
  fileId,
  fileName,
}: FileDeleteDialogProps) {
  const deleteFile = useAdminDeleteFile();

  function handleDelete() {
    if (!fileId) return;
    deleteFile.mutate(fileId, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete File</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{' '}
            <span className="font-medium text-foreground">{fileName}</span>?
            This will permanently remove the file from storage and cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteFile.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteFile.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteFile.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
