'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import {
  useCreateSponsor,
  useUpdateSponsor,
} from '@/lib/hooks/useAdminSponsors';
import { extractApiError } from '@/lib/utils/api-error';
import {
  sponsorCreateSchema,
  type SponsorCreateValues,
} from '@/lib/validations/admin-sponsors';
import type { AdminSponsor } from '@/types/admin-sponsors';

interface AdminSponsorFormProps {
  mode: 'create' | 'edit';
  sponsor?: AdminSponsor;
  onSuccess?: (sponsor: AdminSponsor) => void;
  onCancel?: () => void;
}

export function AdminSponsorForm({
  mode,
  sponsor,
  onSuccess,
  onCancel,
}: AdminSponsorFormProps) {
  const router = useRouter();
  const isEdit = mode === 'edit';

  const createMutation = useCreateSponsor();
  const updateMutation = useUpdateSponsor();

  const form = useForm<SponsorCreateValues>({
    resolver: zodResolver(sponsorCreateSchema),
    defaultValues: {
      name: sponsor?.name ?? '',
      contact_email: sponsor?.contact_email ?? null,
      contact_name: sponsor?.contact_name ?? null,
      notes: sponsor?.notes ?? null,
      is_active: sponsor?.is_active ?? true,
    },
  });

  useEffect(() => {
    if (isEdit && sponsor) {
      form.reset({
        name: sponsor.name,
        contact_email: sponsor.contact_email,
        contact_name: sponsor.contact_name,
        notes: sponsor.notes,
        is_active: sponsor.is_active,
      });
    }
  }, [isEdit, sponsor, form]);

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: SponsorCreateValues) => {
    if (isEdit && sponsor) {
      updateMutation.mutate(
        { id: sponsor.id, payload: values },
        {
          onSuccess: (response) => {
            toast.success(response.message || 'Sponsor updated');
            onSuccess?.(response.data);
          },
          onError: (error) => handleError(error),
        }
      );
      return;
    }

    createMutation.mutate(values, {
      onSuccess: (response) => {
        toast.success(response.message || 'Sponsor created');
        if (onSuccess) {
          onSuccess(response.data);
        } else {
          router.push(`/admin/sponsors/${response.data.id}`);
        }
      },
      onError: (error) => handleError(error),
    });
  };

  const handleError = (error: unknown) => {
    const apiError = extractApiError(error);
    if (apiError.errors) {
      let pushedToForm = false;
      Object.entries(apiError.errors).forEach(([field, messages]) => {
        if (field in form.getValues()) {
          form.setError(field as keyof SponsorCreateValues, {
            message: messages[0],
          });
          pushedToForm = true;
        }
      });
      if (!pushedToForm) toast.error(apiError.message);
    } else {
      toast.error(apiError.message);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Sponsor details</CardTitle>
            <CardDescription>
              Only the name is required. Slug is generated automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="University of Lagos"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="partners@unilag.edu.ng"
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Funmi Aluko"
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Internal context — partnership terms, contacts, anything useful."
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Inactive sponsors can&apos;t have new campaigns activated.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => (onCancel ? onCancel() : router.back())}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create sponsor'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
