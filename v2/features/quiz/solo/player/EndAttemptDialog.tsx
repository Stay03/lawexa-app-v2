'use client';

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
import { endAttemptCopy } from '../model';

/**
 * EndAttemptDialog — "End quiz" during play, and its confirmation (Arthur, 24
 * October 2026: a way to end the quiz you started, then the results for what
 * was answered).
 *
 * Ending is one-way: the attempt is scored on what was answered, and the rest
 * count as wrong. So it asks first, and says exactly that.
 *
 * THE DIALOG STAYS OPEN WHILE IT ENDS (the practice quiz's EndSessionDialog
 * pattern): Radix's action closes on click, which would tear the dialog down
 * before the request settles, so the click is held and the button shows that
 * it is ending. Success leaves for the results; a failure closes it and the
 * player says why.
 */
export function EndAttemptDialog({
  open,
  answered,
  total,
  ending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  answered: number;
  total: number;
  ending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = endAttemptCopy(answered, total);
  return (
    <AlertDialog open={open} onOpenChange={(next) => (!next && !ending ? onCancel() : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>End this quiz?</AlertDialogTitle>
          <AlertDialogDescription>{copy}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={ending}>Keep playing</AlertDialogCancel>
          <AlertDialogAction
            disabled={ending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {ending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {ending ? 'Ending…' : 'End quiz'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
