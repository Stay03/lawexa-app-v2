'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

import { useSubmitContentRequest } from '@/lib/hooks/useContentRequests';
import { extractApiError } from '@/lib/utils/api-error';
import type { ContentRequestType } from '@/types/content-request';

/******************************************************************************
                               Types
******************************************************************************/

interface ContentRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: ContentRequestType;
  defaultTitle?: string;
}

/******************************************************************************
                               Constants
******************************************************************************/

const contentRequestFormSchema = z.object({
  type: z.enum(['case', 'statute', 'provision'], {
    message: 'Please select a content type.',
  }),
  title: z
    .string()
    .min(1, 'Please provide a title for your request.')
    .max(255, 'Title must be 255 characters or less.'),
  additional_notes: z
    .string()
    .max(2000, 'Notes must be 2000 characters or less.')
    .optional()
    .or(z.literal('')),
});

type ContentRequestFormValues = z.infer<typeof contentRequestFormSchema>;

const CONTENT_TYPE_OPTIONS = [
  { value: 'case', label: 'Case' },
  { value: 'statute', label: 'Statute' },
  { value: 'provision', label: 'Provision' },
] as const;

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Dialog for submitting a content request.
 */
function ContentRequestDialog({
  open,
  onOpenChange,
  defaultType,
  defaultTitle,
}: ContentRequestDialogProps) {
  const submitRequest = useSubmitContentRequest();

  const form = useForm<ContentRequestFormValues>({
    resolver: zodResolver(contentRequestFormSchema),
    defaultValues: {
      type: defaultType ?? undefined,
      title: defaultTitle ?? '',
      additional_notes: '',
    },
  });

  // Reset form when dialog opens with new defaults
  useEffect(() => {
    if (open) {
      form.reset({
        type: defaultType ?? undefined,
        title: defaultTitle ?? '',
        additional_notes: '',
      });
    }
  }, [open, defaultType, defaultTitle, form]);

  const onSubmit = (values: ContentRequestFormValues) => {
    submitRequest.mutate(
      {
        type: values.type as ContentRequestType,
        title: values.title,
        additional_notes: values.additional_notes || undefined,
      },
      {
        onSuccess: (response) => {
          toast.success(response.message || 'Content request submitted', {
            description: 'Our research team will review your request shortly.',
          });
          onOpenChange(false);
        },
        onError: (error) => {
          const apiError = extractApiError(error);
          if (apiError.errors) {
            Object.entries(apiError.errors).forEach(([field, messages]) => {
              if (field in contentRequestFormSchema.shape) {
                form.setError(field as keyof ContentRequestFormValues, {
                  message: messages[0],
                });
              }
            });
          } else {
            toast.error(apiError.message);
          }
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request Content</DialogTitle>
          <DialogDescription>
            Can&apos;t find what you&apos;re looking for? Submit a request and our
            research team will work on adding it.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Content type select */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a type..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CONTENT_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Title input */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Okonkwo v. State (2020)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Additional notes textarea */}
            <FormField
              control={form.control}
              name="additional_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Additional Notes{' '}
                    <span className="text-muted-foreground font-normal">
                      (Optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide any extra details that might help our team..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitRequest.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitRequest.isPending}>
                {submitRequest.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export { ContentRequestDialog };
