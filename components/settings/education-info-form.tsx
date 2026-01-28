'use client';

import { GraduationCap } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getLevelOptions } from '@/types/onboarding';
import type { UseFormReturn } from 'react-hook-form';
import type { ProfileFormValues } from '@/lib/utils/profile-validation';
import type { ProfileFieldVisibility } from '@/lib/utils/profile-field-config';

interface EducationInfoFormProps {
  form: UseFormReturn<ProfileFormValues>;
  visibility: ProfileFieldVisibility;
}

export function EducationInfoForm({ form, visibility }: EducationInfoFormProps) {
  if (!visibility.showEducationSection) return null;

  const country = form.watch('country') || '';
  const levelOptions = getLevelOptions(country);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Education &amp; Credentials
        </CardTitle>
        <CardDescription>
          Your educational background and professional credentials
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {visibility.showUniversity && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="university"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>University</FormLabel>
                  <FormControl>
                    <Input placeholder="University name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {visibility.showLevel && (
              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {levelOptions.map((level) => (
                          <SelectItem key={level} value={level}>
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        )}

        {visibility.showLawSchool && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="law_school"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Law School</FormLabel>
                  <FormControl>
                    <Input placeholder="Law school name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {visibility.showCallToBarYear && (
              <FormField
                control={form.control}
                name="call_to_bar_year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Call to Bar Year</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g. 2020"
                        min={1900}
                        max={new Date().getFullYear()}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        )}

        {visibility.showCallNumber && (
          <FormField
            control={form.control}
            name="call_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Call Number</FormLabel>
                <FormControl>
                  <Input placeholder="Your call number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {visibility.showOtherCertifications && (
          <FormField
            control={form.control}
            name="other_certifications"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Other Certifications</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="List any other relevant certifications"
                    className="resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {visibility.showWorkExperience && (
          <FormField
            control={form.control}
            name="work_experience"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Work Experience</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe your relevant work experience"
                    className="resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </CardContent>
    </Card>
  );
}
