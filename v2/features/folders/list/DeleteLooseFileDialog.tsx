'use client';

import { useState } from 'react';
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
import { extractApiError } from '@/lib/utils/api-error';
import { useDeleteOwnFile } from '../file-mutations';

/**
 * The confirm before one of the viewer's own files is deleted (build 6). A
 * delete is not undone, so it asks first, the way a space's file delete does
 * (`DeleteSpaceFileDialog`); a refusal is shown in place and the dialog stays.
 * The host mounts this only while it is open, so each open starts clean.
 */
export function DeleteLooseFileDialog({
  file,
  open,
  onOpenChange,
}: {
  file: { id: number; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const remove = useDeleteOwnFile();
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    setError(null);
    remove.mutate(file.id, {
      onSuccess: () => {
        onOpenChange(false);
        toast.success(`Deleted “${file.name}”`);
      },
      onError: (mutationError) => setError(extractApiError(mutationError).message),
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => (remove.isPending ? undefined : onOpenChange(next))}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Delete “${file.name}”?`}</AlertDialogTitle>
          <AlertDialogDescription>It is deleted from your files.</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          {/* The variant, not a class: a class override loses to the default
              gold (DeleteConversationDialog's note). */}
          <AlertDialogAction
            variant="destructive"
            onClick={(event) => {
              // Held open until the server answers, so a refusal can be read.
              event.preventDefault();
              confirm();
            }}
            disabled={remove.isPending}
          >
            {remove.isPending ? <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" /> : null}
            Delete file
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
