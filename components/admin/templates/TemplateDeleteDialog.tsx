'use client';

import { Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteTemplate } from '@/lib/hooks/useAdminTemplates';

/**
 * Delete a template, after a confirm step: the template and its uploaded file
 * go for good. A live one stops being used by Lawexa at once.
 */
export function TemplateDeleteDialog({
  template,
  onOpenChange,
  onDeleted,
}: {
  template: { uuid: string; name: string; live: boolean } | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const remove = useDeleteTemplate();

  return (
    <AlertDialog open={template !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete template</AlertDialogTitle>
          <AlertDialogDescription>
            Delete <span className="font-medium text-foreground">{template?.name}</span> and its uploaded file? This cannot be undone.
            {template?.live ? ' Lawexa stops using it at once.' : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={remove.isPending}
            onClick={(event) => {
              event.preventDefault();
              if (!template) return;
              remove.mutate(template.uuid, {
                onSuccess: () => {
                  onOpenChange(false);
                  onDeleted?.();
                },
              });
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {remove.isPending ? <Loader2 aria-hidden className="mr-2 size-4 animate-spin motion-reduce:animate-none" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
