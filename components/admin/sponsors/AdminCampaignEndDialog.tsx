'use client';

import { useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import { useEndCampaign } from '@/lib/hooks/useAdminSponsors';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminCampaign } from '@/types/admin-sponsors';

interface AdminCampaignEndDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: AdminCampaign;
  activeGrantsCount: number;
}

export function AdminCampaignEndDialog({
  open,
  onOpenChange,
  campaign,
  activeGrantsCount,
}: AdminCampaignEndDialogProps) {
  const mutation = useEndCampaign();
  const [forceExpire, setForceExpire] = useState(false);

  const handleOpenChange = (next: boolean) => {
    // Reset checkbox each time the dialog opens.
    if (next) setForceExpire(false);
    onOpenChange(next);
  };

  const handleEnd = () => {
    mutation.mutate(
      { id: campaign.id, payload: { force_expire_grants: forceExpire } },
      {
        onSuccess: (response) => {
          toast.success(response.message || 'Campaign ended');
          onOpenChange(false);
        },
        onError: (error) => {
          const apiError = extractApiError(error);
          toast.error(apiError.message);
        },
      }
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>End campaign</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                End{' '}
                <span className="font-semibold text-foreground">
                  {campaign.name}
                </span>
                ? No new grants can be issued after this.
              </p>
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">
                  {activeGrantsCount > 0 ? (
                    <>
                      There{' '}
                      {activeGrantsCount === 1 ? 'is' : 'are'} currently{' '}
                      <strong>{activeGrantsCount}</strong> active grant
                      {activeGrantsCount === 1 ? '' : 's'}.
                    </>
                  ) : (
                    <>There are no active grants on this campaign.</>
                  )}{' '}
                  By default, existing grants run their natural{' '}
                  <code>ends_at</code>.
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  id="force-expire"
                  checked={forceExpire}
                  onCheckedChange={(v) => setForceExpire(v === true)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="force-expire" className="cursor-pointer">
                    Also revoke{' '}
                    {activeGrantsCount > 0
                      ? `${activeGrantsCount} active grant${activeGrantsCount === 1 ? '' : 's'}`
                      : 'any active grants'}{' '}
                    immediately
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Subscriptions will be expired in the same transaction.
                  </p>
                </div>
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
            onClick={handleEnd}
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            End campaign
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
