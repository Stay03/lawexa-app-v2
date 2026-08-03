'use client';

import { Loader2, Square } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

/**
 * EndSessionDialog — the "End" control and its confirm.
 *
 * Ending is not destructive, but it IS one-way: the score finalizes, the
 * session closes, and "retry" means a NEW session rather than reopening this
 * one. So it earns a confirm, and the copy says exactly that instead of
 * implying the session can be resumed later.
 *
 * THE DIALOG OWNS ITS OWN CLOSE (the established v2 pattern — see
 * `ArchiveRadarDialog`). Radix's `AlertDialogAction` auto-closes on click,
 * which would tear the dialog down BEFORE the request settles: the pending
 * spinner could never render, and a failure would leave the reader looking at
 * a session they believe they ended. `preventDefault` keeps it open — the
 * confirm button shows its live pending state, success closes it and navigates
 * from the caller's `onConfirm`, and a failure keeps it open while the global
 * error channel reports why.
 */
export function EndSessionDialog({
  open,
  onOpenChange,
  onConfirm,
  ending,
  disabled = false,
  answeredCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fires the end mutation. The CALLER closes the dialog in its `onSuccess`. */
  onConfirm: () => void;
  ending: boolean;
  /**
   * Block the trigger while another write owns the session — the player passes
   * `submitAnswer.isPending`, because ending mid-answer races two writes and
   * makes the answer 409 for a reason the reader cannot see.
   */
  disabled?: boolean;
  answeredCount: number;
}) {
  const confirm = (event: React.MouseEvent) => {
    // Stop Radix's auto-close so the dialog outlives the request — see above.
    event.preventDefault();
    onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          disabled={disabled || ending}
        >
          <Square aria-hidden className="size-4" />
          End
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>End this session?</AlertDialogTitle>
          <AlertDialogDescription>
            {answeredCount > 0
              ? `Your score is finalized on ${answeredCount === 1 ? 'the 1 question' : `all ${answeredCount} questions`} you answered, and every answer is revealed with its explanation. This session can't be reopened — starting again begins a fresh one.`
              : "You haven't answered anything yet, so there is nothing to score. This session can't be reopened — starting again begins a fresh one."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={ending}>Keep playing</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={ending}>
            {ending ? <Loader2 aria-hidden className="animate-spin" /> : null}
            End and see answers
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
