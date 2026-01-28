'use client';

import { useState } from 'react';
import { Briefcase, X } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
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
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCountries } from '@/lib/hooks/useCountries';
import { useAllExpertise } from '@/lib/hooks/useExpertise';
import { PROFESSION_OPTIONS } from '@/types/onboarding';
import type { UseFormReturn } from 'react-hook-form';
import type { ProfileFormValues } from '@/lib/utils/profile-validation';

interface ProfessionalInfoFormProps {
  form: UseFormReturn<ProfileFormValues>;
}

export function ProfessionalInfoForm({ form }: ProfessionalInfoFormProps) {
  const [countrySearch, setCountrySearch] = useState('');
  const { data: countries } = useCountries(countrySearch);
  const { data: expertiseAreas } = useAllExpertise();

  const selectedExpertiseIds = form.watch('areas_of_expertise') || [];

  function handleExpertiseToggle(id: number) {
    const current = form.getValues('areas_of_expertise') || [];
    if (current.includes(id)) {
      form.setValue(
        'areas_of_expertise',
        current.filter((x) => x !== id),
        { shouldDirty: true }
      );
    } else {
      form.setValue('areas_of_expertise', [...current, id], {
        shouldDirty: true,
      });
    }
  }

  function handleRemoveExpertise(id: number) {
    const current = form.getValues('areas_of_expertise') || [];
    form.setValue(
      'areas_of_expertise',
      current.filter((x) => x !== id),
      { shouldDirty: true }
    );
  }

  const selectedExpertiseItems = (expertiseAreas ?? []).filter((e) =>
    selectedExpertiseIds.includes(e.id)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Professional Information
        </CardTitle>
        <CardDescription>
          Update your professional details and background
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name="profession"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Profession</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value || ''}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select your profession" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PROFESSION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <Combobox
                value={field.value || ''}
                onValueChange={(val) => {
                  field.onChange(val);
                  setCountrySearch('');
                }}
              >
                <FormControl>
                  <ComboboxInput
                    placeholder="Search for a country"
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    showClear={!!field.value}
                  />
                </FormControl>
                <ComboboxContent>
                  <ComboboxList>
                    {countries.map((country) => (
                      <ComboboxItem
                        key={country.code}
                        value={country.name}
                      >
                        {country.name}
                      </ComboboxItem>
                    ))}
                    <ComboboxEmpty>No countries found</ComboboxEmpty>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State / Region</FormLabel>
                <FormControl>
                  <Input placeholder="State or region" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input placeholder="City" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input placeholder="Street address" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Areas of Expertise — multi-select */}
        <FormField
          control={form.control}
          name="areas_of_expertise"
          render={() => (
            <FormItem>
              <FormLabel>Areas of Expertise</FormLabel>
              <ExpertiseSelector
                expertiseAreas={expertiseAreas ?? []}
                selectedIds={selectedExpertiseIds}
                onToggle={handleExpertiseToggle}
              />
              {selectedExpertiseItems.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedExpertiseItems.map((e) => (
                    <Badge key={e.id} variant="secondary" className="gap-1">
                      {e.name}
                      <button
                        type="button"
                        onClick={() => handleRemoveExpertise(e.id)}
                        className="ml-0.5 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}

function ExpertiseSelector({
  expertiseAreas,
  selectedIds,
  onToggle,
}: {
  expertiseAreas: { id: number; name: string; slug: string }[];
  selectedIds: number[];
  onToggle: (id: number) => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = expertiseAreas.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Combobox value={null} onValueChange={() => {}}>
      <ComboboxInput
        placeholder="Search areas of expertise"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ComboboxContent>
        <ComboboxList>
          {filtered.map((area) => (
            <ComboboxItem
              key={area.id}
              value={area.name}
              onSelect={() => {
                onToggle(area.id);
                setSearch('');
              }}
              data-selected={selectedIds.includes(area.id) || undefined}
              className="data-[selected]:font-medium"
            >
              <span className="flex items-center gap-2">
                {selectedIds.includes(area.id) && (
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                )}
                {area.name}
              </span>
            </ComboboxItem>
          ))}
          <ComboboxEmpty>No areas found</ComboboxEmpty>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
