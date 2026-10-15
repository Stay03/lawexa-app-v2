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
import { COLLAB_DIALOG_SURFACE } from '@/v2/features/collab/kit/dialog-surface';
import { useDeleteSpaceFile } from '../../content-mutations';
import { spaceFileRefusal } from '../../content-model';

/**
 * DeleteSpaceFileDialog — the confirm before a space's file is deleted for
 * everyone (backend, 15 October 2026: the space's Owner any file, a
 * Contributor what they uploaded). It says that the file goes for every
 * member, and that a copy someone saved to their own files stays, because a
 * copy is a separate file. A refusal is shown in place and the dialog stays.
 *
 * Hosts mount this only while it is open, so each open starts clean.
 */
export function DeleteSpaceFileDialog({
  spaceUuid,
  spaceName,
  file,
  open,
  onOpenChange,
}: {
  spaceUuid: string;
  spaceName: string;
  file: { id: number; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const remove = useDeleteSpaceFile(spaceUuid);
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    setError(null);
    remove.mutate(file.id, {
      onSuccess: () => {
        onOpenChange(false);
        toast.success(`Deleted “${file.name}”`);
      },
      onError: (mutationError) => {
        const apiError = extractApiError(mutationError);
        setError(spaceFileRefusal('delete', apiError.status, apiError.message));
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => (remove.isPending ? undefined : onOpenChange(next))}>
      <AlertDialogContent className={COLLAB_DIALOG_SURFACE}>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Delete “${file.name}”?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {`It is deleted from ${spaceName} for every member. A copy anyone saved to their own files stays.`}
          </AlertDialogDescription>
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
