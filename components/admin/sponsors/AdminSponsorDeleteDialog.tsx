'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
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

import { useDeleteSponsor } from '@/lib/hooks/useAdminSponsors';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminSponsor } from '@/types/admin-sponsors';

interface AdminSponsorDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sponsor: AdminSponsor;
}

export function AdminSponsorDeleteDialog({
  open,
  onOpenChange,
  sponsor,
}: AdminSponsorDeleteDialogProps) {
  const router = useRouter();
  const deleteMutation = useDeleteSponsor();
  const [inlineError, setInlineError] = useState<string | null>(null);

  const handleDelete = () => {
    setInlineError(null);
    deleteMutation.mutate(sponsor.id, {
      onSuccess: (response) => {
        toast.success(response.message || 'Sponsor deleted');
        onOpenChange(false);
        router.push('/admin/sponsors');
      },
      onError: (error) => {
        const apiError = extractApiError(error);
        // 422 when sponsor owns campaigns — surface inline; dialog stays open.
        if (apiError.status === 422) {
          setInlineError(apiError.message);
        } else {
          toast.error(apiError.message);
        }
      },
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setInlineError(null);
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete sponsor</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete{' '}
                <span className="font-semibold text-foreground">
                  {sponsor.name}
                </span>
                ? This soft-deletes the record.
              </p>
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">
                  If this sponsor owns any campaigns, the delete will be
                  refused. End and revoke them first.
                </p>
              </div>
              {inlineError && (
                <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                  {inlineError}
                </div>
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
            Keep sponsor
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Delete sponsor
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
