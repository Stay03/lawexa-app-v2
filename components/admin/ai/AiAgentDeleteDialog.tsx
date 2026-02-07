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

import { useDeleteAiAgent } from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminAiAgent } from '@/types/admin-ai';

interface AiAgentDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: AdminAiAgent | null;
}

export function AiAgentDeleteDialog({
  open,
  onOpenChange,
  agent,
}: AiAgentDeleteDialogProps) {
  const deleteMutation = useDeleteAiAgent();

  const handleDelete = () => {
    if (!agent) return;

    deleteMutation.mutate(agent.id, {
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

  if (!agent) return null;

  const hasConversations = (agent.conversations_count ?? 0) > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Agent</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete{' '}
                <span className="font-semibold text-foreground">
                  {agent.name}
                </span>
                ?
              </p>
              {hasConversations && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="text-sm text-destructive space-y-1">
                    <p>
                      This agent has {agent.conversations_count}{' '}
                      {agent.conversations_count === 1
                        ? 'conversation'
                        : 'conversations'}
                      . You cannot delete an agent with existing conversations.
                    </p>
                    <p className="text-muted-foreground">
                      Consider deactivating the agent instead.
                    </p>
                  </div>
                </div>
              )}
              {!hasConversations && (
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
            disabled={hasConversations || deleteMutation.isPending}
          >
            {deleteMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Delete Agent
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
