'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';

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
  lawyerConnectionApi,
  type SendConnectionParams,
} from '@/lib/api/lawyerConnection';
import { extractApiError } from '@/lib/utils/api-error';
import type { LawyerInfo } from './LawyerCard';

/******************************************************************************
                               Types
******************************************************************************/

interface ConnectionRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lawyer: Pick<LawyerInfo, 'id' | 'name'>;
}

/******************************************************************************
                               Schema
******************************************************************************/

const connectionRequestSchema = z
  .object({
    phone_number: z
      .string()
      .max(30, 'Phone number cannot exceed 30 characters.'),
    contact_email: z.string().max(255, 'Email cannot exceed 255 characters.'),
    message: z.string().max(1000, 'Message cannot exceed 1000 characters.'),
    contact: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasPhone = data.phone_number.trim().length > 0;
    const hasEmail = data.contact_email.trim().length > 0;

    if (!hasPhone && !hasEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please provide at least a phone number or email address.',
        path: ['contact'],
      });
    }

    if (hasEmail && !z.string().email().safeParse(data.contact_email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please provide a valid email address.',
        path: ['contact_email'],
      });
    }
  });

type ConnectionRequestFormValues = z.infer<typeof connectionRequestSchema>;

/******************************************************************************
                               Component
******************************************************************************/

function ConnectionRequestDialog({
  open,
  onOpenChange,
  lawyer,
}: ConnectionRequestDialogProps) {
  // Inline replacement for the boundary-blocked `useSendConnectionRequest` hook
  // (@/lib/hooks/useConnection). Calls the same allowed lib/api function and
  // preserves the hook's success toast verbatim.
  const sendConnectionRequest = useMutation({
    mutationFn: (params: SendConnectionParams) =>
      lawyerConnectionApi.sendConnectionRequest(params),
    onSuccess: (response) => {
      if (response.success && response.data) {
        toast.success(
          `Connection request sent to ${response.data.lawyer.name}!`,
          { duration: 5000 }
        );
      }
    },
  });
  const lawyerFirstName = lawyer.name.split(' ')[0] || lawyer.name;

  const form = useForm<ConnectionRequestFormValues>({
    resolver: zodResolver(connectionRequestSchema),
    defaultValues: {
      phone_number: '',
      contact_email: '',
      message: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ phone_number: '', contact_email: '', message: '' });
    }
  }, [open, form]);

  const onSubmit = (values: ConnectionRequestFormValues) => {
    sendConnectionRequest.mutate(
      {
        lawyerId: lawyer.id,
        phone_number: values.phone_number || undefined,
        contact_email: values.contact_email || undefined,
        message: values.message || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
        onError: (error) => {
          const apiError = extractApiError(error);
          if (apiError.errors) {
            const fieldMap: Record<string, string> = {
              phone_number: 'phone_number',
              contact_email: 'contact_email',
              message: 'message',
              contact: 'contact',
              lawyer_uuid: 'contact',
            };
            let mapped = false;
            Object.entries(apiError.errors).forEach(([field, messages]) => {
              const formField = fieldMap[field];
              if (formField) {
                form.setError(formField as keyof ConnectionRequestFormValues, {
                  message: messages[0],
                });
                mapped = true;
              }
            });
            if (!mapped) {
              form.setError('contact', { message: apiError.message });
            }
          } else {
            toast.error(apiError.message);
          }
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect with {lawyerFirstName}</DialogTitle>
          <DialogDescription>
            Provide your contact details so {lawyerFirstName} can reach you.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Cross-field / server error display */}
            {form.formState.errors.contact && (
              <p className="text-sm font-medium text-destructive">
                {form.formState.errors.contact.message}
              </p>
            )}

            <FormField
              control={form.control}
              name="phone_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Message{' '}
                    <span className="text-muted-foreground font-normal">
                      (Optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell the lawyer about your situation..."
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
                disabled={sendConnectionRequest.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={sendConnectionRequest.isPending}>
                {sendConnectionRequest.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send Request
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export { ConnectionRequestDialog };
