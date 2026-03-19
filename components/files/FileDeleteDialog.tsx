'use client';

import { Loader2, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { useDeleteFile } from '@/lib/hooks/useFiles';
import type { UserFile } from '@/types/file';

interface FileDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: UserFile | null;
}

export function FileDeleteDialog({
  open,
  onOpenChange,
  file,
}: FileDeleteDialogProps) {
  const deleteMutation = useDeleteFile();

  const handleDelete = () => {
    if (!file) return;

    deleteMutation.mutate(file.id, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  if (!file) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete File</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete{' '}
                <span className="font-semibold text-foreground">
                  {file.original_name}
                </span>
                ?
              </p>

              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">
                  This will permanently delete the file. This action cannot be
                  undone.
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Delete File
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
