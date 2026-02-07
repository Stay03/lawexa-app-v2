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

import { useDeleteAiProvider } from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminAiProvider } from '@/types/admin-ai';

interface AiProviderDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: AdminAiProvider | null;
}

export function AiProviderDeleteDialog({
  open,
  onOpenChange,
  provider,
}: AiProviderDeleteDialogProps) {
  const deleteMutation = useDeleteAiProvider();

  const handleDelete = () => {
    if (!provider) return;

    deleteMutation.mutate(provider.id, {
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

  if (!provider) return null;

  const hasModels = provider.models_count > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Provider</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete{' '}
                <span className="font-semibold text-foreground">
                  {provider.name}
                </span>
                ?
              </p>
              {hasModels && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-destructive">
                    This provider has {provider.models_count}{' '}
                    {provider.models_count === 1 ? 'model' : 'models'}.
                    Deleting it may fail if models are still associated.
                    Remove or reassign models first.
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
            Delete Provider
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
