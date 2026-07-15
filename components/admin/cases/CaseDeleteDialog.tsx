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

import { useDeleteCase } from '@/lib/hooks/useAdminCases';
import { extractApiError } from '@/lib/utils/api-error';
import type { CaseDetail, CaseSummary } from '@/types/admin-cases';
import { getCaseDisplayTitle } from '@/lib/utils/case-title';

/******************************************************************************
                                Component Props
******************************************************************************/

interface CaseDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  case: CaseDetail | CaseSummary | null;
  onSuccess?: () => void;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Confirmation dialog for case deletion
 * Shows warnings if case has files or is cited by other cases
 */
export function CaseDeleteDialog({
  open,
  onOpenChange,
  case: caseData,
  onSuccess,
}: CaseDeleteDialogProps) {
  const deleteMutation = useDeleteCase();

  const handleDelete = () => {
    if (!caseData) return;

    deleteMutation.mutate(caseData.id, {
      onSuccess: (response) => {
        toast.success(response.message || 'Case deleted successfully');
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (error) => {
        const apiError = extractApiError(error);
        toast.error(apiError.message);
      },
    });
  };

  if (!caseData) return null;

  // Check for related data (only available in CaseDetail)
  const hasFiles =
    'files' in caseData && Array.isArray(caseData.files) && caseData.files.length > 0;
  const citedByCount =
    'cited_by_count' in caseData ? caseData.cited_by_count : 0;

  const hasWarnings = hasFiles || citedByCount > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Case</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete{' '}
                <span className="font-semibold text-foreground">
                  {getCaseDisplayTitle(caseData)}
                </span>
                ?
              </p>

              {/* Warning: Files attached */}
              {hasFiles && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-destructive">
                    This case has {'files' in caseData ? caseData.files.length : 0}{' '}
                    attached {
                      'files' in caseData && caseData.files.length === 1
                        ? 'file'
                        : 'files'
                    }
                    . All files will be permanently deleted.
                  </p>
                </div>
              )}

              {/* Warning: Cited by other cases */}
              {citedByCount > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-destructive">
                    This case is cited by {citedByCount} other{' '}
                    {citedByCount === 1 ? 'case' : 'cases'}. Those references
                    will be removed.
                  </p>
                </div>
              )}

              <p className="text-sm">This action cannot be undone.</p>
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
            Delete Case
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
