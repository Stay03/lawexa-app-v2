'use client';

import { useEffect } from 'react';
import { Plus } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
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

import { JudgeMultiSelect } from './JudgeMultiSelect';
import { useCountries, useCourts } from '@/lib/hooks/useAdminCases';
import type { CaseFormData } from '@/types/admin-cases';

/******************************************************************************
                                Component Props
******************************************************************************/

interface CaseFormCourtInfoProps {
  form: UseFormReturn<CaseFormData>;
  countryDialogOpen: boolean;
  setCountryDialogOpen: (open: boolean) => void;
  courtDialogOpen: boolean;
  setCourtDialogOpen: (open: boolean) => void;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Court Information section of the case form
 * Contains: country, court (filtered by country), judgment_date, judges
 * Implements country→court filtering logic
 */
export function CaseFormCourtInfo({
  form,
  countryDialogOpen,
  setCountryDialogOpen,
  courtDialogOpen,
  setCourtDialogOpen,
}: CaseFormCourtInfoProps) {
  // Watch country selection for court filtering
  const selectedCountryId = form.watch('country_id');

  // Fetch countries
  const { data: countriesData, isLoading: isCountriesLoading } = useCountries({
    per_page: 100,
  });

  // Fetch courts filtered by country
  const { data: courtsData, isLoading: isCourtsLoading } = useCourts({
    country: selectedCountryId || undefined,
    per_page: 100,
  });

  const countries = countriesData?.data || [];
  const courts = courtsData?.data || [];

  // Reset court when country changes if current court is invalid
  useEffect(() => {
    if (selectedCountryId) {
      const currentCourtId = form.getValues('court_id');
      if (currentCourtId) {
        const isValidCourt = courts.some((c) => c.id === currentCourtId);
        if (!isValidCourt) {
          form.setValue('court_id', null);
        }
      }
    }
  }, [selectedCountryId, courts, form]);

  return (
    <div className="space-y-4">
      {/* Country and Court Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Country with Quick-Add */}
        <FormField
          control={form.control}
          name="country_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <div className="flex gap-2">
                <Select
                  value={field.value ? String(field.value) : ''}
                  onValueChange={(value) =>
                    field.onChange(value ? Number(value) : null)
                  }
                  disabled={isCountriesLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a country" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {countries.map((country) => (
                      <SelectItem key={country.id} value={String(country.id)}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCountryDialogOpen(true)}
                  title="Add new country"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <FormDescription>Jurisdiction where the case was heard</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Court with Quick-Add (Filtered by Country) */}
        <FormField
          control={form.control}
          name="court_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Court</FormLabel>
              <div className="flex gap-2">
                <Select
                  value={field.value ? String(field.value) : ''}
                  onValueChange={(value) =>
                    field.onChange(value ? Number(value) : null)
                  }
                  disabled={isCourtsLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a court" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {courts.map((court) => (
                      <SelectItem key={court.id} value={String(court.id)}>
                        {court.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCourtDialogOpen(true)}
                  title="Add new court"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <FormDescription>
                {selectedCountryId
                  ? 'Courts filtered by selected country'
                  : 'Select a country first to filter courts'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Judgment Date */}
      <FormField
        control={form.control}
        name="judgment_date"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Judgment Date</FormLabel>
            <FormControl>
              <Input
                type="date"
                value={field.value || ''}
                onChange={field.onChange}
              />
            </FormControl>
            <FormDescription>
              Date the judgment was delivered (YYYY-MM-DD format)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Judges (Multi-Select) */}
      <FormField
        control={form.control}
        name="judge_ids"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Presiding Judges</FormLabel>
            <FormControl>
              <JudgeMultiSelect
                value={field.value || []}
                onValueChange={field.onChange}
              />
            </FormControl>
            <FormDescription>
              Select the judges who presided over this case
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
