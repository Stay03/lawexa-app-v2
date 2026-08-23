'use client';

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
import type { CasePrincipleReviewItem } from '@/types/admin-case-principles';

interface PrincipleRejectDialogProps {
  principle: CasePrincipleReviewItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (principle: CasePrincipleReviewItem) => void;
}

/**
 * Confirm only — no request happens here. Rejection hard-deletes with no
 * archive, so the page holds the actual call for a few seconds behind an Undo
 * toast after this confirm: the one undo that can exist for a hard delete is
 * the one before the request leaves.
 */
export function PrincipleRejectDialog({
  principle,
  open,
  onOpenChange,
  onConfirm,
}: PrincipleRejectDialogProps) {
  const handleConfirm = () => {
    if (!principle) return;
    onConfirm(principle);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject this principle?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the extraction — there is no archive. The
            case keeps its other principles. You get a few seconds to undo
            before anything is sent.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {principle && (
          <p className="line-clamp-4 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            {principle.principle}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={handleConfirm}>
            Reject
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
