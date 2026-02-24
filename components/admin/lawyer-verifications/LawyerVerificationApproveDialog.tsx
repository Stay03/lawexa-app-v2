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

import { useApproveVerification } from '@/lib/hooks/useAdminLawyerVerifications';
import {
  approveVerificationSchema,
  type ApproveVerificationFormValues,
} from '@/lib/validations/admin-lawyer-verifications';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminLawyerVerificationListItem } from '@/types/admin-lawyer-verification';

/******************************************************************************
                                Component Props
******************************************************************************/

interface LawyerVerificationApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: AdminLawyerVerificationListItem | null;
  onSuccess?: () => void;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Dialog for approving a lawyer verification with optional notes.
 */
export function LawyerVerificationApproveDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: LawyerVerificationApproveDialogProps) {
  const approveMutation = useApproveVerification();

  const form = useForm<ApproveVerificationFormValues>({
    resolver: zodResolver(approveVerificationSchema),
    defaultValues: {
      verification_notes: '',
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({ verification_notes: '' });
    }
  }, [open, form]);

  const onSubmit = async (data: ApproveVerificationFormValues) => {
    if (!item) return;

    // Guard: already approved
    if (item.is_verified) {
      toast.error('This profile is already verified');
      return;
    }

    try {
      const response = await approveMutation.mutateAsync({
        id: item.id,
        data: {
          verification_notes: data.verification_notes || undefined,
        },
      });

      toast.success(response.message || 'Lawyer verification approved successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      const apiError = extractApiError(error);

      if (apiError.message?.includes('already verified')) {
        toast.error('This profile is already verified');
      } else if (apiError.message?.includes('not been submitted')) {
        toast.error('This profile has not been submitted for verification');
      } else {
        toast.error(apiError.message || 'Failed to approve verification');
      }
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve Verification</AlertDialogTitle>
          <AlertDialogDescription>
            Approve <span className="font-medium">{item?.user.name}</span>&apos;s
            lawyer verification. This will mark their profile as verified.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="verification_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any notes about this verification..."
                      className="min-h-[100px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    These notes will be stored on the profile.
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
                disabled={approveMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending
                  ? 'Approving...'
                  : 'Approve Verification'}
              </Button>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
