'use client';

import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

import { useCreateCourse, useUpdateCourse } from '@/lib/hooks/useAdminCases';
import { extractApiError } from '@/lib/utils/api-error';
import {
  courseFormSchema,
  type CourseFormValues,
} from '@/lib/validations/admin-cases';
import type { Course, CreateCourseData } from '@/types/admin-cases';

interface CourseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass a course to edit; omit/null to create. */
  course?: Course | null;
}

/** Derive a kebab-case slug from a name, matching the backend's rules. */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function CourseFormDialog({
  open,
  onOpenChange,
  course,
}: CourseFormDialogProps) {
  const isEditMode = !!course;
  const slugManuallyEdited = useRef(false);

  const createMutation = useCreateCourse();
  const updateMutation = useUpdateCourse();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: { name: '', slug: '' },
  });

  // Reset the form whenever the dialog opens or the target course changes.
  useEffect(() => {
    if (open) {
      // In edit mode the slug already exists, so treat it as manually set
      // (don't auto-regenerate it from name edits).
      slugManuallyEdited.current = isEditMode;
      form.reset({
        name: course?.name ?? '',
        slug: course?.slug ?? '',
      });
    }
  }, [open, course, isEditMode, form]);

  const handleNameChange = (value: string, onChange: (v: string) => void) => {
    onChange(value);
    if (!isEditMode && !slugManuallyEdited.current) {
      form.setValue('slug', generateSlug(value), { shouldValidate: false });
    }
  };

  const handleSlugChange = (value: string, onChange: (v: string) => void) => {
    slugManuallyEdited.current = true;
    onChange(value);
  };

  const onSubmit = (data: CourseFormValues) => {
    // Only send slug when provided; let the backend auto-generate otherwise.
    const payload: CreateCourseData = { name: data.name };
    if (data.slug) payload.slug = data.slug;

    const onSuccess = (response: { message: string }) => {
      toast.success(response.message);
      onOpenChange(false);
    };

    const onError = (error: unknown) => {
      const apiError = extractApiError(error);
      if (apiError.errors) {
        Object.entries(apiError.errors).forEach(([field, messages]) => {
          form.setError(field as keyof CourseFormValues, {
            message: messages[0],
          });
        });
      } else {
        toast.error(apiError.message);
      }
    };

    if (isEditMode && course) {
      updateMutation.mutate(
        { id: course.id, data: payload },
        { onSuccess, onError }
      );
    } else {
      createMutation.mutate(payload, { onSuccess, onError });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Course' : 'Add Course'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update this course. Content classified under it keeps its link.'
              : 'Create a course to classify cases, quiz questions, and conversations.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Constitutional Law"
                      autoFocus
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

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Slug
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="constitutional-law"
                      className="font-mono text-sm"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) =>
                        handleSlugChange(e.target.value, field.onChange)
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Leave blank to generate one from the name. Lowercase letters,
                    numbers, and hyphens only.
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
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Save Changes' : 'Create Course'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
