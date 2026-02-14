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

import { useRejectRequest } from '@/lib/hooks/useAdminContentRequests';
import { rejectSchema, type RejectFormValues } from '@/lib/validations/admin-content-requests';
import { extractApiError } from '@/lib/utils/api-error';
import type { ContentRequest } from '@/types/content-request';

/******************************************************************************
                                Component Props
******************************************************************************/

interface ContentRequestRejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ContentRequest | null;
  onSuccess?: () => void;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Dialog for rejecting content request with reason
 * Handles 409 conflict if already fulfilled or rejected
 */
export function ContentRequestRejectDialog({
  open,
  onOpenChange,
  request,
  onSuccess,
}: ContentRequestRejectDialogProps) {
  const rejectMutation = useRejectRequest();

  const form = useForm<RejectFormValues>({
    resolver: zodResolver(rejectSchema),
    defaultValues: {
      rejection_reason: '',
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        rejection_reason: '',
      });
    }
  }, [open, form]);

  const onSubmit = async (data: RejectFormValues) => {
    if (!request) return;

    // Check if already completed
    if (request.status === 'fulfilled') {
      toast.error('This content request is already fulfilled');
      return;
    }

    if (request.status === 'rejected') {
      toast.error('This content request is already rejected');
      return;
    }

    try {
      await rejectMutation.mutateAsync({
        uuid: request.uuid,
        data: {
          rejection_reason: data.rejection_reason,
        },
      });

      toast.success('Content request rejected successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      const apiError = extractApiError(error);

      // Handle 409 conflict
      if (apiError.message?.includes('already fulfilled')) {
        toast.error('Content request is already fulfilled');
      } else if (apiError.message?.includes('already rejected')) {
        toast.error('Content request is already rejected');
      } else {
        toast.error(apiError.message || 'Failed to reject request');
      }
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject Content Request</AlertDialogTitle>
          <AlertDialogDescription>
            Provide a reason for rejecting this content request. This will be visible to the user.
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
                      placeholder="Explain why this request is being rejected..."
                      className="min-h-[120px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Maximum 2000 characters. Be clear and professional.
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
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject Request'}
              </Button>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
