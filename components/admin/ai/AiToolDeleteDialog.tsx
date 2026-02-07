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

import { useDeleteAiTool } from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminAiTool } from '@/types/admin-ai';

interface AiToolDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: AdminAiTool | null;
}

export function AiToolDeleteDialog({
  open,
  onOpenChange,
  tool,
}: AiToolDeleteDialogProps) {
  const deleteMutation = useDeleteAiTool();

  const handleDelete = () => {
    if (!tool) return;

    deleteMutation.mutate(tool.id, {
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

  if (!tool) return null;

  const hasAgents = (tool.agents_count ?? 0) > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Tool</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete{' '}
                <span className="font-semibold text-foreground">
                  {tool.display_name}
                </span>
                ?
              </p>
              {hasAgents && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="text-sm text-destructive space-y-1">
                    <p>
                      This tool is assigned to {tool.agents_count}{' '}
                      {tool.agents_count === 1 ? 'agent' : 'agents'}.
                      You cannot delete a tool that is assigned to agents.
                    </p>
                    <p className="text-muted-foreground">
                      Detach the tool from all agents first.
                    </p>
                  </div>
                </div>
              )}
              {!hasAgents && (
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
            disabled={hasAgents || deleteMutation.isPending}
          >
            {deleteMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Delete Tool
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
