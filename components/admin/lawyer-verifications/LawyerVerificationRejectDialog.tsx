'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';

import { useRejectVerification } from '@/lib/hooks/useAdminLawyerVerifications';
import {
  rejectVerificationSchema,
  type RejectVerificationFormValues,
} from '@/lib/validations/admin-lawyer-verifications';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminLawyerVerificationListItem } from '@/types/admin-lawyer-verification';

/******************************************************************************
                                Component Props
******************************************************************************/

interface LawyerVerificationRejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: AdminLawyerVerificationListItem | null;
  onSuccess?: () => void;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Dialog for rejecting a lawyer verification with a required reason.
 */
export function LawyerVerificationRejectDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: LawyerVerificationRejectDialogProps) {
  const rejectMutation = useRejectVerification();

  const form = useForm<RejectVerificationFormValues>({
    resolver: zodResolver(rejectVerificationSchema),
    defaultValues: {
      rejection_reason: '',
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({ rejection_reason: '' });
    }
  }, [open, form]);

  const onSubmit = async (data: RejectVerificationFormValues) => {
    if (!item) return;

    // Guard: already approved
    if (item.is_verified) {
      toast.error('This profile is already verified and cannot be rejected');
      return;
    }

    try {
      const response = await rejectMutation.mutateAsync({
        id: item.id,
        data: {
          rejection_reason: data.rejection_reason,
        },
      });

      toast.success(response.message || 'Lawyer verification rejected successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      const apiError = extractApiError(error);

      if (apiError.message?.includes('already verified')) {
        toast.error('This profile is already verified');
      } else if (apiError.message?.includes('not been submitted')) {
        toast.error('This profile has not been submitted for verification');
      } else {
        toast.error(apiError.message || 'Failed to reject verification');
      }
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject Verification</AlertDialogTitle>
          <AlertDialogDescription>
            Provide a reason for rejecting{' '}
            <span className="font-medium">{item?.user.name}</span>&apos;s
            verification. This reason will be visible to the lawyer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="rejection_reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rejection Reason</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Explain why this verification is being rejected..."
                      className="min-h-[120px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Maximum 1000 characters. Be clear and professional.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <AlertDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={rejectMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending
                  ? 'Rejecting...'
                  : 'Reject Verification'}
              </Button>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
