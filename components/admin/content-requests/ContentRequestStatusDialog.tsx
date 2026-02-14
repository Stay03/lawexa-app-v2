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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useUpdateStatus } from '@/lib/hooks/useAdminContentRequests';
import { updateStatusSchema, type UpdateStatusFormValues } from '@/lib/validations/admin-content-requests';
import { extractApiError } from '@/lib/utils/api-error';
import type { ContentRequest } from '@/types/content-request';

/******************************************************************************
                                Component Props
******************************************************************************/

interface ContentRequestStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ContentRequest | null;
  onSuccess?: () => void;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Dialog for updating content request status
 * Warns if changing away from fulfilled/rejected
 */
export function ContentRequestStatusDialog({
  open,
  onOpenChange,
  request,
  onSuccess,
}: ContentRequestStatusDialogProps) {
  const updateStatusMutation = useUpdateStatus();

  const form = useForm<UpdateStatusFormValues>({
    resolver: zodResolver(updateStatusSchema),
    defaultValues: {
      status: request?.status || 'pending',
    },
  });

  // Reset form when request changes
  useEffect(() => {
    if (request) {
      form.reset({
        status: request.status,
      });
    }
  }, [request, form]);

  const onSubmit = async (data: UpdateStatusFormValues) => {
    if (!request) return;

    try {
      await updateStatusMutation.mutateAsync({
        uuid: request.uuid,
        data: { status: data.status },
      });

      toast.success('Status updated successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      const apiError = extractApiError(error);
      toast.error(apiError.message || 'Failed to update status');
    }
  };

  const selectedStatus = form.watch('status');
  const isChangingFromCompleted =
    (request?.status === 'fulfilled' || request?.status === 'rejected') &&
    selectedStatus !== request?.status;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update Status</AlertDialogTitle>
          <AlertDialogDescription>
            Change the status of this content request.
            {isChangingFromCompleted && (
              <span className="block mt-2 text-amber-600 dark:text-amber-400 font-medium">
                Warning: Changing status will clear {request?.status === 'fulfilled' ? 'fulfillment' : 'rejection'} data.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="fulfilled">Fulfilled</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <AlertDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateStatusMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
              </Button>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
