'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { useCreateCountry } from '@/lib/hooks/useAdminCases';
import { extractApiError } from '@/lib/utils/api-error';
import { countryFormSchema } from '@/lib/validations/admin-cases';
import type { CountryQuickAddProps, Country } from '@/types/admin-cases';

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Quick-add dialog for creating a new country
 * Auto-selects the created country in the parent form
 */
export function CountryQuickAddDialog({
  open,
  onOpenChange,
  onSuccess,
}: CountryQuickAddProps) {
  const createMutation = useCreateCountry();

  const form = useForm({
    resolver: zodResolver(countryFormSchema),
    defaultValues: {
      name: '',
      code: '',
      abbreviation: '',
    },
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const onSubmit = (data: any) => {
    createMutation.mutate(data, {
      onSuccess: (response) => {
        toast.success('Country created successfully');
        onSuccess(response.data as Country);
        onOpenChange(false);
        form.reset();
      },
      onError: (error) => {
        const apiError = extractApiError(error);
        if (apiError.errors) {
          Object.entries(apiError.errors).forEach(([field, messages]) => {
            form.setError(field as any, {
              message: messages[0],
            });
          });
        } else {
          toast.error(apiError.message);
        }
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Country</DialogTitle>
          <DialogDescription>
            Create a new country entry. The country will be automatically selected in
            the form.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Country Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Country Name <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Nigeria" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Country Code */}
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Country Code <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., NG"
                      maxLength={3}
                      className="uppercase"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormDescription>
                    2-3 letter ISO country code (uppercase)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Abbreviation (Optional) */}
            <FormField
              control={form.control}
              name="abbreviation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Abbreviation</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., NG" maxLength={10} {...field} />
                  </FormControl>
                  <FormDescription>Optional display abbreviation</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Country
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
