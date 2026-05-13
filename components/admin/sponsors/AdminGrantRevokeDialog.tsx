'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import { AxiosError } from 'axios';
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

import { useRevokeGrant } from '@/lib/hooks/useAdminSponsors';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminCampaignType, AdminGrant } from '@/types/admin-sponsors';

interface AdminGrantRevokeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grant: AdminGrant;
  campaignType: AdminCampaignType;
}

export function AdminGrantRevokeDialog({
  open,
  onOpenChange,
  grant,
  campaignType,
}: AdminGrantRevokeDialogProps) {
  const mutation = useRevokeGrant();
  const isPack = campaignType === 'pack';

  const handleRevoke = () => {
    mutation.mutate(
      { id: grant.id, type: campaignType },
      {
        onSuccess: (response) => {
          toast.success(response.message || 'Grant revoked');
          onOpenChange(false);
        },
        onError: (error) => {
          // Backend treats 404 as "already revoked / not revocable" — surface as info, close dialog.
          if (error instanceof AxiosError && error.response?.status === 404) {
            toast.message(
              isPack ? 'Pack was already revoked' : 'Grant was already revoked'
            );
            onOpenChange(false);
            return;
          }
          const apiError = extractApiError(error);
          toast.error(apiError.message);
        },
      }
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isPack ? 'Revoke pack' : 'Revoke grant'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Revoke{' '}
                <span className="font-semibold text-foreground">
                  {grant.user.name || grant.user.email}
                </span>
                &apos;s {isPack ? 'pack' : 'grant'}?
              </p>
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">
                  {isPack
                    ? 'Remaining messages will be zeroed immediately. Past usage stays counted.'
                    : 'Their granted subscription will be marked as expired immediately.'}
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRevoke}
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isPack ? 'Revoke pack' : 'Revoke grant'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
