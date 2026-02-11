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

import { CaseMultiSelect } from './CaseMultiSelect';
import type { CaseFormData } from '@/types/admin-cases';

/******************************************************************************
                                Component Props
******************************************************************************/

interface CaseFormRelationshipsProps {
  form: UseFormReturn<CaseFormData>;
  currentCaseId?: number;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Relationships section of the case form
 * Contains: similar_case_ids, cited_case_ids
 * Prevents self-reference in edit mode
 */
export function CaseFormRelationships({
  form,
  currentCaseId,
}: CaseFormRelationshipsProps) {
  return (
    <div className="space-y-4">
      {/* Similar Cases */}
      <FormField
        control={form.control}
        name="similar_case_ids"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Similar Cases</FormLabel>
            <FormControl>
              <CaseMultiSelect
                value={field.value || []}
                onValueChange={field.onChange}
                excludeCaseId={currentCaseId}
                placeholder="Search for similar cases..."
                emptyText="No cases found"
                variant="similar"
              />
            </FormControl>
            <FormDescription>
              Link to cases with similar facts, issues, or outcomes (max 50 cases)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Cited Cases */}
      <FormField
        control={form.control}
        name="cited_case_ids"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cited Cases</FormLabel>
            <FormControl>
              <CaseMultiSelect
                value={field.value || []}
                onValueChange={field.onChange}
                excludeCaseId={currentCaseId}
                placeholder="Search for cited cases..."
                emptyText="No cases found"
                variant="cited"
              />
            </FormControl>
            <FormDescription>
              Cases that are formally cited in this judgment (max 50 cases)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
