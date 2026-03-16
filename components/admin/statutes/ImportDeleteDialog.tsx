'use client';

import { Loader2 } from 'lucide-react';
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

import { useDeleteImportRecord } from '@/lib/hooks/useAdminStatutes';
import { extractApiError } from '@/lib/utils/api-error';
import type { StatuteImport } from '@/types/admin-statutes';

/******************************************************************************
                                Component Props
******************************************************************************/

interface ImportDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importRecord: StatuteImport | null;
  onSuccess?: () => void;
}

/******************************************************************************
                                Main Component
******************************************************************************/

export function ImportDeleteDialog({
  open,
  onOpenChange,
  importRecord,
  onSuccess,
}: ImportDeleteDialogProps) {
  const deleteMutation = useDeleteImportRecord();

  const handleDelete = () => {
    if (!importRecord) return;

    deleteMutation.mutate(importRecord.id, {
      onSuccess: (response) => {
        toast.success(response.message || 'Import record deleted');
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (error) => {
        const apiError = extractApiError(error);
        toast.error(apiError.message);
      },
    });
  };

  if (!importRecord) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Import Record</AlertDialogTitle>
          <AlertDialogDescription>
            Remove the import record for{' '}
            <span className="font-semibold text-foreground">
              {importRecord.original_filename}
            </span>
            ? This does not delete the associated statute.
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
            Delete Record
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
