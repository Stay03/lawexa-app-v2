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

import { useActivateCampaign } from '@/lib/hooks/useAdminSponsors';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminCampaign } from '@/types/admin-sponsors';

interface AdminCampaignActivateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: AdminCampaign;
}

export function AdminCampaignActivateDialog({
  open,
  onOpenChange,
  campaign,
}: AdminCampaignActivateDialogProps) {
  const mutation = useActivateCampaign();

  const handleActivate = () => {
    mutation.mutate(campaign.id, {
      onSuccess: (response) => {
        toast.success(response.message || 'Campaign activated');
        onOpenChange(false);
      },
      onError: (error) => {
        const apiError = extractApiError(error);
        toast.error(apiError.message);
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Activate campaign</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Activate{' '}
                <span className="font-semibold text-foreground">
                  {campaign.name}
                </span>
                ? Once active, you can start issuing grants.
              </p>
              <p className="text-sm text-muted-foreground">
                You won&apos;t be able to change the plan, duration, or custom
                quota after activation.
              </p>
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
          <Button onClick={handleActivate} disabled={mutation.isPending}>
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Activate
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
