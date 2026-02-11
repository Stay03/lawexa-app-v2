'use client';

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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { TopicCombobox } from './TopicCombobox';
import { TagsMultiSelect } from './TagsMultiSelect';
import { useCourses } from '@/lib/hooks/useAdminCases';
import type { CaseFormValues } from '@/lib/validations/admin-cases';

/******************************************************************************
                                Component Props
******************************************************************************/

interface CaseFormBasicInfoProps {
  form: UseFormReturn<CaseFormValues>;
  courseDialogOpen: boolean;
  setCourseDialogOpen: (open: boolean) => void;
}

/******************************************************************************
                                Academic Levels
******************************************************************************/

const ACADEMIC_LEVELS = [
  '100 Level',
  '200 Level',
  '300 Level',
  '400 Level',
  '500 Level',
  '600 Level',
  'Law School',
] as const;

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Basic Information section of the case form
 * Contains: title, body, course, topic, tags, level
 */
export function CaseFormBasicInfo({
  form,
  courseDialogOpen,
  setCourseDialogOpen,
}: CaseFormBasicInfoProps) {
  const { data: coursesData, isLoading: isCoursesLoading } = useCourses({
    per_page: 100,
  });

  const courses = coursesData?.data || [];

  return (
    <div className="space-y-4">
      {/* Title (Required) */}
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Case Title <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input
                placeholder="e.g., Macaulay v. RZB of Austria"
                {...field}
              />
            </FormControl>
            <FormDescription>
              Full title of the legal case (max 500 characters)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Body (Required) */}
      <FormField
        control={form.control}
        name="body"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Case Body <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="Enter the case summary and key details..."
                className="min-h-[120px] resize-y"
                {...field}
              />
            </FormControl>
            <FormDescription>
              Brief summary of the case facts and outcome
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Course with Quick-Add */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="course_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Course</FormLabel>
              <div className="flex gap-2">
                <Select
                  value={field.value ? String(field.value) : ''}
                  onValueChange={(value) =>
                    field.onChange(value ? Number(value) : null)
                  }
                  disabled={isCoursesLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a course" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={String(course.id)}>
                        {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCourseDialogOpen(true)}
                  title="Add new course"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <FormDescription>
                Related academic course or subject area
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Level */}
        <FormField
          control={form.control}
          name="level"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Academic Level</FormLabel>
              <Select
                value={field.value || ''}
                onValueChange={(value) => field.onChange(value || null)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {ACADEMIC_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Suggested academic level for this case
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Topic (Autocomplete) */}
      <FormField
        control={form.control}
        name="topic"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Legal Topic</FormLabel>
            <FormControl>
              <TopicCombobox
                value={field.value || ''}
                onValueChange={field.onChange}
              />
            </FormControl>
            <FormDescription>
              Main legal topic or area of law (e.g., Negligence, Contract Law)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Tags (Multi-Select) */}
      <FormField
        control={form.control}
        name="tags"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tags</FormLabel>
            <FormControl>
              <TagsMultiSelect
                value={field.value || []}
                onValueChange={field.onChange}
              />
            </FormControl>
            <FormDescription>
              Keywords and tags for categorization (e.g., CONTRACT, TORT, CRIMINAL LAW)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
