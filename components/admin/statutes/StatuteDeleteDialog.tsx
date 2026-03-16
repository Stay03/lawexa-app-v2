'use client';

import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { useDeleteStatute } from '@/lib/hooks/useAdminStatutes';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminStatute } from '@/types/admin-statutes';

/******************************************************************************
                                Component Props
******************************************************************************/

interface StatuteDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statute: AdminStatute | null;
  onSuccess?: () => void;
}

/******************************************************************************
                                Main Component
******************************************************************************/

export function StatuteDeleteDialog({
  open,
  onOpenChange,
  statute,
  onSuccess,
}: StatuteDeleteDialogProps) {
  const deleteMutation = useDeleteStatute();

  const handleDelete = () => {
    if (!statute) return;

    deleteMutation.mutate(statute.id, {
      onSuccess: (response) => {
        toast.success(response.message || 'Statute deleted successfully');
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (error) => {
        const apiError = extractApiError(error);
        toast.error(apiError.message);
      },
    });
  };

  if (!statute) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Statute</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete{' '}
                <span className="font-semibold text-foreground">
                  {statute.title}
                </span>
                ?
              </p>

              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">
                  This will permanently delete the statute and all its nodes.
                  This action cannot be undone.
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
            Delete Statute
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
