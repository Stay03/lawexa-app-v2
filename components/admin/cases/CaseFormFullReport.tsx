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

interface CaseFormFullReportProps {
  form: UseFormReturn<CaseFormValues>;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Full Report section of the case form
 * Contains: full_report (rich text in Phase 1, can be enhanced with rich text editor later)
 */
export function CaseFormFullReport({ form }: CaseFormFullReportProps) {
  return (
    <div className="space-y-4">
      {/* Full Report */}
      <FormField
        control={form.control}
        name="full_report"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Full Case Report</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Enter the complete detailed case report..."
                className="min-h-[200px] resize-y font-mono text-sm"
                value={field.value || ''}
                onChange={field.onChange}
              />
            </FormControl>
            <FormDescription>
              Optional comprehensive report with full case details, analysis, and commentary.
              This field supports plain text (rich text editor can be added later).
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
