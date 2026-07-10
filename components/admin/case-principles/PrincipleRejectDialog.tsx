'use client';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { useRejectCasePrinciple } from '@/lib/hooks/useAdminCasePrinciples';
import { extractApiError } from '@/lib/utils/api-error';
import type { CasePrincipleReviewItem } from '@/types/admin-case-principles';

interface PrincipleRejectDialogProps {
  principle: CasePrincipleReviewItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrincipleRejectDialog({
  principle,
  open,
  onOpenChange,
}: PrincipleRejectDialogProps) {
  const rejectMutation = useRejectCasePrinciple();

  const handleReject = () => {
    if (!principle) return;
    rejectMutation.mutate(principle.id, {
      onSuccess: () => {
        toast.success('Principle rejected and removed');
        onOpenChange(false);
      },
      onError: (error) => toast.error(extractApiError(error).message),
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject this principle?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the extraction. The case keeps its other
            principles. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {principle && (
          <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground line-clamp-4">
            {principle.principle}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={rejectMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={rejectMutation.isPending}
          >
            {rejectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reject
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
