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

import { useCancelAdminSubscription } from '@/lib/hooks/useAdmin';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminSubscriptionDetail } from '@/types/admin';

interface AdminSubscriptionCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: AdminSubscriptionDetail | null;
}

export function AdminSubscriptionCancelDialog({
  open,
  onOpenChange,
  subscription,
}: AdminSubscriptionCancelDialogProps) {
  const cancelMutation = useCancelAdminSubscription();

  const handleCancel = () => {
    if (!subscription) return;

    cancelMutation.mutate(subscription.id, {
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

  if (!subscription) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to cancel subscription{' '}
                <span className="font-semibold text-foreground">
                  #{subscription.id}
                </span>{' '}
                for{' '}
                <span className="font-semibold text-foreground">
                  {subscription.user.name}
                </span>
                ?
              </p>
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="text-sm text-destructive space-y-1">
                  <p>
                    This will cancel the{' '}
                    <span className="font-medium">
                      {subscription.plan.name}
                    </span>{' '}
                    plan.
                  </p>
                  <p>
                    The user will retain access until the end of their current
                    billing period.
                  </p>
                </div>
              </div>
              <p className="text-sm">
                The subscription will be disabled in Paystack and marked as
                cancelled.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={cancelMutation.isPending}
          >
            Keep Active
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Cancel Subscription
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
