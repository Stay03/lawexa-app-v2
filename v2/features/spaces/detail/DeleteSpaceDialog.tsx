'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

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
import type { Space } from '@/types/collab';
import { COLLAB_DIALOG_SURFACE } from '@/v2/features/collab/kit/dialog-surface';
import { isSharedSpace } from '../model';
import { useDeleteSpace } from '../mutations';

/**
 * DeleteSpaceDialog — the Owner's confirm before a space is deleted for
 * everyone.
 *
 * It has two doors since design round 1 (12 October 2026): the space menu's
 * "Delete space", and the members sheet's footer for the last Owner of a space
 * nobody else is in, who has no one to hand it to and used to meet a dialog
 * with no way forward. Both live in different components, so the dialog is
 * mounted once by `CollabFrame` and both ask it to open.
 *
 * Its open state is deliberately NOT in the URL: a shareable, refresh-surviving
 * link that re-opens "Delete this space?" is an armed trigger, and the dialog
 * carries the server's sentence from the last failed attempt, which a restored
 * URL cannot reproduce. The error is cleared on every close.
 */
export function DeleteSpaceDialog({
  space,
  open,
  onOpenChange,
}: {
  space: Space;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const deleteSpace = useDeleteSpace(space.uuid);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    setError(null);
    deleteSpace.mutate(undefined, {
      onSuccess: () => {
        onOpenChange(false);
        router.push('/spaces');
      },
      onError: (failure) => setError(extractApiError(failure).message),
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setError(null);
      }}
    >
      <AlertDialogContent className={COLLAB_DIALOG_SURFACE}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {space.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {/* A shared space has no channels, so it does not promise to
                delete any (Spaces F2). */}
            {isSharedSpace(space)
              ? 'This deletes the space for everyone. It can’t be undone.'
              : 'This deletes the space and every channel in it, for everyone. It can’t be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteSpace.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              handleDelete();
            }}
            disabled={deleteSpace.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteSpace.isPending ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : null}
            Delete space
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
