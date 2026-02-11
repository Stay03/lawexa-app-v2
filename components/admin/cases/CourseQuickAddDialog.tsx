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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { useCreateCourse } from '@/lib/hooks/useAdminCases';
import { extractApiError } from '@/lib/utils/api-error';
import { courseFormSchema } from '@/lib/validations/admin-cases';
import type { CourseQuickAddProps, Course } from '@/types/admin-cases';

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Quick-add dialog for creating a new course
 * Simplest dialog with only name field
 * Auto-selects the created course in the parent form
 */
export function CourseQuickAddDialog({
  open,
  onOpenChange,
  onSuccess,
}: CourseQuickAddProps) {
  const createMutation = useCreateCourse();

  const form = useForm({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
      name: '',
    },
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const onSubmit = (data: any) => {
    createMutation.mutate(data, {
      onSuccess: (response) => {
        toast.success('Course created successfully');
        onSuccess(response.data as Course);
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
          <DialogTitle>Add New Course</DialogTitle>
          <DialogDescription>
            Create a new course entry. The course will be automatically selected in
            the form.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Course Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Course Name <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Environmental Law"
                      {...field}
                      autoFocus
                    />
                  </FormControl>
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
                Create Course
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
