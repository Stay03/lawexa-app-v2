'use client';

import { Loader2, AlertTriangle, Star, MessageSquare } from 'lucide-react';
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

import { useDeleteAiWorkflow } from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminAiWorkflow } from '@/types/admin-ai';

interface AiWorkflowDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow: AdminAiWorkflow | null;
}

export function AiWorkflowDeleteDialog({
  open,
  onOpenChange,
  workflow,
}: AiWorkflowDeleteDialogProps) {
  const deleteMutation = useDeleteAiWorkflow();

  const handleDelete = () => {
    if (!workflow) return;

    deleteMutation.mutate(workflow.id, {
      onSuccess: (response) => {
        toast.success(response.message);
        onOpenChange(false);
      },
      onError: (error) => {
        const apiError = extractApiError(error);
        toast.error(apiError.message);
      },
    });
  };

  if (!workflow) return null;

  const isDefault = workflow.is_default;
  const hasConversations = (workflow.conversations_count ?? 0) > 0;
  const canDelete = !isDefault && !hasConversations;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete{' '}
                <span className="font-semibold text-foreground">
                  {workflow.name}
                </span>
                ?
              </p>

              {isDefault && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <Star className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="text-sm text-destructive">
                    <p>
                      This is the default workflow and cannot be deleted.
                      Change the default to another workflow first.
                    </p>
                  </div>
                </div>
              )}

              {!isDefault && hasConversations && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <MessageSquare className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="text-sm text-destructive space-y-1">
                    <p>
                      This workflow has {workflow.conversations_count}{' '}
                      {workflow.conversations_count === 1 ? 'conversation' : 'conversations'}{' '}
                      and cannot be deleted.
                    </p>
                    <p className="text-muted-foreground">
                      Consider deactivating it instead.
                    </p>
                  </div>
                </div>
              )}

              {canDelete && (
                <p className="text-sm">This action cannot be undone.</p>
              )}
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
            disabled={!canDelete || deleteMutation.isPending}
          >
            {deleteMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Delete Workflow
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
