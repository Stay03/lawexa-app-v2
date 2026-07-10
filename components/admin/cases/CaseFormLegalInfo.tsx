'use client';

import type { UseFormReturn } from 'react-hook-form';

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';

import type { CaseFormValues } from '@/lib/validations/admin-cases';

/******************************************************************************
                                Component Props
******************************************************************************/

interface CaseFormLegalInfoProps {
  form: UseFormReturn<CaseFormValues>;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Legal Information section of the case form
 * Contains: principles
 */
export function CaseFormLegalInfo({ form }: CaseFormLegalInfoProps) {
  return (
    <div className="space-y-4">
      {/* Legal Principles */}
      <FormField
        control={form.control}
        name="principles"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Legal Principles</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Enter the legal principles established or discussed in this case..."
                className="min-h-[100px] resize-y"
                value={field.value || ''}
                onChange={field.onChange}
              />
            </FormControl>
            <FormDescription>
              Key legal principles, doctrines, or rules established by this case
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
