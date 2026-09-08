'use client';

import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CaseArgumentReviewItem } from '@/types/admin-case-arguments';

interface ArgumentRejectDialogProps {
  argument: CaseArgumentReviewItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (argument: CaseArgumentReviewItem, reason: string) => void;
}

/**
 * The form, remounted per argument.
 *
 * The reason field must be empty for every row, and the way to get that is a
 * fresh mount rather than an effect that clears it: setState inside an effect
 * is a lint error in this repo and a cascading render everywhere else. The
 * parent gives this a `key`, so React does the resetting.
 */
function RejectForm({
  argument,
  onConfirm,
  onClose,
}: {
  argument: CaseArgumentReviewItem;
  onConfirm: (argument: CaseArgumentReviewItem, reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <>
      {argument.argument && (
        <p className="line-clamp-4 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          {argument.argument}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="argument-reject-reason">
          What is wrong with it?{' '}
          <span className="font-normal text-muted-foreground">optional</span>
        </Label>
        <Textarea
          id="argument-reject-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Not an argument. It is the court's own reasoning."
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          This is the only place we record what the AI got wrong.
        </p>
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <Button
          onClick={() => {
            onConfirm(argument, reason.trim());
            onClose();
          }}
        >
          Throw out
        </Button>
      </AlertDialogFooter>
    </>
  );
}

/**
 * Throw an argument out, with a reason.
 *
 * ── THIS IS NOT THE PRINCIPLE DIALOG AND MUST NOT READ LIKE IT ────────────
 * Rejecting a principle hard-deletes it, so that dialog warns and the page
 * holds the call behind an undo. Rejecting an ARGUMENT writes a stamp and
 * keeps the row, and Keep reverses it at any time. So there is no warning to
 * give and no deletion to delay, and the copy says what actually happens
 * instead of borrowing a fear that does not apply here.
 *
 * The reason is the point of the dialog rather than a formality. Nothing under
 * case_arguments is audited or soft-deleted, so a thrown-out row plus its
 * reason is the only record anywhere of what the extraction got wrong. It is
 * optional because a reviewer at speed should not be blocked, and asked for
 * because the row is worth more with it.
 */
export function ArgumentRejectDialog({
  argument,
  open,
  onOpenChange,
  onConfirm,
}: ArgumentRejectDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Throw this argument out?</AlertDialogTitle>
          <AlertDialogDescription>
            It stops being an argument on this case. Nothing is deleted, so
            what the AI wrote stays on record, and you can keep it after all at
            any time.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {argument && (
          <RejectForm
            key={argument.id}
            argument={argument}
            onConfirm={onConfirm}
            onClose={() => onOpenChange(false)}
          />
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
