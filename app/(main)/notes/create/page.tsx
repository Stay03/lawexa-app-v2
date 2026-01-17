'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { NoteForm } from '@/components/notes';
import { useCreateNote } from '@/lib/hooks/useNotes';
import { extractApiError } from '@/lib/utils/api-error';
import { transformNoteFormData, type CreateNoteFormData } from '@/lib/utils/note-validation';

/**
 * Create Note page - minimal editor with publish dialog
 */
function CreateNotePage() {
  const router = useRouter();
  const createNote = useCreateNote();

  // Handle form submission
  const handleSubmit = useCallback(
    async (formData: CreateNoteFormData) => {
      try {
        // Transform form data for API submission
        const data = transformNoteFormData(formData);
        const result = await createNote.mutateAsync(data);

        toast.success('Note created', {
          description: `Your note "${result.data.title}" has been ${result.data.status === 'published' ? 'published' : 'saved as draft'}.`,
        });

        // Navigate to the note detail page
        router.push(`/notes/${result.data.slug}`);
      } catch (error) {
        const apiError = extractApiError(error);
        toast.error('Failed to create note', {
          description: apiError.message,
        });
      }
    },
    [createNote, router]
  );

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-6">
        <NoteForm
          onSubmit={handleSubmit}
          isSubmitting={createNote.isPending}
        />
      </div>
    </div>
  );
}

export default CreateNotePage;
