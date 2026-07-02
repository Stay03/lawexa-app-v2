'use client';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { useDeleteCourse } from '@/lib/hooks/useAdminCases';
import { extractApiError } from '@/lib/utils/api-error';
import type { Course } from '@/types/admin-cases';

interface CourseDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course | null;
  /** Called after a successful delete (e.g. to navigate away from a detail page). */
  onDeleted?: () => void;
}

export function CourseDeleteDialog({
  open,
  onOpenChange,
  course,
  onDeleted,
}: CourseDeleteDialogProps) {
  const deleteMutation = useDeleteCourse();

  const handleDelete = () => {
    if (!course) return;

    deleteMutation.mutate(course.id, {
      onSuccess: (response) => {
        toast.success(response.message || 'Course deleted');
        onOpenChange(false);
        onDeleted?.();
      },
      onError: (error) => {
        toast.error(extractApiError(error).message);
      },
    });
  };

  if (!course) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Course</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete{' '}
                <span className="font-semibold text-foreground">
                  {course.name}
                </span>
                ?
              </p>
              <p className="text-sm">
                Content classified under it is not removed. You can restore this
                course later from the deleted view.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Delete Course
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
