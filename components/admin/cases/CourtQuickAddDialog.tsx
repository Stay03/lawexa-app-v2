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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useCountries, useCreateCourt } from '@/lib/hooks/useAdminCases';
import { extractApiError } from '@/lib/utils/api-error';
import { courtFormSchema, generateCourtAbbreviation } from '@/lib/validations/admin-cases';
import type { CourtQuickAddProps, Court } from '@/types/admin-cases';

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Quick-add dialog for creating a new court
 * Pre-fills country if provided via props
 * Auto-generates abbreviation from court name
 */
export function CourtQuickAddDialog({
  open,
  onOpenChange,
  onSuccess,
  preSelectedCountryId,
}: CourtQuickAddProps) {
  const createMutation = useCreateCourt();

  // Fetch countries for dropdown
  const { data: countriesData, isLoading: isCountriesLoading } = useCountries({
    per_page: 100,
  });
  const countries = countriesData?.data || [];

  const form = useForm({
    resolver: zodResolver(courtFormSchema),
    defaultValues: {
      name: '',
      country_id: preSelectedCountryId || 0,
      abbreviation: '',
    },
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      form.reset({
        name: '',
        country_id: preSelectedCountryId || 0,
        abbreviation: '',
      });
    }
  }, [open, preSelectedCountryId, form]);

  // Auto-generate abbreviation from name
  const handleNameChange = (value: string, onChange: (v: string) => void) => {
    onChange(value);
    // Auto-generate abbreviation if it's empty
    if (!form.getValues('abbreviation')) {
      const abbreviation = generateCourtAbbreviation(value);
      form.setValue('abbreviation', abbreviation, { shouldValidate: false });
    }
  };

  const onSubmit = (data: any) => {
    createMutation.mutate(data, {
      onSuccess: (response) => {
        toast.success('Court created successfully');
        onSuccess(response.data as Court);
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
          <DialogTitle>Add New Court</DialogTitle>
          <DialogDescription>
            Create a new court entry. The court will be automatically selected in
            the form.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Court Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Court Name <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Supreme Court of Nigeria"
                      {...field}
                      onChange={(e) =>
                        handleNameChange(e.target.value, field.onChange)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Country */}
            <FormField
              control={form.control}
              name="country_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Country <span className="text-destructive">*</span>
                  </FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ''}
                    onValueChange={(value) => field.onChange(Number(value))}
                    disabled={isCountriesLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a country" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country.id} value={String(country.id)}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Abbreviation */}
            <FormField
              control={form.control}
              name="abbreviation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Abbreviation</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., SCN" maxLength={20} {...field} />
                  </FormControl>
                  <FormDescription>
                    Auto-generated from name, can be edited
                  </FormDescription>
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
                Create Court
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
