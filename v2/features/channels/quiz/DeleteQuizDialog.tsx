'use client';

import { useState } from 'react';
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
import type { ChannelQuiz } from '@/types/channel-quiz';
import { useHeldValue } from '../use-held-value';
import { useDeleteQuiz } from './mutations';

/**
 * DeleteQuizDialog — the one confirmation for deleting a quiz, wherever its
 * row is: the channel sheet, the library page, the quiz front. Moved out of
 * `QuizLibrarySheet` on 2026-10-21 when the library page needed the same
 * dialog; nothing about it changed.
 *
 * `onDeleted` is for a surface that is ABOUT the quiz (its front): the row
 * surfaces leave it out, because their list simply loses the row.
 */
export function DeleteQuizDialog({
  quiz,
  onClose,
  onDeleted,
}: {
  quiz: ChannelQuiz | null;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  /** The quiz this dialog is ABOUT, held through its own exit (the house
   *  primitive, same as the composer's reply bar). `quiz` goes null the instant
   *  the delete succeeds or the reader cancels, and the heading is written from
   *  it — so without this the title read "Delete ?" for the length of the fade,
   *  which is the last thing a destructive confirmation should say on its way
   *  out. It also keeps the mutation pointed at a stable uuid across that frame. */
  const shown = useHeldValue(quiz);
  const deleteQuiz = useDeleteQuiz(shown?.uuid ?? '');
  const [error, setError] = useState<string | null>(null);
  /** The refusal held through the same exit, for the same reason the title is:
   *  it is cleared on close, so a dialog dismissed after a failed delete would
   *  drop its explanation a frame before it finished fading. An OPEN dialog
   *  always reads the live value, so pressing Delete again clears it at once. */
  const heldError = useHeldValue(error);
  const shownError = quiz !== null ? error : heldError;

  return (
    <AlertDialog
      open={quiz !== null}
      onOpenChange={(next) => {
        if (!next) {
          setError(null);
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {shown?.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            The quiz goes away for everyone, in every channel it has run in and
            for anyone who has its link. Games already played keep their
            results.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {shownError && <p className="text-sm text-destructive">{shownError}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteQuiz.isPending}>
            Keep it
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              deleteQuiz.mutate(undefined, {
                onSuccess: () => {
                  onClose();
                  onDeleted?.();
                },
                onError: (mutationError) => {
                  const { status, message } = extractApiError(mutationError);
                  setError(
                    status === 409
                      ? 'This quiz is live right now. End the game first, then it can be deleted.'
                      : message,
                  );
                },
              });
            }}
            disabled={deleteQuiz.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteQuiz.isPending && (
              <Loader2 aria-hidden className="mr-1 size-4 animate-spin" />
            )}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
