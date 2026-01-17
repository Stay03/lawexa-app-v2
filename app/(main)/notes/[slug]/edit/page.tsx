'use client';

import { use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { NoteForm } from '@/components/notes';
import { useNote, useUpdateNote } from '@/lib/hooks/useNotes';
import { useAuthStore } from '@/lib/stores/authStore';
import { canEditNote, getNoteUrl } from '@/lib/utils/note-utils';
import { extractApiError } from '@/lib/utils/api-error';
import { transformNoteFormData, type CreateNoteFormData } from '@/lib/utils/note-validation';

interface EditNotePageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Edit Note page - minimal editor with publish dialog
 */
function EditNotePage({ params }: EditNotePageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const { user } = useAuthStore();
  const { data, isLoading, isError, refetch } = useNote(slug);
  const updateNote = useUpdateNote();

  // Handle form submission
  const handleSubmit = useCallback(
    async (formData: CreateNoteFormData) => {
      if (!data?.data) return;

      try {
        // Transform form data for API submission
        const transformedData = transformNoteFormData(formData);
        const result = await updateNote.mutateAsync({
          id: data.data.id,
          data: transformedData,
        });

        toast.success('Note updated', {
          description: 'Your changes have been saved.',
        });

        // Navigate to the note detail page (slug may have changed)
        router.push(getNoteUrl(result.data));
      } catch (error) {
        const apiError = extractApiError(error);
        toast.error('Failed to update note', {
          description: apiError.message,
        });
      }
    },
    [data?.data, updateNote, router]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between border-b pb-4 mb-8">
            <Skeleton className="h-5 w-32" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
          <div className="space-y-8">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <ErrorState
            title="Failed to load note"
            description="We couldn't load this note for editing. Please try again."
            retry={() => refetch()}
          />
        </div>
      </div>
    );
  }

  // Not found state
  if (!data?.data) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <EmptyState
            icon={FileText}
            title="Note not found"
            description="The note you're trying to edit doesn't exist or has been removed."
            action={{ label: 'Browse Notes', onClick: () => router.push('/notes') }}
          />
        </div>
      </div>
    );
  }

  const note = data.data;

  // Check authorization
  if (!canEditNote(note, user)) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <EmptyState
            icon={FileText}
            title="Not authorized"
            description="You don't have permission to edit this note."
            action={{ label: 'View Note', onClick: () => router.push(getNoteUrl(note)) }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-6">
        <NoteForm
          initialData={note}
          onSubmit={handleSubmit}
          isSubmitting={updateNote.isPending}
        />
      </div>
    </div>
  );
}

export default EditNotePage;
