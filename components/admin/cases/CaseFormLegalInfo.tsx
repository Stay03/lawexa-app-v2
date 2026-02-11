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
 * Contains: principles, judicial_precedent
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

      {/* Judicial Precedent */}
      <FormField
        control={form.control}
        name="judicial_precedent"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Judicial Precedent</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Describe the precedent set by this case..."
                className="min-h-[100px] resize-y"
                value={field.value || ''}
                onChange={field.onChange}
              />
            </FormControl>
            <FormDescription>
              How this case follows or establishes precedent in the legal system
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
