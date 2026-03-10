'use client';

import { Loader2, RefreshCw } from 'lucide-react';
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

import { useReactivateAdminSubscription } from '@/lib/hooks/useAdmin';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminSubscriptionDetail } from '@/types/admin';

interface AdminSubscriptionReactivateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: AdminSubscriptionDetail | null;
}

export function AdminSubscriptionReactivateDialog({
  open,
  onOpenChange,
  subscription,
}: AdminSubscriptionReactivateDialogProps) {
  const reactivateMutation = useReactivateAdminSubscription();

  const handleReactivate = () => {
    if (!subscription) return;

    reactivateMutation.mutate(subscription.id, {
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
          <AlertDialogTitle>Reactivate Subscription</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Reactivate subscription{' '}
                <span className="font-semibold text-foreground">
                  #{subscription.id}
                </span>{' '}
                for{' '}
                <span className="font-semibold text-foreground">
                  {subscription.user.name}
                </span>
                ?
              </p>
              <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-950/50">
                <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <p>
                    This will restore the{' '}
                    <span className="font-medium">
                      {subscription.plan.name}
                    </span>{' '}
                    plan to active status.
                  </p>
                  <p>
                    A new billing date will be set based on the plan interval and
                    the subscription will be re-enabled in Paystack.
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
            disabled={reactivateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReactivate}
            disabled={reactivateMutation.isPending}
          >
            {reactivateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Reactivate Subscription
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
