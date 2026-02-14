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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

import { useFulfillRequest } from '@/lib/hooks/useAdminContentRequests';
import { fulfillSchema, type FulfillFormValues } from '@/lib/validations/admin-content-requests';
import { extractApiError } from '@/lib/utils/api-error';
import type { ContentRequest, CreatedContentType } from '@/types/content-request';

/******************************************************************************
                                Component Props
******************************************************************************/

interface ContentRequestFulfillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ContentRequest | null;
  onSuccess?: () => void;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Dialog for fulfilling content request by linking created content
 * Handles 409 conflict if already fulfilled or rejected
 */
export function ContentRequestFulfillDialog({
  open,
  onOpenChange,
  request,
  onSuccess,
}: ContentRequestFulfillDialogProps) {
  const fulfillMutation = useFulfillRequest();

  const form = useForm<FulfillFormValues>({
    resolver: zodResolver(fulfillSchema),
    defaultValues: {
      created_content_type: 'case',
      created_content_id: 0,
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open && request) {
      form.reset({
        created_content_type: request.type === 'note' ? 'note' : 'case',
        created_content_id: 0,
      });
    }
  }, [open, request, form]);

  const onSubmit = async (data: FulfillFormValues) => {
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
      await fulfillMutation.mutateAsync({
        uuid: request.uuid,
        data: {
          created_content_type: data.created_content_type,
          created_content_id: data.created_content_id,
        },
      });

      toast.success('Content request fulfilled successfully. User will be notified via email.');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      const apiError = extractApiError(error);

      // Handle 409 conflict
      if (apiError.message?.includes('already fulfilled')) {
        toast.error('Content request is already fulfilled');
      } else if (apiError.message?.includes('already rejected')) {
        toast.error('Content request is already rejected');
      } else if (apiError.message?.includes('does not exist')) {
        toast.error('The specified content does not exist. Please check the ID.');
      } else {
        toast.error(apiError.message || 'Failed to fulfill request');
      }
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Fulfill Content Request</AlertDialogTitle>
          <AlertDialogDescription>
            Link the created content to this request. The user will be notified via email.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="created_content_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select content type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="case">Case</SelectItem>
                      <SelectItem value="note">Note</SelectItem>
                      <SelectItem value="statute">Statute</SelectItem>
                      <SelectItem value="provision">Provision</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The type of content you created to fulfill this request
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="created_content_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content ID</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Enter content ID"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>
                    The ID of the content you created (e.g., case ID, note ID)
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
                disabled={fulfillMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={fulfillMutation.isPending}
              >
                {fulfillMutation.isPending ? 'Fulfilling...' : 'Fulfill Request'}
              </Button>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
